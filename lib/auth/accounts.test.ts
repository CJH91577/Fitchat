import { eq } from 'drizzle-orm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { today } from '../data/today'
import { createD1Shim } from '../db/d1-shim'
import { DEMO_INVITE_CODES, DEMO_PASSWORD, DEMO_USER_EMAIL, DEMO_USER_ID } from '../db/demo'
import { type Db, createDb } from '../db/index'
import { applyMigrations } from '../db/migrate'
import { inviteCodeFor, userByEmail, userById } from '../db/queries'
import { users } from '../db/schema'
import { seedDatabase } from '../db/seed'
import { createInviteCodes } from '../db/writes'
import { normalizeEmail, normalizeInviteCode, register, signIn } from './accounts'
import { hashPassword } from './password'
import { ATTEMPT_WINDOW_MS, attemptKey, isRateLimited } from './rate-limit'
import { userBySessionToken } from './session'

/**
 * 账号规则：登录与邀请码注册。
 *
 * 用一份真的种子库（而不是内存里的假对象），因为这里要验的正是「规则落在库上
 * 是什么结果」：邀请码有没有被标记用掉、用户有没有被建出来、口令有没有被明文
 * 存进去。
 */

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-accounts-'))
let db: Db
let close: () => void
let codeSeq = 0

/** 每个用例自己发一张码，避免用例之间争抢同一张 */
async function freshCode(): Promise<string> {
  codeSeq += 1
  const code = `TEST-CODE-${codeSeq}`
  await createInviteCodes(db, [{ code }], new Date())
  return code
}

beforeAll(async () => {
  const path = join(tempDir, 'accounts.db')
  applyMigrations(path)
  const shim = createD1Shim(path)
  db = createDb(shim)
  close = () => shim.close()

  // 演示账号：口令是公开的那个（见 lib/db/demo.ts）
  await seedDatabase(db, { passwordHash: await hashPassword(DEMO_PASSWORD) })

  // 另建一个「没有口令」的账号：users.password_hash 允许为空，
  // 而这类账号绝不能被空口令登进去
  await db
    .insert(users)
    .values({
      id: 'no-password-user',
      email: 'nopassword@fitchat.local',
      passwordHash: null,
      heightCm: null,
      age: null,
      sex: null,
      startedAt: '2026-01-01',
      timezone: 'Asia/Shanghai',
      createdAt: new Date(),
    })
    .run()
})

afterAll(() => {
  close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('登录', () => {
  it('演示账号用公开口令能登进来，并拿到一个真会话', async () => {
    const result = await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect((await userBySessionToken(db, result.token))?.id).toBe(DEMO_USER_ID)
  })

  it('口令不对时给不出会话', async () => {
    const result = await signIn(db, DEMO_USER_EMAIL, 'wrong-password')
    expect(result).toEqual({ ok: false, message: '邮箱或口令不正确。' })
  })

  // 「邮箱不存在」与「口令不对」必须是同一句话：否则登录页就成了一台
  // 邮箱枚举器，谁都能拿它确认某个邮箱在这注册过
  it('邮箱不存在时的说法与口令不对时完全相同', async () => {
    const unknown = await signIn(db, 'nobody@fitchat.local', 'whatever-password')
    const wrongPassword = await signIn(db, DEMO_USER_EMAIL, 'wrong-password')
    expect(unknown).toEqual(wrongPassword)
  })

  it('邮箱大小写与首尾空格不影响登录', async () => {
    const result = await signIn(db, `  ${DEMO_USER_EMAIL.toUpperCase()}  `, DEMO_PASSWORD)
    expect(result.ok).toBe(true)
  })

  // 这条是安全底线：没有口令的账号不能因为「口令为空」就放行
  it('没有口令的账号，任何口令都登不进去', async () => {
    for (const attempt of ['', 'fitchat-demo', 'null']) {
      const result = await signIn(db, 'nopassword@fitchat.local', attempt)
      expect(result.ok, attempt).toBe(false)
    }
  })
})

describe('用邀请码注册', () => {
  it('新邮箱 + 未用过的码 → 建成账号，并顺带拿到会话', async () => {
    const code = await freshCode()
    const result = await register(db, { code, email: 'newbie@fitchat.local', password: 'a-good-password' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const user = await userByEmail(db, 'newbie@fitchat.local')
    expect(user).not.toBeNull()
    expect(user?.startedAt).toBe(today())
    // 资料三件套留空：首次引导里才填
    expect(user?.heightCm).toBeNull()
    expect(user?.age).toBeNull()
    expect(user?.sex).toBeNull()

    expect((await userBySessionToken(db, result.token))?.id).toBe(user?.id)
  })

  it('口令在库里是散列，不是明文', async () => {
    const code = await freshCode()
    const password = 'plaintext-should-not-be-stored'
    await register(db, { code, email: 'hash-check@fitchat.local', password })

    // 这里绕开查询层直接读那一列：passwordHash 刻意不在 DbUser 里，
    // 页面拿不到它，也就不可能失手渲染出来
    const stored = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, 'hash-check@fitchat.local'))
      .get()

    expect(stored?.passwordHash).toBeTruthy()
    expect(stored?.passwordHash).not.toBe(password)
    expect(stored?.passwordHash?.startsWith('scrypt$')).toBe(true)
  })

  it('刚注册完就能用同一个口令登录', async () => {
    const code = await freshCode()
    const email = 'roundtrip@fitchat.local'
    const password = 'roundtrip-password'
    await register(db, { code, email, password })

    expect((await signIn(db, email, password)).ok).toBe(true)
  })

  it('同一张码不能用第二次', async () => {
    const code = await freshCode()
    const first = await register(db, { code, email: 'first@fitchat.local', password: 'first-password' })
    expect(first.ok).toBe(true)

    const second = await register(db, { code, email: 'second@fitchat.local', password: 'second-password' })
    expect(second).toEqual({ ok: false, message: '这个邀请码已经用过了。' })
    // 第二次没有留下半个账号
    expect(await userByEmail(db, 'second@fitchat.local')).toBeNull()

    const row = await inviteCodeFor(db, code)
    expect(row?.usedByUserId).not.toBeNull()
    expect(row?.usedAt).not.toBeNull()
  })

  it('不存在的邀请码一律拒绝', async () => {
    const result = await register(db, {
      code: 'NOT-A-CODE',
      email: 'nobody-here@fitchat.local',
      password: 'a-good-password',
    })
    expect(result).toEqual({ ok: false, message: '邀请码不正确。' })
    expect(await userByEmail(db, 'nobody-here@fitchat.local')).toBeNull()
  })

  it('邮箱已注册时明确说清，而不是让人以为是码的问题', async () => {
    const code = await freshCode()
    const result = await register(db, { code, email: DEMO_USER_EMAIL, password: 'another-password' })
    expect(result).toEqual({ ok: false, message: '这个邮箱已经注册过了，直接登录即可。' })

    // 失败时那张码不该被消耗掉
    expect((await inviteCodeFor(db, code))?.usedByUserId).toBeNull()
  })

  it('邮箱格式与口令长度在进库之前就被挡住', async () => {
    const code = await freshCode()
    expect(await register(db, { code, email: 'not-an-email', password: 'a-good-password' })).toEqual({
      ok: false,
      message: '邮箱格式不正确。',
    })
    expect(await register(db, { code, email: 'short@fitchat.local', password: 'short' })).toEqual({
      ok: false,
      message: '口令至少 8 位。',
    })
    expect(await register(db, { code: '  ', email: 'nocode@fitchat.local', password: 'a-good-password' })).toEqual({
      ok: false,
      message: '请填写邀请码。',
    })
    expect(await userByEmail(db, 'short@fitchat.local')).toBeNull()
  })

  // 部署随附的码（README 里公开写着）真的能用——它们是陌生人注册的唯一入口
  it('随部署附送的邀请码可以注册', async () => {
    const code = DEMO_INVITE_CODES[0]
    const result = await register(db, {
      code: code.toLowerCase(),
      email: 'invited@fitchat.local',
      password: 'invited-password',
    })
    expect(result.ok, `用 ${code} 注册`).toBe(true)
    expect((await inviteCodeFor(db, code))?.usedByUserId).not.toBeNull()

    // 剩下的两张仍然是未使用状态
    for (const other of DEMO_INVITE_CODES.slice(1)) {
      expect((await inviteCodeFor(db, other))?.usedByUserId).toBeNull()
    }
  })

  it('演示账号始终在库里（种子数据与认证不冲突）', async () => {
    expect((await userById(db, DEMO_USER_ID))?.email).toBe(DEMO_USER_EMAIL)
  })
})

describe('失败频率限制', () => {
  // 每个用例用自己的键与固定的 now：键之间互不影响，窗口边界可以精确控制
  const NOW = 1_700_000_000_000

  it('同一键失败 10 次后，第 11 次连正确口令也被拒，直到窗口结束', async () => {
    const key = attemptKey('ip', '9.9.9.9')

    for (let i = 0; i < 10; i++) {
      const result = await signIn(db, 'victim@fitchat.local', 'wrong-password', [key], NOW)
      expect(result, `第 ${i + 1} 次`).toEqual({ ok: false, message: '邮箱或口令不正确。' })
    }

    // 到上限后，就算口令对了也不放行——否则这个限制形同虚设
    const locked = await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD, [key], NOW)
    expect(locked).toEqual({ ok: false, message: '尝试次数过多，请稍后再试。' })

    // 窗口一过，恢复
    const after = await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD, [key], NOW + ATTEMPT_WINDOW_MS + 1)
    expect(after.ok).toBe(true)
  })

  it('登录成功后清零：成功一次不该累积成下一次的锁定', async () => {
    const key = attemptKey('ip', '8.8.8.8')

    for (let i = 0; i < 5; i++) {
      await signIn(db, 'victim@fitchat.local', 'wrong-password', [key], NOW)
    }
    expect(await isRateLimited(db, key, NOW)).toBe(false)

    expect((await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD, [key], NOW)).ok).toBe(true)
    expect(await isRateLimited(db, key, NOW)).toBe(false)
  })

  it('邮箱键与 IP 键各自独立计数', async () => {
    const ipKey = attemptKey('ip', '7.7.7.7')
    const emailKey = attemptKey('email', 'someone-else@fitchat.local')

    for (let i = 0; i < 10; i++) {
      await signIn(db, 'victim@fitchat.local', 'wrong-password', [ipKey], NOW)
    }
    expect(await isRateLimited(db, ipKey, NOW)).toBe(true)

    // IP 键到上限，不影响另一个键
    expect((await signIn(db, DEMO_USER_EMAIL, DEMO_PASSWORD, [emailKey], NOW)).ok).toBe(true)
  })

  it('注册失败也计数：同一 IP 猜码 10 次后，第 11 次连正确的码也被拒', async () => {
    const key = attemptKey('ip', '6.6.6.6')
    const realCode = await freshCode()

    for (let i = 0; i < 10; i++) {
      const result = await register(
        db,
        { code: `WRONG-CODE-${i}`, email: `guesser-${i}@fitchat.local`, password: 'a-good-password' },
        [key],
        NOW,
      )
      expect(result.ok).toBe(false)
    }

    const locked = await register(
      db,
      { code: realCode, email: 'locked-reg@fitchat.local', password: 'a-good-password' },
      [key],
      NOW,
    )
    expect(locked).toEqual({ ok: false, message: '尝试次数过多，请稍后再试。' })
    // 被限流挡住的那次没有消耗邀请码
    expect((await inviteCodeFor(db, realCode))?.usedByUserId).toBeNull()
  })

  it('注册的格式错误（手滑）不计入失败次数', async () => {
    const key = attemptKey('ip', '5.5.5.5')

    for (let i = 0; i < 10; i++) {
      await register(db, { code: '', email: 'not-an-email', password: 'short' }, [key], NOW)
    }
    expect(await isRateLimited(db, key, NOW)).toBe(false)
  })
})

describe('规范化', () => {
  it('邮箱去空格并转小写', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  it('邀请码去空格并转大写（手工抄写不该因为大小写失败）', () => {
    expect(normalizeInviteCode(' fitchat-demo-1 ')).toBe('FITCHAT-DEMO-1')
  })
})
