import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDemoUser, openDb } from './runtime'

describe('数据库连接层', () => {
  it('内存库可以直接打开', () => {
    const db = openDb(':memory:')
    expect(db.select).toBeTypeOf('function')
    db.$client.close()
  })

  it('库文件不存在时给出明确提示，而不是静默建一个空库', () => {
    const missing = join(process.cwd(), 'data', 'definitely-not-here.db')
    // 静默建空库的后果是所有查询都报 no such table，真正的原因被淹没
    expect(() => openDb(missing)).toThrow(/先运行 npm run db:seed/)
  })

  it('库里没有演示用户时抛错，而不是返回 null 让调用方去猜', () => {
    const db = openDb(':memory:')
    migrate(db, { migrationsFolder: './drizzle' })
    expect(() => getDemoUser(db)).toThrow(/库里没有演示用户/)
    db.$client.close()
  })
})
