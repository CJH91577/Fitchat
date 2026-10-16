import { headers } from 'next/headers'

/**
 * 客户端 IP，限流键的来源。
 *
 * 容器跑在 Nginx 后面时，直接连进来的地址永远是反向代理自己的（127.0.0.1），
 * 真实地址在 `x-forwarded-for` 的第一个值里（代理会在后面追加自己）。
 * 取不到时退回 'unknown'——限流仍然生效，只是匿名请求共享同一个键。
 *
 * 与 lib/auth/cookie.ts 同理：直接读请求头的代码只集中在这一个文件里，
 * 测试要替换行为时只需 mock 这一个模块。
 */
export async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first !== '' && first !== undefined) return first
  }
  return 'unknown'
}
