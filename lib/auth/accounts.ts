import { randomUUID } from 'node:crypto'
import { today } from '../data/today'
import type { Db } from '../db'
import { credentialsByEmail } from '../db/queries'
import { registerWithInvite } from '../db/writes'
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from './password'
import {
  RATE_LIMITED_MESSAGE,
  clearFailures,
  isRateLimited,
  recordFailure,
} from './rate-limit'
import { createSession } from './session'

/**
 * 账号：登录与邀请码注册的**规则**都在这里，和「怎么把结果送到浏览器」
 * （Cookie、跳转、表单状态）分开。分开的好处很直接：这些规则可以用普通
 * 函数测试，不需要请求上下文，也不会因为改了页面结构就测不到。
 */

/**
 * 邮箱规范化。
 *
 * 存储与查询用的都是这个形式。不做这一步的话，Alice@x.com 与 alice@x.com
 * 会是两个账号，而用户看不出区别——注册时说「邮箱已被使用」，登录时却说不存在。
 * 刻意不做「去掉 + 后面的别名」那一类规范化：那属于邮箱服务商的行为，
 * 不是我们该替用户假设的。
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** 邀请码同样规范化：它是印在纸上、手工抄的，大小写与空格不该成为失败原因 */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthSuccess = { ok: true; token: string; expiresAt: Date }
export type AuthFailure = { ok: false; message: string }
export type AuthResult = AuthSuccess | AuthFailure

function fail(message: string): AuthFailure {
  return { ok: false, message }
}

/**
 * 一个格式合法、但口令未知的散列。
 *
 * 用户不存在时也要跑一次 scrypt，让「邮箱没注册」与「口令不对」耗时相当。
 * 否则响应快慢本身就是一台邮箱枚举器：攻击者拿一份邮箱列表去试，
 * 快的就是不存在的。这个散列对应的明文没有被保存，也不影响任何账号。
 */
const TIMING_EQUALIZER_HASH =
  'scrypt$16384$8$1$TEQlBO6oVyxF5IMjZLMYWA$_NtvsxebvAfEupic8WTQTkRkmUB_nVuaWpiyKThwl6kAc1oOdKOkF6_7_E8DmQXbQYPHGXg4YgwtUkD3LK79Ig'

/** 登录失败一律同一句话：不区分「邮箱没注册」与「口令不对」，否则等于确认了账号存在 */
const SIGN_IN_FAILED = '邮箱或口令不正确。'

/**
 * 登录。rateLimitKeys 是调用方（Server Action）算好的限流键（`ip:…` /
 * `email:…`，见 lib/auth/rate-limit.ts）；不传就是不限流（直接调用方
 * 与既有测试都不受影响）。
 *
 * 限流检查在最前面：到上限时连 scrypt 都不跑，直接同一句「稍后再试」。
 * now 参数只为测试注入窗口边界，正常调用不需要传。
 */
export async function signIn(
  db: Db,
  email: string,
  password: string,
  rateLimitKeys: string[] = [],
  now: number = Date.now(),
): Promise<AuthResult> {
  for (const key of rateLimitKeys) {
    if (await isRateLimited(db, key, now)) return fail(RATE_LIMITED_MESSAGE)
  }

  const credentials = await credentialsByEmail(db, normalizeEmail(email))

  // passwordHash 为 null（演示账号最初就是这种）时，verifyPassword 返回 false——
  // 把「没有口令」当成「不需要口令」，等于给这些账号留一道无密码后门
  const matches = await verifyPassword(password, credentials?.passwordHash ?? TIMING_EQUALIZER_HASH)
  if (credentials === null || !matches) {
    for (const key of rateLimitKeys) await recordFailure(db, key, now)
    return fail(SIGN_IN_FAILED)
  }

  for (const key of rateLimitKeys) await clearFailures(db, key)

  const session = await createSession(db, credentials.userId)
  return { ok: true, token: session.token, expiresAt: session.expiresAt }
}

export type RegisterInput = { code: string; email: string; password: string }

/** 注册失败的原因可以逐条说清：对方手上有邀请码，不需要猜 */
const REGISTER_FAILED: Record<'code-not-found' | 'code-used' | 'email-taken', string> = {
  'code-not-found': '邀请码不正确。',
  'code-used': '这个邀请码已经用过了。',
  'email-taken': '这个邮箱已经注册过了，直接登录即可。',
}

/**
 * 注册。rateLimitKeys 与 signIn 同理；注册只对「实质性失败」（码不对、
 * 码已用、邮箱已注册）计数——格式错误是手滑，不该把人锁在门外。
 */
export async function register(
  db: Db,
  input: RegisterInput,
  rateLimitKeys: string[] = [],
  now: number = Date.now(),
): Promise<AuthResult> {
  const email = normalizeEmail(input.email)
  const code = normalizeInviteCode(input.code)

  if (!EMAIL_PATTERN.test(email)) return fail('邮箱格式不正确。')
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return fail(`口令至少 ${MIN_PASSWORD_LENGTH} 位。`)
  }
  if (code === '') return fail('请填写邀请码。')

  for (const key of rateLimitKeys) {
    if (await isRateLimited(db, key, now)) return fail(RATE_LIMITED_MESSAGE)
  }

  // 先算散列：事务里不该等 scrypt（见 lib/db/writes.ts 的说明）
  const passwordHash = await hashPassword(input.password)

  const userId = randomUUID()
  const result = await registerWithInvite(db, code, {
    userId,
    email,
    passwordHash,
    // 新用户的「开始使用日期」就是注册当天：日历与趋势都从这天往后开放
    startedAt: today(),
    timezone: 'Asia/Shanghai',
    now: new Date(now),
  })

  if (!result.ok) {
    for (const key of rateLimitKeys) await recordFailure(db, key, now)
    return fail(REGISTER_FAILED[result.reason])
  }

  for (const key of rateLimitKeys) await clearFailures(db, key)

  const session = await createSession(db, userId, new Date(now))
  return { ok: true, token: session.token, expiresAt: session.expiresAt }
}
