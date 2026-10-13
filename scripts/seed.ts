import { dbPath } from '../lib/db/index'
import { applyMigrations } from '../lib/db/migrate'
import { openLocalDb } from '../lib/db/runtime'
import { seedDatabase } from '../lib/db/seed'

// 先跑迁移，让 `npm run db:seed` 单独执行也能得到一个可用的库。
async function main(): Promise<void> {
  const path = dbPath()
  applyMigrations(path)

  const { db, close } = openLocalDb(path)
  try {
    const summary = await seedDatabase(db)
    console.log(`种子数据已写入：${path}`)
    for (const [name, value] of Object.entries(summary)) {
      console.log(`  ${name.padEnd(16)} ${value}`)
    }
    console.log('重复执行是安全的：每次都会按邮箱重建演示用户及其全部记录。')
  } finally {
    // Windows 上打开着的文件删不掉；脚本退出前关掉连接
    close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
