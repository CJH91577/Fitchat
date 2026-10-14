import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll } from 'vitest'
import { createSession } from '../lib/auth/session'
import { DEMO_USER_ID } from '../lib/db/demo'
import { applyMigrations } from '../lib/db/migrate'
import { closeDb, openLocalDb } from '../lib/db/runtime'
import { seedDatabase } from '../lib/db/seed'

/**
 * 给「读数据库的页面」的测试准备一份种子库，并把 DATABASE_PATH 指过去。
 *
 * 在测试文件的顶层调用一次即可。
 *
 * 之所以能生效，是因为 lib/db/index.ts 的 dbPath() 是在调用时读环境变量，
 * 而不是在 import 时冻结成常量。
 *
 * 名字刻意不以 use 开头：它跟 React 无关，而 ESLint 的
 * react-hooks/rules-of-hooks 只认前缀，会把顶层调用判成违规。
 *
 * 从阶段 3 起，这里还会给演示用户建一条真实会话，并把它的令牌交给
 * tests/auth-cookie-mock：页面测试因此是「已登录的演示用户」看到的页面，
 * 与浏览器里点进去看到的完全一致。
 */

let sessionToken: string | null = null
let signedIn = true

export function setupSeededDatabase(): void {
  const dir = mkdtempSync(join(tmpdir(), 'fitchat-page-'))
  const path = join(dir, 'test.db')

  process.env.DATABASE_PATH = path

  beforeAll(async () => {
    applyMigrations(path)
    const { db, close } = openLocalDb(path)
    try {
      await seedDatabase(db)
      sessionToken = (await createSession(db, DEMO_USER_ID)).token
    } finally {
      close()
    }
  })

  afterAll(() => {
    // 先关掉页面复用的那个连接：Windows 上打开着的文件删不掉，
    // 直接 rmSync 会以 EPERM 失败。
    closeDb()
    rmSync(dir, { recursive: true, force: true })
    sessionToken = null
    signedIn = true
  })
}

/** 页面测试里的「浏览器带了哪个会话 Cookie」 */
export async function testReadSessionToken(): Promise<string | null> {
  if (!signedIn) return null
  if (sessionToken === null) {
    throw new Error('先调用 setupSeededDatabase()，会话是在那里创建的')
  }
  return sessionToken
}

/**
 * 让之后的渲染处于未登录状态。
 *
 * 页面测试的渲染都在同一个进程里，改的是一个模块级开关——所以需要在
 * 用完之后改回来（afterAll 里已经兜了一层）。
 */
export function setSignedIn(value: boolean): void {
  signedIn = value
}
