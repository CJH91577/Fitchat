import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createD1Shim } from '../db/d1-shim'
import { type Db, createDb } from '../db/index'
import { applyMigrations } from '../db/migrate'
import { sessions, users } from '../db/schema'
import {
  SESSION_TTL_MS,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  hashSessionToken,
  newSessionToken,
  userBySessionToken,
} from './session'

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-session-'))

let db: Db
let close: () => void

const ALICE = 'user-alice'
const BOB = 'user-bob'

beforeAll(async () => {
  const path = join(tempDir, 'session.db')
  applyMigrations(path)
  const shim = createD1Shim(path)
  db = createDb(shim)
  close = () => shim.close()

  const now = new Date()
  await db
    .insert(users)
    .values(
      [ALICE, BOB].map((id) => ({
        id,
        email: `${id}@fitchat.local`,
        passwordHash: null,
        heightCm: 175,
        age: 30,
        sex: 'male' as const,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: now,
      })),
    )
    .run()
})

afterAll(() => {
  close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('会话', () => {
  it('库里存的是令牌的哈希，不是令牌本身', async () => {
    const { token } = await createSession(db, ALICE)

    const rows = await db.select().from(sessions).all()
    const ids = rows.map((row) => row.id)

    expect(ids).not.toContain(token)
    expect(ids).toContain(hashSessionToken(token))
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/)

    await deleteSession(db, token)
  })

  it('令牌是 32 字节随机数，两次不同', () => {
    const a = newSessionToken()
    const b = newSessionToken()
    expect(a).not.toBe(b)
    // base64url 编码 32 字节 = 43 个字符，且只含 URL 安全字符
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('令牌能换回用户', async () => {
    const { token } = await createSession(db, ALICE)
    const user = await userBySessionToken(db, token)
    expect(user?.id).toBe(ALICE)
    await deleteSession(db, token)
  })

  it('空令牌、乱造的令牌、别的用户的令牌都换不回这个人', async () => {
    const { token: aliceToken } = await createSession(db, ALICE)
    const { token: bobToken } = await createSession(db, BOB)

    expect(await userBySessionToken(db, '')).toBeNull()
    expect(await userBySessionToken(db, 'not-a-real-token')).toBeNull()
    // bob 的令牌解析出来必须是 bob，绝不能是 alice
    expect((await userBySessionToken(db, bobToken))?.id).toBe(BOB)

    await deleteSession(db, aliceToken)
    await deleteSession(db, bobToken)
  })

  it('同一用户可以同时有多个会话（多设备），退出一个不影响另一个', async () => {
    const phone = await createSession(db, ALICE)
    const laptop = await createSession(db, ALICE)

    expect((await userBySessionToken(db, phone.token))?.id).toBe(ALICE)
    expect((await userBySessionToken(db, laptop.token))?.id).toBe(ALICE)

    await deleteSession(db, phone.token)
    expect(await userBySessionToken(db, phone.token)).toBeNull()
    expect((await userBySessionToken(db, laptop.token))?.id).toBe(ALICE)

    await deleteSession(db, laptop.token)
  })

  it('会话过期后换不回用户，并且那一行会被顺手删掉', async () => {
    const created = new Date('2026-01-01T00:00:00Z')
    const { token, expiresAt } = await createSession(db, ALICE, created)
    expect(expiresAt.getTime() - created.getTime()).toBe(SESSION_TTL_MS)

    // 过期前一毫秒还有效
    expect((await userBySessionToken(db, token, new Date(expiresAt.getTime() - 1)))?.id).toBe(ALICE)

    // 到期即失效
    expect(await userBySessionToken(db, token, expiresAt)).toBeNull()

    const rows = await db.select().from(sessions).all()
    expect(rows.map((row) => row.id)).not.toContain(hashSessionToken(token))
  })

  it('清理只删过期的，不动还有效的', async () => {
    const created = new Date('2026-01-01T00:00:00Z')
    const expired = await createSession(db, ALICE, created)
    const alive = await createSession(db, BOB, new Date())

    await deleteExpiredSessions(db, new Date())

    const ids = (await db.select().from(sessions).all()).map((row) => row.id)
    expect(ids).not.toContain(hashSessionToken(expired.token))
    expect(ids).toContain(hashSessionToken(alive.token))

    await deleteSession(db, alive.token)
  })
})
