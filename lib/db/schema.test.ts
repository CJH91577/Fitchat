import Database from 'better-sqlite3'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import {
  exerciseEntries,
  foodEntries,
  foods,
  goals,
  inviteCodes,
  loginAttempts,
  planDays,
  planItems,
  sessions,
  strengthSets,
  users,
  weightEntries,
} from './schema'

/**
 * 迁移 SQL 与 schema 定义的契约。
 *
 * drizzle/0000_init.sql 是手写的（生成环境禁止 esbuild 拉子进程，跑不了
 * drizzle-kit），所以「SQL 与 schema.ts 是否一致」必须由测试来保证：
 * 把迁移应用到一个全新的库上，再逐表逐列与 Drizzle 自己的定义比对。
 *
 * 少了这道关卡，两者的漂移不会有任何症状——构建通过、lint 通过、
 * 页面照常跑，直到某天线上查询报「no such column」。
 *
 * 内省直接开一个 better-sqlite3 连接做：这里验的是「迁移建出来的表结构」，
 * 与运行期用哪个驱动无关。
 */

const TABLES = {
  users,
  sessions,
  inviteCodes,
  loginAttempts,
  goals,
  foods,
  foodEntries,
  exerciseEntries,
  strengthSets,
  weightEntries,
  planDays,
  planItems,
}

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-schema-'))
const dbFile = join(tempDir, 'schema.db')

let sqlite: InstanceType<typeof Database>

beforeAll(() => {
  applyMigrations(dbFile)
  sqlite = new Database(dbFile, { readonly: true })
})

afterAll(() => {
  sqlite.close()
  rmSync(tempDir, { recursive: true, force: true })
})

type ColumnInfo = { name: string; notnull: 0 | 1; pk: number }

function columnsOf(table: string): ColumnInfo[] {
  // PRAGMA 不支持绑定参数，表名只能拼接；名字全部来自本项目自己的 schema。
  return sqlite.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

function indexNamesOf(table: string): string[] {
  return (sqlite.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[]).map(
    (row) => row.name,
  )
}

function tableNamesInDb(): string[] {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[]
  return rows
    .map((row) => row.name)
    .filter((name) => !name.startsWith('sqlite_') && !name.startsWith('__drizzle'))
    .sort()
}

describe('迁移 SQL 与 schema 定义一致', () => {
  it('库里的表与 schema 里声明的表完全相同', () => {
    const declared = Object.values(TABLES)
      .map((table) => getTableConfig(table).name)
      .sort()
    expect(tableNamesInDb()).toEqual(declared)
  })

  it('每张表的列名与非空约束都与 schema 一致', () => {
    const problems: string[] = []

    for (const table of Object.values(TABLES)) {
      const cfg = getTableConfig(table)
      const actual = new Map(columnsOf(cfg.name).map((c) => [c.name, c.notnull === 1]))
      const expected = cfg.columns.map((c) => ({ name: c.name, notNull: c.notNull }))

      for (const column of expected) {
        if (!actual.has(column.name)) {
          problems.push(`${cfg.name}.${column.name} 在 SQL 里不存在`)
        } else if (actual.get(column.name) !== column.notNull) {
          problems.push(
            `${cfg.name}.${column.name} 的非空约束不一致：SQL=${actual.get(column.name)}，schema=${column.notNull}`,
          )
        }
      }

      const expectedNames = new Set(expected.map((c) => c.name))
      for (const name of actual.keys()) {
        if (!expectedNames.has(name)) problems.push(`${cfg.name}.${name} 只存在于 SQL 里`)
      }
    }

    expect(problems).toEqual([])
  })

  it('主键列一致，复合主键也不能漏', () => {
    const problems: string[] = []

    for (const table of Object.values(TABLES)) {
      const cfg = getTableConfig(table)

      // Drizzle 把列级主键记在 column.primary 上（不是 primaryKey），
      // 表级复合主键则在 primaryKeys 里——两处都要收。
      const expected = new Set<string>(cfg.columns.filter((c) => c.primary).map((c) => c.name))
      for (const pk of cfg.primaryKeys) {
        for (const column of pk.columns) expected.add(column.name)
      }

      const actual = columnsOf(cfg.name)
        .filter((c) => c.pk > 0)
        .map((c) => c.name)

      const sortedExpected = [...expected].sort()
      const sortedActual = [...actual].sort()
      if (sortedExpected.join(',') !== sortedActual.join(',')) {
        problems.push(
          `${cfg.name} 主键不一致：SQL=[${sortedActual.join(',')}]，schema=[${sortedExpected.join(',')}]`,
        )
      }
    }

    expect(problems).toEqual([])
  })

  it('schema 里声明的每个索引都真实建出来了', () => {
    const problems: string[] = []

    for (const table of Object.values(TABLES)) {
      const cfg = getTableConfig(table)
      const actual = indexNamesOf(cfg.name)

      for (const idx of cfg.indexes) {
        const name = idx.config.name
        if (typeof name !== 'string') continue
        if (!actual.includes(name)) problems.push(`${cfg.name} 缺少索引 ${name}`)
      }
    }

    expect(problems).toEqual([])
  })
})
