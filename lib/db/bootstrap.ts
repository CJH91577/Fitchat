import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { addDays } from '../data/dates'
import { today } from '../data/today'
import { DEMO_USER_ID } from './demo'
import { dbPath } from './index'
import { applyMigrations } from './migrate'
import { userById } from './queries'
import { openLocalDb } from './runtime'
import { SEED_HORIZON_DAYS, seedDatabase } from './seed'

/**
 * 首次启动时把数据库准备出来：先跑迁移，库里还没有演示用户就播种。
 *
 * 由 instrumentation.ts 在服务进程启动时调用一次，于是容器**不需要**在启动
 * 前跑一堆 Node 脚本：镜像里只有 standalone 产物，建库逻辑就是应用自己的一部分。
 *
 * 两件都是幂等的：
 *   - 迁移由 drizzle 自己记账（__drizzle_migrations 表），重复执行安全；
 *   - 播种只在「演示用户不存在」时发生，所以重启容器、重建镜像都不会覆盖
 *     已有数据——写入（阶段 4）留下的记录不会因为一次部署而消失。
 *
 * 注意：这套「启动即迁移」只适合单实例。多实例并发启动时要改成独立的迁移步骤，
 * 否则两个进程会同时建表。本项目就是一台机器上跑一个容器，所以够用。
 */
export async function ensureDatabase(): Promise<void> {
  const path = dbPath()

  // 库文件所在目录可能还不存在（容器里是挂载的数据卷）
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  applyMigrations(path)

  const { db, close } = openLocalDb(path)
  try {
    const existing = await userById(db, DEMO_USER_ID)
    if (!existing) {
      await seedDatabase(db, { to: addDays(today(), SEED_HORIZON_DAYS) })
    }
  } finally {
    close()
  }
}
