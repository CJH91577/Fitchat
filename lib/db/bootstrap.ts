import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { hashPassword } from '../auth/password'
import { addDays } from '../data/dates'
import { today } from '../data/today'
import { DEMO_INVITE_CODES, DEMO_PASSWORD, DEMO_USER_ID } from './demo'
import { dbPath } from './index'
import { applyMigrations } from './migrate'
import { userById } from './queries'
import { openLocalDb } from './runtime'
import { SEED_HORIZON_DAYS, STARTER_FOODS, seedDatabase, starterFoodRow } from './seed'
import { createInviteCodes, ensureFoodLibrary, setPasswordHashIfMissing } from './writes'

/**
 * 首次启动时把数据库准备出来：先跑迁移，库里还没有演示用户就播种。
 *
 * 由 instrumentation.ts 在服务进程启动时调用一次，于是容器**不需要**在启动
 * 前跑一堆 Node 脚本：镜像里只有 standalone 产物，建库逻辑就是应用自己的一部分。
 *
 * 三件都是幂等的：
 *   - 迁移由 drizzle 自己记账（__drizzle_migrations 表），重复执行安全；
 *   - 播种只在「演示用户不存在」时发生，所以重启容器、重建镜像都不会覆盖
 *     已有数据——写入（阶段 4）留下的记录不会因为一次部署而消失；
 *   - 邀请码与演示口令是「补齐」而不是「重建」：缺了才加，已有的一律不动。
 *
 * 后一条是升级路径里必须的。这两样都只在「播种」那一步产生，而升级一个**已经
 * 跑起来的**站点时，演示用户早就在库里了——播种整段会被跳过，于是新加的邀请码
 * 永远不出现（谁都注册不了），文档里公开的演示口令也永远登不进去。
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
      // 口令散列只在真的要播种时才算：scrypt 要几十毫秒，不该让每次启动都付
      const passwordHash = await hashPassword(process.env.DEMO_PASSWORD ?? DEMO_PASSWORD)
      await seedDatabase(db, { to: addDays(today(), SEED_HORIZON_DAYS), passwordHash })
    } else {
      // 已有演示账号：只补它缺的东西（见上面的说明）
      const passwordHash = await hashPassword(process.env.DEMO_PASSWORD ?? DEMO_PASSWORD)
      await setPasswordHashIfMissing(db, DEMO_USER_ID, passwordHash)
    }

    // 邀请码每次都「补齐」：已发出的（尤其是已用掉的）一个都不动，
    // 只把库里还没有的那些加进去
    await createInviteCodes(
      db,
      DEMO_INVITE_CODES.map((code) => ({ code, note: '随部署附送，公开' })),
      new Date(),
    )

    // 食物库同理：新版本往里加了常用单品，已跑起来的站点不会重新播种，
    // 不补这一步，升级后说「两个鸡蛋」会一个食物都匹配不上
    await ensureFoodLibrary(
      db,
      STARTER_FOODS.map((_, index) => starterFoodRow(index)),
    )
  } finally {
    close()
  }
}
