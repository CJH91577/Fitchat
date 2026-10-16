import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { readCode, repoPath, walk } from './source'
import AppLayout from '@/app/(app)/layout'
import Trends from '@/app/(app)/trends/page'
import Login from '@/app/login/page'
import { requireUser } from '@/lib/auth/current-user'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { setSignedIn, setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { usePathname: () => '/', redirect: redirectMock }
})
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

setupSeededDatabase()

const root = process.cwd()
const appDir = join(root, 'app')

const pages = walk(appDir).filter(
  (file) => file.endsWith('page.tsx') && !file.endsWith('.test.tsx'),
)
/** 读了数据库的页面：内容属于某个用户，所以必须知道「谁在看」 */
const dataPages = pages.filter((file) => /from '@\/lib\/db\//.test(readCode(file)))

/** 断言「这次调用会跳到某个地址」——真实 redirect() 就是靠抛异常中断渲染的 */
async function expectRedirect(run: () => Promise<unknown>, to: string): Promise<void> {
  try {
    await run()
  } catch (error) {
    expect(redirectTarget(error), String(error)).toBe(to)
    return
  }
  throw new Error(`本该跳到 ${to}，但调用正常返回了`)
}

describe('登录守卫是行为，不是约定', () => {
  it('没有会话时，requireUser 跳到登录页', async () => {
    setSignedIn(false)
    try {
      await expectRedirect(() => requireUser(), '/login')
    } finally {
      setSignedIn(true)
    }
  })

  it('没有会话时，数据页自己就跳登录页（不依赖外层外壳）', async () => {
    setSignedIn(false)
    try {
      await expectRedirect(() => Trends(), '/login')
    } finally {
      setSignedIn(true)
    }
  })

  it('外壳（app/(app)/layout）也挡一道，登录后正常渲染', async () => {
    setSignedIn(false)
    try {
      await expectRedirect(() => AppLayout({ children: null }), '/login')
    } finally {
      setSignedIn(true)
    }

    const tree = await AppLayout({ children: '内容' })
    expect(tree).toBeTruthy()
  })
})

describe('每个读库的页面都必须自带守卫', () => {
  it('确实找到了读库的页面（别让这条测试静默失效）', () => {
    expect(dataPages.length).toBeGreaterThanOrEqual(6)
  })

  it('每个读库的页面都引了并调用了 requireUser', () => {
    const offenders = dataPages.filter((file) => {
      const code = readCode(file)
      const imported = /import \{ requireUser \} from '@\/lib\/auth\/current-user'/.test(code)
      const called = /await requireUser\(/.test(code)
      return !imported || !called
    })
    expect(offenders.map((file) => repoPath(root, file))).toEqual([])
  })

  // 反向检查：登录页这类**故意公开**的页面不该被顺手加上守卫——
  // 加上了就再也登不进去了。
  it('app/(app) 之外的页面没有守卫', () => {
    const outside = pages.filter((file) => !repoPath(root, file).startsWith('app/(app)/'))
    expect(outside.length).toBeGreaterThan(0)

    const offenders = outside.filter((file) => readCode(file).includes('requireUser'))
    expect(offenders.map((file) => repoPath(root, file))).toEqual([])
  })

  it('外壳里有兜底的那一道守卫', () => {
    expect(readCode(join(appDir, '(app)', 'layout.tsx'))).toContain('await requireUser()')
  })
})

describe('登录页：唯一公开的页面', () => {
  it('未登录时能看到登录表单', async () => {
    setSignedIn(false)
    try {
      expect(await Login()).toBeTruthy()
    } finally {
      setSignedIn(true)
    }
  })

  it('已登录时被送回首页（否则会看到「进入」按钮，点下去只是再建一个会话）', async () => {
    setSignedIn(true)
    await expectRedirect(() => Login(), '/')
  })
})

describe('请求头只有两个出入口', () => {
  // 页面测试靠替换 lib/auth/cookie 这一个模块来模拟登录态。若别处也直接调用
  // next/headers 的 cookies()，就绕过了这个替换点：页面会认为「没有 Cookie」，
  // 守卫于是把人踢到登录页——而更糟的结果是有人为了让测试变绿，把替换改成
  // 「直接注入用户」，整条会话链路就没人测了。lib/auth/ip.ts 同理：客户端 IP
  // 只在限流里用，读 x-forwarded-for 的代码也只该有这一个出入口。
  it('只有 lib/auth/cookie.ts 与 lib/auth/ip.ts 直接引用 next/headers', () => {
    const files = [...walk(appDir), ...walk(join(root, 'lib'))].filter(
      (file) => file.endsWith('.ts') || file.endsWith('.tsx'),
    )
    const importers = files
      .filter((file) => /from 'next\/headers'/.test(readCode(file)))
      .map((file) => repoPath(root, file))

    expect(importers).toEqual(['lib/auth/cookie.ts', 'lib/auth/ip.ts'])
  })
})

describe('演示用户常量已经退出页面代码', () => {
  // 「库里只有一个人」是阶段 2 的临时状态。这条测试钉住这次迁移真的完成了：
  // 页面里不再有 getDemoUser，用户一律来自会话。
  it('页面里不再出现 getDemoUser', () => {
    const offenders = pages.filter((file) => readCode(file).includes('getDemoUser'))
    expect(offenders.map((file) => repoPath(root, file))).toEqual([])
  })
})
