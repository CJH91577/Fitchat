import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { addDays } from '../data/dates'
import { today } from '../data/today'
import { ensureDatabase } from './bootstrap'
import { DEMO_USER_ID } from './demo'
import { goalFor, userById, weightSeries } from './queries'
import { openLocalDb } from './runtime'
import { goals } from './schema'
import { SEED_HORIZON_DAYS } from './seed'

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-bootstrap-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

/** 把库路径指到临时目录里的一份库上，然后跑一次「首次启动」 */
async function bootstrapAt(name: string): Promise<string> {
  const path = join(tempDir, name)
  const previous = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = path
  try {
    await ensureDatabase()
  } finally {
    if (previous === undefined) delete process.env.DATABASE_PATH
    else process.env.DATABASE_PATH = previous
  }
  return path
}

describe('首次启动建库（容器启动走的就是这条路）', () => {
  it('库不存在时：建库、跑迁移、播种，并多播到 90 天之后', async () => {
    const path = await bootstrapAt('fresh.db')

    process.env.DATABASE_PATH = path
    const { db, close } = openLocalDb(path)
    try {
      const user = await userById(db, DEMO_USER_ID)
      if (!user) throw new Error('首次启动应当把演示用户建出来')
      expect(await goalFor(db, DEMO_USER_ID)).not.toBeNull()

      // 演示站必须是「打开就有内容」的：库里得有今天之后的数据，
      // 否则播种日一过，首页就开始显示「未记录」，看起来像坏了。
      const horizon = addDays(today(), SEED_HORIZON_DAYS)
      expect(horizon > today()).toBe(true)

      const series = await weightSeries(db, user, user.startedAt, horizon)
      expect(series.length).toBeGreaterThan(0)

      // 最后一条正好落在多播的终点
      expect(await weightSeries(db, user, horizon, horizon)).toHaveLength(1)
    } finally {
      close()
      delete process.env.DATABASE_PATH
    }
  })

  it('库里已有数据时不再播种——写入的记录不会被一次重启抹掉', async () => {
    const path = await bootstrapAt('existing.db')

    // 改一个值，再跑一次「启动」，改动必须活着
    process.env.DATABASE_PATH = path
    const first = openLocalDb(path)
    await first.db.update(goals).set({ calories: 1234 }).run()
    first.close()

    await ensureDatabase()

    const second = openLocalDb(path)
    const goal = await goalFor(second.db, DEMO_USER_ID)
    second.close()
    delete process.env.DATABASE_PATH

    expect(goal?.calories).toBe(1234)
  })
})
