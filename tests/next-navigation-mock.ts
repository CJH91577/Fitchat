/**
 * next/navigation 的 redirect 替身。
 *
 * 真实的 redirect() 是靠**抛异常**中断渲染的（Next 内部捕获这个异常并换成
 * 302）。所以替身也必须抛，不能只是记一笔就返回：否则 requireUser 之后的
 * 代码会继续跑下去，而 user 是 null——测试于是报一个与真实问题无关的错。
 */
export class RedirectError extends Error {
  constructor(readonly to: string) {
    super(`redirect(${to})`)
    this.name = 'RedirectError'
  }
}

export function redirectMock(to: string): never {
  throw new RedirectError(to)
}

/** 断言用：这个异常是不是「跳到了某个地址」 */
export function redirectTarget(error: unknown): string | null {
  return error instanceof RedirectError ? error.to : null
}
