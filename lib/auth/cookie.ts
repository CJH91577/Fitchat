import { cookies } from 'next/headers'
import { SESSION_COOKIE } from './session'

/**
 * 会话 Cookie 的读写。
 *
 * **整个项目里只有这一个文件直接调用 next/headers 的 cookies()。**
 * 这么做有两个理由：
 *
 *   1. 页面的测试是直接用 jsdom 渲染页面组件的，没有请求上下文，cookies()
 *      在那里会抛错。把「从请求里取令牌」收成一个函数，测试只需要替换这一个
 *      函数（`vi.mock('@/lib/auth/cookie')`），就能让整条
 *      「Cookie → 会话行 → 用户」的链路真实地跑起来，而不是把认证整段跳过去。
 *   2. 换框架、换运行时（比如以后真上 Cloudflare Workers）时，只有这一处要改。
 */

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

/**
 * 是否给 Cookie 打上 Secure。
 *
 * **默认关闭**，因为线上的演示站是 http://<ip>:3000（明文 HTTP）。带 Secure 的
 * Cookie 在明文 HTTP 下会被浏览器直接丢弃，表现是「登录成功，但下一次请求又
 * 要求登录」——一个看起来像逻辑 bug 的现象。接上 HTTPS（域名 + 证书）之后，
 * 在部署环境里设 SESSION_COOKIE_SECURE=1 打开它。
 *
 * 名字刻意不以 use 开头：ESLint 的 react-hooks/rules-of-hooks 只认前缀，
 * 会把普通函数当成 Hook，判成「在非组件里调用了 Hook」。
 */
function secureCookieEnabled(): boolean {
  return process.env.SESSION_COOKIE_SECURE === '1'
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    // JS 读不到：即使页面被注入脚本，会话令牌也偷不走
    httpOnly: true,
    // 跨站发起的 POST 不带这个 Cookie，挡掉 CSRF；站内跳转不受影响
    sameSite: 'lax',
    path: '/',
    secure: secureCookieEnabled(),
    expires: expiresAt,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: secureCookieEnabled(),
    maxAge: 0,
  })
}
