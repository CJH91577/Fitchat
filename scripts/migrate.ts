import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createDb, dbPath } from '../lib/db/index'

// migrationsFolder 用相对路径：npm 脚本总是在项目根目录执行。
// 库文件所在目录可能还不存在（data/ 被 gitignore 排除），先建出来。
const path = dbPath()
mkdirSync(dirname(path), { recursive: true })

const db = createDb(path)
migrate(db, { migrationsFolder: './drizzle' })
console.log(`迁移已应用：${path}`)
db.$client.close()
