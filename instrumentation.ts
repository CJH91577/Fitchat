/**
 * Next 在服务进程启动时调用一次 register()——容器启动时「库还没建出来」
 * 这件事就靠它解决（见 lib/db/bootstrap.ts）。
 *
 * 另外两个入口也在这里：
 *   - onRequestError：请求内出错（渲染 / route handler / server action）时
 *     Next 会调它——错误日志的「是哪次请求」就来自这里；
 *   - 进程级 uncaughtException / unhandledRejection：记下来再退出，容器有
 *     restart: unless-stopped，退出后 Docker 会把它拉起来——比带着半坏状态
 *     继续跑更安全。
 *
 * 用动态 import：这段代码在构建期也会被打包，而建库与日志逻辑只该在真正跑起
 * 服务的时候执行；且它们依赖 better-sqlite3（原生模块），不该进客户端包。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { ensureDatabase } = await import('@/lib/db/bootstrap')
  await ensureDatabase()

  // 只在生产装进程级钩子：开发时 Next 自己会打印漂亮的堆栈，装上一个
  // process.exit 反而把 dev server 弄崩。
  if (process.env.NODE_ENV !== 'production') return

  const { fatalLog } = await import('@/lib/log')
  process.on('uncaughtException', (error) => {
    fatalLog(error)
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    fatalLog(reason)
    process.exit(1)
  })
}

/**
 * 请求内出错时的日志钩子：路径、方法与错误摘要一起落盘，
 * 「出事了能在 1 分钟内知道是哪次请求」就是靠这一行日志。
 * 自己不能抛错——错误处理路径上再炸一次，站点就真没救了。
 */
export async function onRequestError(
  error: unknown,
  request: Readonly<{
    path: string
    method: string
    headers: NodeJS.Dict<string | string[]>
  }>,
  context: Readonly<{
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'proxy'
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined
  }>,
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { requestErrorLog } = await import('@/lib/log')
  requestErrorLog(error, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  })
}
