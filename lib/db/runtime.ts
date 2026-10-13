import { existsSync } from 'node:fs'
import { DEFAULT_DB_PATH, type Db, createDb } from './index'
import { DEMO_USER_ID } from './demo'
import { type DbUser, userById } from './queries'

/**
 * 页面拿数据库与当前用户的地方。
 *
 * 目前是单用户演示：用户固定为库里的演示用户。阶段 3 接入认证后，
 * getDemoUser 会变成 getCurrentUser（从会话解析），其余调用点不用动。
 */

/**
 * 按路径打开数据库。做成独立函数而不是塞进 getDb 里，是为了让它能被测试
 * 直接驱动（传 ':memory:' 或一个不存在的路径），而不必去动真实的库文件。
 */
export function openDb(path: string = DEFAULT_DB_PATH): Db {
  if (path !== ':memory:' && !existsSync(path)) {
    // 明确报错，而不是让 better-sqlite3 静默建一个空库，
    // 然后在一堆「no such table」里淹掉真正的原因。
    throw new Error(`数据库不存在：${path}。先运行 npm run db:seed（它会自动跑迁移）。`)
  }
  return createDb(path)
}

let cached: Db | undefined

/**
 * 进程内复用同一个 SQLite 句柄。每次请求新开一个连接会不断产生句柄与
 * WAL 文件，而 SQLite 的单写者模型也不需要更多并行。
 */
export function getDb(): Db {
  return (cached ??= openDb())
}

export function getDemoUser(db: Db = getDb()): DbUser {
  const user = userById(db, DEMO_USER_ID)
  if (!user) {
    throw new Error(`库里没有演示用户（${DEMO_USER_ID}）。先运行 npm run db:seed。`)
  }
  return user
}
