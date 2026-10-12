import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DEFAULT_DB_PATH, createDb } from '../lib/db/index'
import { seedDatabase } from '../lib/db/seed'

// 先跑迁移，让 `npm run db:seed` 单独执行也能得到一个可用的库。
mkdirSync(dirname(DEFAULT_DB_PATH), { recursive: true })

const db = createDb()
migrate(db, { migrationsFolder: './drizzle' })

const summary = seedDatabase(db)

console.log(`种子数据已写入：${DEFAULT_DB_PATH}`)
for (const [name, value] of Object.entries(summary)) {
  console.log(`  ${name.padEnd(16)} ${value}`)
}
console.log('重复执行是安全的：每次都会按邮箱重建演示用户及其全部记录。')

db.$client.close()
