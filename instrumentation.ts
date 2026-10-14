/**
 * Next 在服务进程启动时调用一次 register()——容器启动时「库还没建出来」
 * 这件事就靠它解决（见 lib/db/bootstrap.ts）。
 *
 * 用动态 import：这段代码在构建期也会被打包，而建库逻辑只该在真正跑起
 * 服务的时候执行；且它依赖 better-sqlite3（原生模块），不该进客户端包。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { ensureDatabase } = await import('@/lib/db/bootstrap')
  await ensureDatabase()
}
