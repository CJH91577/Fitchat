import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createDb, dbPath } from '../lib/db/index'
import { seedDatabase } from '../lib/db/seed'

// 先跑迁移，让 `npm run db:seed` 单独执行也能得到一个可用的库。
const path = dbPath()
mkdirSync(dirname(path), { recursive: true })

const db = createDb(path)
migrate(db, { migrationsFolder: './drizzle' })

const summary = seedDatabase(db)

console.log(`种子数据已写入：${path}`)
for (const [name, value] of Object.entries(summary)) {
  console.log(`  ${name.padEnd(16)} ${value}`)
}
console.log('重复执行是安全的：每次都会按邮箱重建演示用户及其全部记录。')

db.$client.close()
