import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createD1Shim } from '../db/d1-shim'
import { DEMO_PASSWORD, DEMO_USER_EMAIL, DEMO_USER_ID } from '../db/demo'
import { type Db, createDb } from '../db/index'
import { applyMigrations } from '../db/migrate'
import { seedDatabase } from '../db/seed'
import { signIn } from './accounts'
import { hashPassword } from './password'
import { RESET_CODE_TTL_MS, createResetCode, normalizeResetCode, resetPassword } from './reset'

/**
 * 口令找回规则：管理员生成一次性重置码 → 用户用它设置新口令。
 *
 * 验收口径（TASKS.md P1-9）：新口令能登录、旧口令失效、重置码一次性。
 * 刻意不做密保问题——那类东西的答案大多可被社工，等于开一道更弱的门。
 */

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-reset-'))
let db: Db
let close: () => void

beforeAll(async () => {
  const path = join(tempDir, 'reset.db')
  applyMigrations(path)
  const shim = createD1Shim(path)
  db = createDb(shim)
  close = () => shim.close()

  await seedDatabase(db, { passwordHash: await hashPassword(DEMO_PASSWORD) })
})

afterAll(() => {
  close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('口令找回（管理员重置码）', () => {
  it('生成重置码 → 设置新口令 → 新口令能登录，旧口令失效', async () => {
    const created = await createResetCode(db, DEMO_USER_EMAIL)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await resetPassword(db, DEMO_USER_EMAIL, created.code, 'a-brand-new-password')
    expect(result).toEqual({ ok: true, userId: DEMO_USER_ID })

    expect((await signIn(db, DEMO_USER_EMAIL, 'a-brand-new-password')).ok).toBe(true)
    expect(await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD)).toEqual({
      ok: false,
      message: '邮箱或口令不正确。',
    })
  })

  it('重置码一次性：第二次再用同一张码被拒', async () => {
    const created = await createResetCode(db, DEMO_USER_EMAIL)
    if (!created.ok) throw new Error('应该能生成重置码')

    expect((await resetPassword(db, DEMO_USER_EMAIL, created.code, 'password-one')).ok).toBe(true)
    expect(await resetPassword(db, DEMO_USER_EMAIL, created.code, 'password-two')).toEqual({
      ok: false,
      message: '重置码不正确或已过期。',
    })
  })

  it('过期的码被拒，且拒绝的话术与「码不对」完全相同', async () => {
    const now = new Date('2026-10-01T00:00:00Z')
    const created = await createResetCode(db, DEMO_USER_EMAIL, now)
    if (!created.ok) throw new Error('应该能生成重置码')

    const late = new Date(now.getTime() + RESET_CODE_TTL_MS + 1)
    const expired = await resetPassword(db, DEMO_USER_EMAIL, created.code, 'password-x', late)
    const wrong = await resetPassword(db, DEMO_USER_EMAIL, 'NOT-A-CODE', 'password-x')

    expect(expired).toEqual(wrong)
    expect(expired).toEqual({ ok: false, message: '重置码不正确或已过期。' })
  })

  it('码绑定邮箱：给 A 生成的码不能用来重置 B 的账号', async () => {
    const created = await createResetCode(db, DEMO_USER_EMAIL)
    if (!created.ok) throw new Error('应该能生成重置码')

    // 另一个账号不存在也没有关系：码与邮箱不匹配就拒绝，不泄露任何信息
    const result = await resetPassword(db, 'someone-else@fitchat.local', created.code, 'password-x')
    expect(result).toEqual({ ok: false, message: '重置码不正确或已过期。' })
  })

  it('不存在的邮箱生成不了码；新口令太短被拒', async () => {
    expect(await createResetCode(db, 'ghost@fitchat.local')).toEqual({
      ok: false,
      message: '没有这个邮箱对应的账号。',
    })

    const created = await createResetCode(db, DEMO_USER_EMAIL)
    if (!created.ok) throw new Error('应该能生成重置码')
    expect(await resetPassword(db, DEMO_USER_EMAIL, created.code, 'short')).toEqual({
      ok: false,
      message: '新口令至少 8 位。',
    })
  })

  it('重置码规范化：小写与首尾空格也能用', async () => {
    const created = await createResetCode(db, DEMO_USER_EMAIL)
    if (!created.ok) throw new Error('应该能生成重置码')

    const messy = `  ${created.code.toLowerCase()}  `
    const result = await resetPassword(db, DEMO_USER_EMAIL, messy, 'normalized-password')
    expect(result.ok).toBe(true)
  })
})

describe('规范化', () => {
  it('重置码去空格并转大写', () => {
    expect(normalizeResetCode(' ab12-cd34 ')).toBe('AB12-CD34')
  })
})
