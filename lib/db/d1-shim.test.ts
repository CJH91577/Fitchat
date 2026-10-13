import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createD1Shim } from './d1-shim'
import { createDb } from './index'
import { applyMigrations } from './migrate'
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

let reference: ReturnType<typeof drizzleSqlite>
let shim: ReturnType<typeof createD1Shim>
let d1Db: ReturnType<typeof drizzleD1>

beforeAll(async () => {
  // 先用迁移 + 种子把库建出来
  applyMigrations(dbFile)
  const seeding = createD1Shim(dbFile)
  await seedDatabase(createDb(seeding))
  seeding.close()

  // 参照物：原来的 better-sqlite3 路径
  reference = drizzleSqlite(new Database(dbFile), { schema })
  shim = createD1Shim(dbFile)
  d1Db = drizzleD1(shim as never, { schema })
})

afterAll(() => {
  // 先关掉两侧的连接，否则 Windows 上删不掉这个目录
  reference.$client.close()
  shim.close()
  rmSync(tempDir, { recursive: true, force: true })
})

const DATE = '2026-10-12'

describe('D1 兼容层：与 SQLite 驱动行为一致', () => {
  it('select + where + orderBy 的结果与原驱动一致', async () => {
    const viaD1 = await d1Db
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .orderBy(schema.foodEntries.id)
      .all()

    const viaSqlite = reference
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .orderBy(schema.foodEntries.id)
      .all()

    expect(viaD1.length).toBeGreaterThan(0)
    expect(viaD1).toEqual(viaSqlite)
  })

  it('聚合结果一致（实测的当日摄入 1597 千卡）', async () => {
    const rows = await d1Db
      .select({ calories: schema.foodEntries.calories })
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.date, DATE))
      .all()

    expect(rows.reduce((s, r) => s + r.calories, 0)).toBe(1597)
  })

  it('写入后能读回', async () => {
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

  it('batch：查询与写入混排也一起生效', async () => {
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
    const rows = (await statement.bind(DATE).raw()) as unknown[]

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual([DATE, expect.any(Number)])
  })
})

describe('本地库的行为（兼容层负责）', () => {
  it('打开外键约束——否则 schema 里的 references 只是一份文档', async () => {
    const local = createD1Shim(join(tempDir, 'fk.db'))
    applyMigrations(join(tempDir, 'fk.db'))

    // 插一条指向不存在用户的记录，应当被外键拦下
    await expect(
      local
        .prepare('INSERT INTO weight_entries (user_id, date, kg, created_at) VALUES (?, ?, ?, ?)')
        .bind('nobody', '2026-01-01', 70, Date.now())
        .run(),
    ).rejects.toThrow()

    local.close()
  })

  it('文件库启用 WAL（内存库不支持，跳过）', async () => {
    const local = createD1Shim(join(tempDir, 'wal.db'))
    const rows = (await local.prepare('PRAGMA journal_mode').all()) as unknown as {
      results: { journal_mode: string }[]
    }
    expect(rows.results[0].journal_mode).toBe('wal')
    local.close()
  })

  it('关掉连接再打开，数据还在', async () => {
    const path = join(tempDir, 'persist.db')
    applyMigrations(path)

    const first = createD1Shim(path)
    await seedDatabase(createDb(first), { from: '2025-09-22', to: '2025-09-25' })
    first.close()

    // 换一个连接读同一个文件：这才是「真的落库了」，而不是活在进程内存里。
    const second = createD1Shim(path)
    const rows = (await second.prepare('SELECT COUNT(*) AS n FROM users').all()) as unknown as {
      results: { n: number }[]
    }
    expect(rows.results[0].n).toBe(1)
    second.close()
  })
})
