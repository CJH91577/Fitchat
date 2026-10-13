import { count } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb, dbPath } from './index'
import { users } from './schema'
import { seedDatabase } from './seed'

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-db-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('数据库连接', () => {
  it('打开外键约束——否则 schema 里的 references 只是一份文档', () => {
    const db = createDb(':memory:')
    const row = db.$client.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
    db.$client.close()
  })

  it('文件库启用 WAL（内存库不支持，跳过）', () => {
    const db = createDb(join(tempDir, 'wal.db'))
    const row = db.$client.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    expect(row.journal_mode).toBe('wal')
    db.$client.close()
  })

  it('关掉连接再打开，数据还在', () => {
    const path = join(tempDir, 'persist.db')

    const first = createDb(path)
    migrate(first, { migrationsFolder: './drizzle' })
    const summary = seedDatabase(first, { from: '2025-09-22', to: '2025-09-25' })
    first.$client.close()

    // 换一个连接读同一个文件：这才是「真的落库了」，而不是活在进程内存里。
    const second = createDb(path)
    expect(second.select({ n: count() }).from(users).get()?.n).toBe(1)
    second.$client.close()

    expect(summary.weightEntries).toBe(4)
  })
})

describe('dbPath', () => {
  it('默认指向 data/fitchat.db，可由 DATABASE_PATH 覆盖', () => {
    // 这条性质是「数据库版页面可测」的前提：路径必须在**调用时**读取，
    // 否则测试来不及在 import 之前把环境变量设好。
    const original = process.env.DATABASE_PATH
    try {
      delete process.env.DATABASE_PATH
      expect(dbPath()).toBe('data/fitchat.db')
      process.env.DATABASE_PATH = ':memory:'
      expect(dbPath()).toBe(':memory:')
    } finally {
      if (original === undefined) delete process.env.DATABASE_PATH
      else process.env.DATABASE_PATH = original
    }
  })
})
