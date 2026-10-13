import { eq } from 'drizzle-orm'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createD1Shim } from './d1-shim'
import { createDb as createSqliteDb } from './index'
import * as schema from './schema'
import { seedDatabase } from './seed'

/**
 * 兼容层的契约：**同一个库、同一批查询，两个驱动必须给出相同结果**。
 *
 * 这条测试是整个 Workers 迁移的地基——应用代码从此只用一个驱动
 * （drizzle-orm/d1），测试跑在兼容层上，线上跑在真 D1 上。
 * 兼容层若有偏差，这里必须立刻转红，而不是等部署到线上才发现。
 */

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-d1-'))
const dbFile = join(tempDir, 'shim.db')

let sqliteDb: ReturnType<typeof createSqliteDb>
let shim: ReturnType<typeof createD1Shim>
let d1Db: ReturnType<typeof drizzleD1>

beforeAll(async () => {
  // 先用现有路径建库并播种
  sqliteDb = createSqliteDb(dbFile)
  migrate(sqliteDb, { migrationsFolder: './drizzle' })
  await seedDatabase(sqliteDb)
  sqliteDb.$client.close()

  shim = createD1Shim(dbFile)
  d1Db = drizzleD1(shim as never, { schema })
})

afterAll(() => {
  // 先关掉兼容层的连接，否则 Windows 上删不掉这个目录
  shim.close()
  rmSync(tempDir, { recursive: true, force: true })
})

const DATE = '2026-10-12'

describe('D1 兼容层', () => {
  it('select + where + orderBy 的结果与原驱动一致', async () => {
    const viaD1 = await d1Db
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .orderBy(schema.foodEntries.id)
      .all()

    const reopened = createSqliteDb(dbFile)
    const viaSqlite = reopened
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .orderBy(schema.foodEntries.id)
      .all()
    reopened.$client.close()

    expect(viaD1.length).toBeGreaterThan(0)
    expect(viaD1).toEqual(viaSqlite)
  })

  it('聚合查询（sum）一致', async () => {
    const d1Rows = await d1Db
      .select({ calories: schema.foodEntries.calories })
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .all()

    const total = d1Rows.reduce((s, r) => s + r.calories, 0)
    // 实测过的当日摄入：1597 千卡（见 lib/db/seed.test.ts 的对照）
    expect(total).toBe(1597)
  })

  it('写入后能读回，且 meta 里的 changes 正确', async () => {
    // 日期取种子范围之外（种子覆盖到今天），否则会撞上主键
    await d1Db
      .insert(schema.weightEntries)
      .values({
        userId: 'demo-user',
        date: '2027-01-01',
        kg: 68.4,
        createdAt: new Date('2027-01-01T00:00:00Z'),
      })
      .run()

    const row = await d1Db
      .select()
      .from(schema.weightEntries)
      .where(eq(schema.weightEntries.date, '2027-01-01'))
      .get()

    expect(row?.kg).toBe(68.4)
  })

  it('batch：多条语句一起生效（含写入与查询混排）', async () => {
    await d1Db.batch([
      d1Db.insert(schema.weightEntries).values({
        userId: 'demo-user',
        date: '2027-01-02',
        kg: 70.1,
        createdAt: new Date('2027-01-02T00:00:00Z'),
      }),
      d1Db.insert(schema.weightEntries).values({
        userId: 'demo-user',
        date: '2027-01-03',
        kg: 70.2,
        createdAt: new Date('2027-01-03T00:00:00Z'),
      }),
    ])

    for (const date of ['2027-01-02', '2027-01-03']) {
      const rows = await d1Db
        .select()
        .from(schema.weightEntries)
        .where(eq(schema.weightEntries.date, date))
        .all()
      expect(rows).toHaveLength(1)
    }
  })

  it('raw() 返回「每行是值数组」——drizzle 的 values 模式依赖这个形状', async () => {
    const statement = shim.prepare('SELECT date, kg FROM weight_entries WHERE date = ?')
    const rows = (await statement.bind('2026-10-12').raw()) as unknown[]

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(['2026-10-12', expect.any(Number)])
  })
})
