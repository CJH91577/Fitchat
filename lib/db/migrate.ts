import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'

/**
 * 把迁移应用到**本地库文件**——测试与本地开发用。
 *
 * 线上不走这里：D1 的迁移由 `wrangler d1 migrations apply` 负责。
 *
 * 仍然借 better-sqlite3 的迁移器，而不是自己解析 SQL 文件：迁移的执行顺序
 * 与记账（__drizzle_migrations 表）交给 drizzle 自己管，免得两份实现日后分歧。
 * 用完即关——Windows 上打开着的文件删不掉，测试要清临时目录。
 */
export function applyMigrations(path: string): void {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite, { schema }), { migrationsFolder: './drizzle' })
  sqlite.close()
}
