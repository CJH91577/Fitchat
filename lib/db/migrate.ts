import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import * as schema from './schema'

/**
 * 把迁移应用到**本地库文件**——服务进程、本地开发与测试都走这里。
 *（线上是同一套：容器里也是这个 SQLite 文件，只是挂在数据卷上。）
 *
 * 仍然借 better-sqlite3 的迁移器，而不是自己解析 SQL 文件：迁移的执行顺序
 * 与记账（__drizzle_migrations 表）交给 drizzle 自己管，免得两份实现日后分歧。
 * 用完即关——Windows 上打开着的文件删不掉，测试要清临时目录。
 *
 * 关于 migrationsFolder：它是相对**工作目录**解析的，而 Next 的 standalone
 * server 启动时会把工作目录切到 server.js 所在目录。所以容器镜像里 drizzle/
 * 必须与 server.js 同目录（见 Dockerfile）。找不到时这里给出明确提示——
 * 否则你只会看到 drizzle 内部一句「Can't find meta/_journal.json」，
 * 完全看不出是工作目录的问题。
 */
export function applyMigrations(
  path: string,
  migrationsFolder: string = process.env.MIGRATIONS_FOLDER ?? './drizzle',
): void {
  const journal = join(migrationsFolder, 'meta', '_journal.json')
  if (!existsSync(journal)) {
    throw new Error(
      `找不到迁移文件：${resolve(journal)}（当前工作目录 ${process.cwd()}）。` +
        '容器镜像里 drizzle/ 必须与 server.js 放在同一层；' +
        '本地调试可以用环境变量 MIGRATIONS_FOLDER 指定它的位置。',
    )
  }

  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite, { schema }), { migrationsFolder })
  sqlite.close()
}
