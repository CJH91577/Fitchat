import { NextResponse, type NextRequest } from 'next/server'
import { accessLog } from '@/lib/log'

/**
 * 访问日志：每个请求一行（方法 + 路径 + 时间）。
 *
 * 错误日志只记「出错的那次」，而「出错时前后有哪些请求」要靠这份访问日志
 * 对上——两者合起来才能在一分钟内定位问题。日志自己保证不会抛错（lib/log.ts
 * 内部捕获 I/O 失败），middleware 不允许把站点带崩。
 *
 * Next 16 的 middleware 默认跑在 Node 运行时，所以这里可以直接用文件 API。
 */
export function middleware(request: NextRequest): NextResponse {
  accessLog({
    method: request.method,
    path: request.nextUrl.pathname + request.nextUrl.search,
  })
  return NextResponse.next()
}

// 静态资源与图标不打日志：它们不是「访问站点」的请求，只会刷屏
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
