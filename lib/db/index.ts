import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/**
 * 库文件位置。可用 DATABASE_PATH 覆盖——测试指到临时库，部署时可以指到别的卷。
 *
 * 做成函数而不是模块级常量：测试要在渲染之前把 DATABASE_PATH 指到一份种好
 * 数据的临时库上，而模块级常量在 import 那一刻就被冻结了——ESM 的 import
 * 先于文件里的任何语句执行，测试根本来不及设环境变量。
 */
export function dbPath(): string {
  return process.env.DATABASE_PATH ?? 'data/fitchat.db'
}

/**
 * 打开一个数据库连接。
 *
 * 刻意不做成模块级的单例：脚本、测试与请求处理都需要各自控制生命周期
 * （测试要内存库、要能开完就关）。页面侧复用同一个连接的事由 runtime.getDb 负责。
 */
export function createDb(path: string = dbPath()) {
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
