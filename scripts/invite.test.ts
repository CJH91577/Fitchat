import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createD1Shim } from '../lib/db/d1-shim'
import { type Db, createDb } from '../lib/db/index'
import { applyMigrations } from '../lib/db/migrate'
import { inviteCodeFor, inviteCodesForAdmin } from '../lib/db/queries'
import { registerWithInvite } from '../lib/db/writes'
import { newInviteCode, parseArgs, runInvite } from './invite'

/**
 * 邀请码管理 CLI。
 *
 * 这台开发机禁止子进程（spawn EPERM），所以不真的去跑 tsx——CLI 的
 * 参数解析与执行逻辑都导出成纯函数，直接调。验收口径（TASKS.md P1-10）：
 * 发码后库里出现新码且可用一次；列表能看到是否已用、谁用的；作废后失效。
 */

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-invite-'))
let db: Db
let close: () => void

beforeAll(() => {
  const path = join(tempDir, 'invite.db')
  applyMigrations(path)
  const shim = createD1Shim(path)
  db = createDb(shim)
  close = () => shim.close()
})

afterAll(() => {
  close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('参数解析', () => {
  it('三个子命令与两种 flag 写法', () => {
    expect(parseArgs(['issue', '--count', '3', '--note', '给张三'])).toEqual({
      type: 'issue',
      count: 3,
      note: '给张三',
    })
    expect(parseArgs(['issue', '--count=2'])).toEqual({ type: 'issue', count: 2, note: null })
    expect(parseArgs(['issue'])).toEqual({ type: 'issue', count: 1, note: null })
    expect(parseArgs(['list'])).toEqual({ type: 'list' })
    expect(parseArgs(['revoke', '--code', 'abcd'])).toEqual({ type: 'revoke', code: 'ABCD' })
  })

  it('非法输入给用法说明', () => {
    expect(parseArgs([])).toHaveProperty('error')
    expect(parseArgs(['issue', '--count', '0'])).toHaveProperty('error')
    expect(parseArgs(['issue', '--count', '999'])).toHaveProperty('error')
    expect(parseArgs(['revoke'])).toHaveProperty('error')
  })

  it('生成的码不含易混字符（0/O、1/I），带分组连字符', () => {
    for (let i = 0; i < 50; i++) {
      const code = newInviteCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    }
  })
})

describe('执行命令', () => {
  it('发码：库里出现新码，且能用它注册一次', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await runInvite(db, { type: 'issue', count: 1, note: '给测试' })
      expect(code).toBe(0)
    } finally {
      log.mockRestore()
    }

    const rows = await inviteCodesForAdmin(db)
    expect(rows.length).toBe(1)
    expect(rows[0]?.note).toBe('给测试')

    const result = await registerWithInvite(db, rows[0]!.code, {
      userId: 'cli-user',
      email: 'cli-user@fitchat.local',
      passwordHash: 'x',
      startedAt: '2026-10-16',
      timezone: 'Asia/Shanghai',
      now: new Date(),
    })
    expect(result).toEqual({ ok: true })
    expect((await inviteCodeFor(db, rows[0]!.code))?.usedByUserId).toBe('cli-user')
  })

  it('列表：能看到是否已用、谁用的', async () => {
    await runInvite(db, { type: 'issue', count: 2, note: '列表用' })
    const rows = await inviteCodesForAdmin(db)
    const usedCode = await firstCode()
    const used = rows.find((row) => row.code === usedCode)
    expect(used?.usedByEmail).toBe('cli-user@fitchat.local')

    const unused = rows.find((row) => row.usedAt === null)
    expect(unused).toBeTruthy()

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(await runInvite(db, { type: 'list' })).toBe(0)
      const output = log.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('已用（cli-user@fitchat.local）')
      expect(output).toContain('未使用')
    } finally {
      log.mockRestore()
    }
  })

  it('作废：没用掉的码删掉、无法再用；已用掉的码拒绝作废', async () => {
    const rows = await inviteCodesForAdmin(db)
    const unused = rows.find((row) => row.usedAt === null)
    const used = rows.find((row) => row.usedAt !== null)
    expect(unused).toBeTruthy()
    expect(used).toBeTruthy()

    expect(await runInvite(db, { type: 'revoke', code: unused!.code })).toBe(0)
    expect(await inviteCodeFor(db, unused!.code)).toBeNull()

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await runInvite(db, { type: 'revoke', code: used!.code })).toBe(1)
      expect(await inviteCodeFor(db, used!.code)).not.toBeNull()
    } finally {
      error.mockRestore()
    }
  })

  it('不存在的码作废失败', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await runInvite(db, { type: 'revoke', code: 'NOPE-NOPE' })).toBe(1)
    } finally {
      error.mockRestore()
    }
  })
})

async function firstCode(): Promise<string> {
  const rows = await inviteCodesForAdmin(db)
  const used = rows.find((row) => row.usedAt !== null)
  if (!used) throw new Error('应当有一张已用的码')
  return used.code
}
