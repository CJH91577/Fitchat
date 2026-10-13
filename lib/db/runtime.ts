import { existsSync } from 'node:fs'
import { createD1Shim } from './d1-shim'
import { DEMO_USER_ID } from './demo'
import { type Db, createDb, dbPath } from './index'
import { type DbUser, userById } from './queries'

/**
 * 页面拿数据库与当前用户的地方。
 *
 * 现在这里的实现是「本地库文件 + D1 兼容层」。接入 Cloudflare Workers 之后，
 * 这里会换成从 `cloudflare:workers` 的 env 里取 D1 绑定——**改动只在这一处**，
 * 上面的查询代码与页面一行都不用动。这正是之前把读写都收进 lib/db/queries.ts
 * 的回报。
 */

/** 打开一个本地库文件（兼容层），返回连接与关闭方法 */
export function openLocalDb(path: string = dbPath()): { db: Db; close: () => void } {
  if (path !== ':memory:' && !existsSync(path)) {
    // 明确报错，而不是让 better-sqlite3 静默建一个空库，
    // 然后在一堆「no such table」里淹掉真正的原因。
    throw new Error(`数据库不存在：${path}。先运行 npm run db:seed（它会自动跑迁移）。`)
  }
  const shim = createD1Shim(path)
  return { db: createDb(shim), close: () => shim.close() }
}

let cached: { db: Db; close: () => void } | undefined

/**
 * 进程内复用同一个连接。每次请求新开连接会不断产生句柄与 WAL 文件，
 * 而 SQLite 的单写者模型也不需要更多并行。
 */
export function getDb(): Db {
  cached ??= openLocalDb()
  return cached.db
}

/**
 * 关掉复用中的连接并清掉缓存。页面代码不需要调用它，但测试与脚本需要——
 * Windows 上「打开着的文件删不掉」，测试结束时想清掉临时库目录，
 * 就必须先把连接关掉。
 */
export function closeDb(): void {
  cached?.close()
  cached = undefined
}

export function getDemoUser(db: Db = getDb()): Promise<DbUser> {
  return userById(db, DEMO_USER_ID).then((user) => {
    if (!user) {
      throw new Error(`库里没有演示用户（${DEMO_USER_ID}）。先运行 npm run db:seed。`)
    }
    return user
  })
}
