import { hashPassword } from '../lib/auth/password'
import { addDays } from '../lib/data/dates'
import { today } from '../lib/data/today'
import { DEMO_INVITE_CODES, DEMO_PASSWORD } from '../lib/db/demo'
import { dbPath } from '../lib/db/index'
import { applyMigrations } from '../lib/db/migrate'
import { openLocalDb } from '../lib/db/runtime'
import { SEED_HORIZON_DAYS, seedDatabase } from '../lib/db/seed'

// 先跑迁移，让 `npm run db:seed` 单独执行也能得到一个可用的库。
async function main(): Promise<void> {
  const path = dbPath()
  applyMigrations(path)

  const { db, close } = openLocalDb(path)
  try {
    // 演示账号的口令：默认是公开的那个（见 lib/db/demo.ts），可用环境变量覆盖
    const password = process.env.DEMO_PASSWORD ?? DEMO_PASSWORD

    // 多播一段未来：演示站打开就该有内容，不能等到播种日之后就空掉
    const summary = await seedDatabase(db, {
      to: addDays(today(), SEED_HORIZON_DAYS),
      passwordHash: await hashPassword(password),
    })
    console.log(`种子数据已写入：${path}`)
    console.log(`  覆盖到 ${addDays(today(), SEED_HORIZON_DAYS)}（今天 + ${SEED_HORIZON_DAYS} 天）`)
    for (const [name, value] of Object.entries(summary)) {
      console.log(`  ${name.padEnd(16)} ${value}`)
    }
    console.log(`  演示账号          demo@fitchat.local / ${password}`)
    console.log(`  邀请码            ${DEMO_INVITE_CODES.join('、')}（各可用一次）`)
    console.log('重复执行是安全的：每次都会按邮箱重建演示用户及其全部记录，')
    console.log('已经用掉的邀请码不会被重置。')
  } finally {
    // Windows 上打开着的文件删不掉；脚本退出前关掉连接
    close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
