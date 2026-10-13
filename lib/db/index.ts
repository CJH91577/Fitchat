import { drizzle, type AnyD1Database } from 'drizzle-orm/d1'
import type { D1Like } from './d1-shim'
import * as schema from './schema'

/**
 * 库文件位置。只有本地开发与测试需要它——线上是 Cloudflare D1 绑定，
 * 没有「文件路径」这个概念。
 *
 * 做成函数而不是模块级常量：测试要在渲染之前把 DATABASE_PATH 指到一份
 * 种好数据的临时库上，而模块级常量在 import 那一刻就被冻结了（ESM 的
 * import 先于文件里的任何语句执行）。
 */
export function dbPath(): string {
  return process.env.DATABASE_PATH ?? 'data/fitchat.db'
}

/**
 * 打开数据库。
 *
 * 参数是一个 D1：线上传真正的绑定，本地与测试传 lib/db/d1-shim 的兼容层。
 * 对上层完全一样——这就是整个 Worker 迁移只改这一处的原因。
 * 驱动选 drizzle-orm/d1 而不是 better-sqlite3，是为了让线上与本地
 * 走同一套查询代码，而不是「本地能跑、线上另有一套」。
 */
export function createDb(d1: D1Like) {
  return drizzle(d1 as unknown as AnyD1Database, { schema })
}

export type Db = ReturnType<typeof createDb>

export { schema }
