import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'

/**
 * 迁移器的行为契约。
 *
 * 这里不测「某份 SQL 建出的表对不对」（那是 schema.test.ts 的事），测的是
 * **迁移是在什么条件下执行的**。
 *
 * 起因是一次真实事故：0001 迁移要把 users 的资料列改成可空，而 SQLite 只能靠
 * 表重建做到（建新表 → 搬数据 → 删旧表 → 改名）。迁移文件里写了
 * `PRAGMA foreign_keys=OFF`，看起来万无一失——但 SQLite 里这句在**事务内是
 * 空操作**，而迁移器把每个迁移包在事务里。于是外键一直是开的，`DROP TABLE users`
 * 按 ON DELETE CASCADE 把演示用户的 1431 条饮食记录连同运动、体重、训练计划
 * 一起删了，而用户那一行还在：从界面上看就是「账号还在，数据没了」。
 *
 * 所以下面这条测试用一个假的迁移目录，把这个形状原样复现一遍。
 */

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-migrate-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

const BP = '--> statement-breakpoint'

/** 写一组迁移文件；调用方可以分两次写，模拟「老库里已经有数据，然后来了一个新迁移」 */
function writeMigrations(
  folder: string,
  entries: { tag: string; when: number; sql: string }[],
): void {
  mkdirSync(join(folder, 'meta'), { recursive: true })
  for (const entry of entries) {
    writeFileSync(join(folder, `${entry.tag}.sql`), entry.sql)
  }
  writeFileSync(
    join(folder, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'sqlite',
      entries: entries.map((entry, idx) => ({
        idx,
        version: '6',
        when: entry.when,
        tag: entry.tag,
        breakpoints: true,
      })),
    }),
  )
}

const INIT_SQL = [
  'CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL, `note` text NOT NULL)',
  'CREATE TABLE `child` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE)',
].join(BP)

// 重建 users：与 drizzle/0001 同一个形状（去掉 NOT NULL，所以必须重建）
const REBUILD_SQL = [
  'CREATE TABLE `__new_users` (`id` text PRIMARY KEY NOT NULL, `note` text)',
  'INSERT INTO `__new_users` (`id`, `note`) SELECT `id`, `note` FROM `users`',
  'DROP TABLE `users`',
  'ALTER TABLE `__new_users` RENAME TO `users`',
].join(BP)

describe('迁移器', () => {
  it('表重建迁移不会连带删掉子表数据（外键必须在迁移期间关掉）', () => {
    const folder = join(tempDir, 'case-cascade')
    const dbFile = join(tempDir, 'case-cascade.db')

    writeMigrations(folder, [{ tag: '0000_init', when: 1000, sql: INIT_SQL }])
    applyMigrations(dbFile, folder)

    const sqlite = new Database(dbFile)
    sqlite.pragma('foreign_keys = ON')
    sqlite.prepare('INSERT INTO users (id, note) VALUES (?, ?)').run('u1', '有数据的用户')
    sqlite.prepare('INSERT INTO child (id, user_id) VALUES (?, ?)').run('c1', 'u1')
    sqlite.prepare('INSERT INTO child (id, user_id) VALUES (?, ?)').run('c2', 'u1')
    sqlite.close()

    // 老库里有数据，然后来了一个新迁移
    writeMigrations(folder, [
      { tag: '0000_init', when: 1000, sql: INIT_SQL },
      { tag: '0001_rebuild', when: 2000, sql: REBUILD_SQL },
    ])
    expect(() => applyMigrations(dbFile, folder)).not.toThrow()

    const after = new Database(dbFile, { readonly: true })
    expect(after.prepare('SELECT COUNT(*) AS n FROM child').get()).toEqual({ n: 2 })
    expect(after.prepare('SELECT note FROM users WHERE id = ?').get('u1')).toEqual({
      note: '有数据的用户',
    })
    // 重建之后列变成可空（这才是这次迁移的目的）
    const note = (
      after.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[]
    ).find((column) => column.name === 'note')
    expect(note?.notnull).toBe(0)
    after.close()
  })

  it('迁移留下孤儿行时会直接失败，而不是把坏库交给应用', () => {
    const folder = join(tempDir, 'case-orphan')
    const dbFile = join(tempDir, 'case-orphan.db')

    writeMigrations(folder, [{ tag: '0000_init', when: 1000, sql: INIT_SQL }])
    applyMigrations(dbFile, folder)

    const sqlite = new Database(dbFile)
    sqlite.pragma('foreign_keys = ON')
    sqlite.prepare('INSERT INTO users (id, note) VALUES (?, ?)').run('u1', 'x')
    sqlite.prepare('INSERT INTO child (id, user_id) VALUES (?, ?)').run('c1', 'u1')
    sqlite.close()

    // 一个「删掉父行却留下子行」的坏迁移：外键在迁移期间是关的，数据库不会
    // 自己拦下来——所以必须由迁移器在事后检查
    writeMigrations(folder, [
      { tag: '0000_init', when: 1000, sql: INIT_SQL },
      { tag: '0001_orphan', when: 2000, sql: 'DELETE FROM `users` WHERE `id` = \'u1\'' },
    ])

    expect(() => applyMigrations(dbFile, folder)).toThrow(/引用完整性/)
  })
})
