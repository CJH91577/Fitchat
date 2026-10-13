import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { closeDb, getDb, getDemoUser, openLocalDb } from './runtime'
import { seedDatabase } from './seed'

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-runtime-'))
const runtimePath = join(tempDir, 'runtime.db')

// getDb() 走 dbPath()，测试里指到自己的临时库，避免碰真实库文件（CI 上也没有它）
process.env.DATABASE_PATH = runtimePath

beforeAll(async () => {
  applyMigrations(runtimePath)
  const { db, close } = openLocalDb(runtimePath)
  try {
    await seedDatabase(db, { from: '2025-09-22', to: '2025-09-25' })
  } finally {
    close()
  }
})

afterAll(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('数据库连接层', () => {
  it('内存库可以直接打开', () => {
    const { db, close } = openLocalDb(':memory:')
    expect(db.select).toBeTypeOf('function')
    close()
  })

  it('库文件不存在时给出明确提示，而不是静默建一个空库', () => {
    const missing = join(process.cwd(), 'data', 'definitely-not-here.db')
    // 静默建空库的后果是所有查询都报 no such table，真正的原因被淹没
    expect(() => openLocalDb(missing)).toThrow(/先运行 npm run db:seed/)
  })

  it('库里没有演示用户时抛错，而不是返回 null 让调用方去猜', async () => {
    // 迁移必须跑过：否则报的是「no such table: users」，这条测试会因为
    // 错误的原因通过，而它本该验的是「表在、但没有那个用户」
    const path = join(tempDir, 'empty.db')
    applyMigrations(path)
    const { db, close } = openLocalDb(path)
    await expect(getDemoUser(db)).rejects.toThrow(/库里没有演示用户/)
    close()
  })

  it('getDb 复用同一个连接，closeDb 之后可以重新打开', () => {
    const first = getDb()
    expect(getDb()).toBe(first)

    closeDb()
    expect(getDb()).not.toBe(first)
  })

  it('复用的连接读到的是环境变量指向的那个库', async () => {
    // 演示用户在 beforeAll 里种进了 runtimePath
    const user = await getDemoUser()
    expect(user.id).toBe('demo-user')
  })
})

