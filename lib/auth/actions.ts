'use server'

import { redirect } from 'next/navigation'
import { DEMO_USER_ID } from '../db/demo'
import { userById } from '../db/queries'
import { getDb } from '../db/runtime'
import { normalizeEmail, register, signIn } from './accounts'
import { clearSessionCookie, readSessionToken, writeSessionCookie } from './cookie'
import type { FormState } from './form-state'
import { clientIp } from './ip'
import { attemptKey } from './rate-limit'
import { resetPassword } from './reset'
import { createSession, deleteExpiredSessions, deleteSession } from './session'

/**
 * 登录相关的 Server Action：**只做「把结果送到浏览器」这件事**——
 * 读表单、调 lib/auth/accounts.ts 的规则、写 Cookie、跳转。
 *
 * 规则本身不在这个文件里，所以它们能用普通函数测（见 lib/auth/accounts.test.ts）。
 * 这里能塞进去的逻辑越少，越不需要为了测试去搭一套请求上下文。
 *
 * 注意这个文件只能导出 async 函数：非函数的导出在 Next 里直接报错。
 */

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const db = getDb()

  // 顺手清掉过期会话：登录是天然的、频率有界的触发点（见 lib/auth/session.ts）
  await deleteExpiredSessions(db)

  const email = String(formData.get('email') ?? '')
  const result = await signIn(db, email, String(formData.get('password') ?? ''), [
    attemptKey('email', normalizeEmail(email)),
    attemptKey('ip', await clientIp()),
  ])
  if (!result.ok) return { error: result.message }

  await writeSessionCookie(result.token, result.expiresAt)
  redirect('/')
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const db = getDb()

  // 注册的限流键只有 IP：邀请码是「谁在试」的问题；邮箱是受害者自己的，
  // 拿它计数会让攻击者顺手把受害者的邮箱锁在门外
  const result = await register(
    db,
    {
      code: String(formData.get('code') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    },
    [attemptKey('ip', await clientIp())],
  )
  if (!result.ok) return { error: result.message }

  await writeSessionCookie(result.token, result.expiresAt)
  // 注册完不是回首页，而是去填资料与目标：新账号里一份记录都没有，
  // 首页那边只会是「今天没有记录」——先做该做的那一步
  redirect('/onboarding')
}

/**
 * 一键进入演示账号。
 *
 * 刻意不需要口令：演示账号的用途就是**点开就能看到一个装满数据的界面**，
 * 而它里面的数据全部是按日期确定性生成的假数据。口令公开写着（README、
 * 登录页、DEPLOY.md）——把「公开的口令」包装成安全边界是自欺欺人，
 * 不如把它做成一个明确的入口。真实账号请用邀请码注册。
 */
export async function signInAsDemoAction(): Promise<void> {
  const db = getDb()
  const user = await userById(db, DEMO_USER_ID)
  if (!user) throw new Error(`库里没有演示账号（${DEMO_USER_ID}）。先运行 npm run db:seed。`)

  const session = await createSession(db, user.id)
  await writeSessionCookie(session.token, session.expiresAt)
  redirect('/')
}

/**
 * 用管理员发的重置码设置新口令（登录页的「忘记口令」）。
 *
 * 成功后直接建会话登录：用户刚证明了自己是谁（手里有码），
 * 再让人家输一遍新口令登一次是多余的仪式。
 */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = getDb()

  const result = await resetPassword(
    db,
    String(formData.get('email') ?? ''),
    String(formData.get('code') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!result.ok) return { error: result.message }

  const session = await createSession(db, result.userId)
  await writeSessionCookie(session.token, session.expiresAt)
  redirect('/')
}

export async function signOutAction(): Promise<void> {
  const db = getDb()

  const token = await readSessionToken()
  // 先删库里的那一行再清 Cookie：只清 Cookie 的话，令牌在别处仍然有效，
  // 而「退出登录」在用户心里的意思是「这个会话作废了」
  if (token !== null) await deleteSession(db, token)
  await clearSessionCookie()

  redirect('/login')
}
