import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DEFAULT_DB_PATH, createDb } from '../lib/db/index'

// migrationsFolder 用相对路径：npm 脚本总是在项目根目录执行。
// 库文件所在目录可能还不存在（data/ 被 gitignore 排除），先建出来。
mkdirSync(dirname(DEFAULT_DB_PATH), { recursive: true })

const db = createDb()
migrate(db, { migrationsFolder: './drizzle' })
console.log(`迁移已应用：${DEFAULT_DB_PATH}`)
db.$client.close()
