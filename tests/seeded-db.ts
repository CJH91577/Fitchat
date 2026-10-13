import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'
import { createDb } from '../lib/db/index'
import { closeDb } from '../lib/db/runtime'
import { seedDatabase } from '../lib/db/seed'

/**
 * 给「读数据库的页面」的测试准备一份种子库，并把 DATABASE_PATH 指过去。
 *
 * 在测试文件的顶层调用一次即可。
 *
 * 之所以能生效，是因为 lib/db/index.ts 的 dbPath() 是在调用时读环境变量，
 * 而不是在 import 时冻结成常量。
 *
 * 名字刻意不以 use 开头：它跟 React 无关，而 ESLint 的
 * react-hooks/rules-of-hooks 只认前缀，会把顶层调用判成违规。
 */
export function setupSeededDatabase(): void {
  const dir = mkdtempSync(join(tmpdir(), 'fitchat-page-'))
  const path = join(dir, 'test.db')

  process.env.DATABASE_PATH = path

  const db = createDb(path)
  migrate(db, { migrationsFolder: './drizzle' })
  seedDatabase(db)
  db.$client.close()

  afterAll(() => {
    // 先关掉页面复用的那个连接：Windows 上打开着的文件删不掉，
    // 直接 rmSync 会以 EPERM 失败。
    closeDb()
    rmSync(dir, { recursive: true, force: true })
  })
}
