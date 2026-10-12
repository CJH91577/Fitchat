import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/**
 * 默认库文件位置。可用 DATABASE_PATH 覆盖——测试传 ':memory:'，
 * 部署时可以指到别的卷。
 */
export const DEFAULT_DB_PATH = process.env.DATABASE_PATH ?? 'data/fitchat.db'

/**
 * 打开一个数据库连接。
 *
 * 刻意不做成模块级的单例：脚本、测试与将来的请求处理都需要各自控制
 * 生命周期（测试要内存库、要能开完就关）。阶段 2 接入页面时再按运行时
 * 决定是复用连接还是每次开。
 */
export function createDb(path: string = DEFAULT_DB_PATH) {
  const sqlite = new Database(path)

  // SQLite 默认**不校验外键**——不显式打开的话，schema 里的 references()
  // 只是一份文档，删用户不会连带删掉他的记录。
  sqlite.pragma('foreign_keys = ON')

  // WAL 让读写不互相阻塞；内存库不支持，跳过。
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL')

  return drizzle(sqlite, { schema })
}

export type Db = ReturnType<typeof createDb>

export { schema }
