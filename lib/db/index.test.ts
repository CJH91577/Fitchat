import { describe, expect, it } from 'vitest'
import { createD1Shim } from './d1-shim'
import { createDb, dbPath } from './index'
import { users } from './schema'

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

describe('createDb', () => {
  it('接受任何实现了 D1 那点接口的对象——线上是真绑定，本地是兼容层', async () => {
    const shim = createD1Shim(':memory:')
    const db = createDb(shim)

    // 迁移没跑，表不存在。重点在于驱动接得上，且错误来自数据库而不是类型转换。
    await expect(db.select().from(users).all()).rejects.toThrow()

    shim.close()
  })
})
