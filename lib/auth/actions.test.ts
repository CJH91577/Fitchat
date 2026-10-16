import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_PASSWORD, DEMO_USER_EMAIL, DEMO_USER_ID } from '../db/demo'
import { getDb } from '../db/runtime'
import { inviteCodeFor } from '../db/queries'
import { sessions } from '../db/schema'
import { createInviteCodes } from '../db/writes'
import { registerAction, resetPasswordAction, signInAction, signInAsDemoAction, signOutAction } from './actions'
import { createResetCode } from './reset'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { hashSessionToken } from './session'
import { setupSeededDatabase } from '@/tests/seeded-db'

/**
 * Server Action 这一层：读表单 → 调规则 → 写 Cookie → 跳转。
 *
 * 用 vi.hoisted 拿到 Cookie 那几个函数的替身（工厂函数被提升到 import 之前，
 * 不能引用文件末尾才初始化的变量，这是 vi.hoisted 存在的理由）。规则本身
 * 在 lib/auth/accounts.test.ts 里测，这里测的是**接线接对了没有**：
 * 令牌有没有写进 Cookie、会话行有没有真的落库、跳转目标对不对。
 */

const cookie = vi.hoisted(() => ({
  readSessionToken: vi.fn(async (): Promise<string | null> => null),
  // 参数写出来是为了让 mock.calls 有类型：下面的断言要读「写进去的那个令牌」。
  // 函数体里不做事，void 掉是为了不引出 lint 告警。
  writeSessionCookie: vi.fn(async (token: string, expiresAt: Date): Promise<void> => {
    void token
    void expiresAt
  }),
  clearSessionCookie: vi.fn(async (): Promise<void> => {}),
}))

vi.mock('@/lib/auth/cookie', () => cookie)

// 限流键里的 IP 来自 lib/auth/ip.ts；每个用例可以换一个自己的地址，
// 避免「同 IP 失败次数」在用例之间累积
const ip = vi.hoisted(() => ({ value: '1.2.3.4' }))
vi.mock('@/lib/auth/ip', () => ({ clientIp: vi.fn(async () => ip.value) }))

vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { redirect: redirectMock }
})

setupSeededDatabase()

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

/** 断言这次 action 调用的结果是「跳到了某个地址」 */
async function expectRedirect(run: () => Promise<unknown>, to: string): Promise<void> {
  try {
    await run()
  } catch (error) {
    expect(redirectTarget(error), String(error)).toBe(to)
    return
  }
  throw new Error(`本该跳到 ${to}，但调用正常返回了`)
}

/** Cookie 里刚写下的那个令牌，在库里对应的会话行 */
async function sessionRowForWrittenToken(index = -1) {
  const calls = cookie.writeSessionCookie.mock.calls
  const token = calls.at(index)?.[0]
  expect(typeof token).toBe('string')
  return db().select().from(sessions).where(eq(sessions.id, hashSessionToken(token as string))).get()
}

const db = () => getDb()

// 限流按 IP 计数，而这里所有用例共享一份种子库——每个用例开始前把 IP
// 恢复成默认值，避免上一个用例留下的失败次数影响下一个
beforeEach(() => {
  ip.value = '1.2.3.4'
})

describe('登录', () => {
  it('口令正确：写 Cookie、建会话、跳到首页', async () => {
    cookie.readSessionToken.mockResolvedValue(null)
    cookie.writeSessionCookie.mockClear()

    await expectRedirect(
      () => signInAction({ error: null }, formData({ email: DEMO_USER_EMAIL, password: DEMO_PASSWORD })),
      '/',
    )

    // Cookie 里那个令牌必须真的能在库里换出演示用户——只写 Cookie 不落库，
    // 浏览器下一次请求就会被踢回登录页
    expect(await sessionRowForWrittenToken()).toMatchObject({ userId: DEMO_USER_ID })
  })

  it('口令不对：返回一句明确的错误，不写 Cookie 也不跳转', async () => {
    cookie.writeSessionCookie.mockClear()

    const state = await signInAction(
      { error: null },
      formData({ email: DEMO_USER_EMAIL, password: 'wrong-password' }),
    )

    expect(state).toEqual({ error: '邮箱或口令不正确。' })
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled()
  })

  it('登录时顺手清掉过期会话，但不碰还有效的', async () => {
    const now = Date.now()
    const expired = hashSessionToken('expired-token')
    await db()
      .insert(sessions)
      .values({
        id: expired,
        userId: DEMO_USER_ID,
        expiresAt: new Date(now - 1000),
        createdAt: new Date(now - 100000),
      })
      .run()

    cookie.writeSessionCookie.mockClear()
    await expectRedirect(
      () => signInAction({ error: null }, formData({ email: DEMO_USER_EMAIL, password: DEMO_PASSWORD })),
      '/',
    )

    expect(await db().select().from(sessions).where(eq(sessions.id, expired)).get()).toBeUndefined()
    expect(await sessionRowForWrittenToken()).toMatchObject({ userId: DEMO_USER_ID })
  })

  it('同一来源失败 10 次后，第 11 次连正确口令也被拒', async () => {
    ip.value = '10.0.0.99'
    cookie.writeSessionCookie.mockClear()

    for (let i = 0; i < 10; i++) {
      const state = await signInAction(
        { error: null },
        formData({ email: 'locked@fitchat.local', password: 'wrong-password' }),
      )
      expect(state, `第 ${i + 1} 次`).toEqual({ error: '邮箱或口令不正确。' })
    }

    // 到上限后，就算口令对了也不放行——否则这个限制形同虚设
    const locked = await signInAction(
      { error: null },
      formData({ email: 'locked@fitchat.local', password: 'correct-password' }),
    )
    expect(locked).toEqual({ error: '尝试次数过多，请稍后再试。' })
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled()
  })
})

describe('注册', () => {
  it('邀请码正确：建账号、写 Cookie、跳到首次引导', async () => {
    const code = `ACTION-CODE-${randomUUID().slice(0, 8)}`.toUpperCase()
    await createInviteCodes(db(), [{ code }], new Date())
    cookie.writeSessionCookie.mockClear()

    await expectRedirect(
      () =>
        registerAction(
          { error: null },
          formData({ code, email: 'action-user@fitchat.local', password: 'a-good-password' }),
        ),
      '/onboarding',
    )

    const session = await sessionRowForWrittenToken()
    expect(session?.userId).toBeTruthy()
    expect(session?.userId).not.toBe(DEMO_USER_ID)

    const invite = await inviteCodeFor(db(), code)
    expect(invite?.usedByUserId).toBe(session?.userId)
  })

  it('邀请码不对：一句明确的话，不建账号', async () => {
    cookie.writeSessionCookie.mockClear()

    const state = await registerAction(
      { error: null },
      formData({ code: 'definitely-wrong', email: 'nobody@fitchat.local', password: 'a-good-password' }),
    )

    expect(state).toEqual({ error: '邀请码不正确。' })
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled()
  })
})

describe('口令找回', () => {
  it('正确的重置码：设新口令、写 Cookie、直接进入首页', async () => {
    const created = await createResetCode(db(), DEMO_USER_EMAIL)
    if (!created.ok) throw new Error('应该能生成重置码')
    cookie.writeSessionCookie.mockClear()

    await expectRedirect(
      () =>
        resetPasswordAction(
          { error: null },
          formData({ email: DEMO_USER_EMAIL, code: created.code, password: 'a-reset-password' }),
        ),
      '/',
    )

    expect(await sessionRowForWrittenToken()).toMatchObject({ userId: DEMO_USER_ID })
  })

  it('重置码不对：一句明确的话，不写 Cookie', async () => {
    cookie.writeSessionCookie.mockClear()

    const state = await resetPasswordAction(
      { error: null },
      formData({ email: DEMO_USER_EMAIL, code: 'NOT-A-CODE', password: 'a-reset-password' }),
    )

    expect(state).toEqual({ error: '重置码不正确或已过期。' })
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled()
  })
})

describe('演示入口与退出', () => {
  it('一键进演示账号：就是演示用户本人的会话', async () => {
    cookie.writeSessionCookie.mockClear()

    await expectRedirect(() => signInAsDemoAction(), '/')
    expect(await sessionRowForWrittenToken()).toMatchObject({ userId: DEMO_USER_ID })
  })

  it('退出：先删掉库里那一行，再清 Cookie，最后跳登录页', async () => {
    const token = 'a-session-token-to-revoke'
    await db()
      .insert(sessions)
      .values({
        id: hashSessionToken(token),
        userId: DEMO_USER_ID,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      })
      .run()

    cookie.readSessionToken.mockResolvedValue(token)
    cookie.clearSessionCookie.mockClear()

    await expectRedirect(() => signOutAction(), '/login')

    expect(
      await db().select().from(sessions).where(eq(sessions.id, hashSessionToken(token))).get(),
    ).toBeUndefined()
    expect(cookie.clearSessionCookie).toHaveBeenCalled()

    cookie.readSessionToken.mockResolvedValue(null)
  })

  it('本来就没有 Cookie 时退出也不会出错', async () => {
    cookie.readSessionToken.mockResolvedValue(null)
    cookie.clearSessionCookie.mockClear()

    await expectRedirect(() => signOutAction(), '/login')
    expect(cookie.clearSessionCookie).toHaveBeenCalled()
  })
})
