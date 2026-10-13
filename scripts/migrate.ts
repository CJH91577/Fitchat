import { dbPath } from '../lib/db/index'
import { applyMigrations } from '../lib/db/migrate'

// migrationsFolder 用相对路径：npm 脚本总是在项目根目录执行。
const path = dbPath()
applyMigrations(path)

console.log(`迁移已应用：${path}`)
