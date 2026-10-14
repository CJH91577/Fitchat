/**
 * 页面测试里的 Cookie 替身。
 *
 * 页面读的是会话 Cookie，而读 Cookie 的只有 lib/auth/cookie.ts 一个文件
 *（见那里的说明）。测试只替换这一个模块，于是页面测试跑的仍然是**真实链路**：
 * Cookie 里的令牌 → sessions 表里的那一行 → 用户。换成「直接把用户注进去」的
 * 替身，就没法发现会话查询写错这类问题了。
 *
 * 未登录的情况由 tests/seeded-db 的 setSignedIn(false) 表达。
 */
export async function cookieMock(): Promise<{
  readSessionToken: () => Promise<string | null>
  writeSessionCookie: () => Promise<void>
  clearSessionCookie: () => Promise<void>
}> {
  const { testReadSessionToken } = await import('./seeded-db')
  return {
    readSessionToken: testReadSessionToken,
    // 写 Cookie 只发生在 Server Action 里，页面渲染用不到；
    // 页面测试里给成空实现，需要断言的地方在自己的测试文件里单独替换。
    writeSessionCookie: async () => {},
    clearSessionCookie: async () => {},
  }
}
