import { defineConfig } from '@playwright/test'

/**
 * 浏览器端到端：唯一还没有机器验证过的一步是「点登录按钮」。
 *
 * 组件级与 action 级测试覆盖不了 React 的 Server Action 协议——手写请求
 * 会收到协议错误（试过），所以这条链路只能靠真浏览器。单 worker 串行：
 * 所有用例共享同一个站与同一份库，并行会让用例之间互相踩。
 */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  // 起一个 standalone 服务、指向一份临时库（每条 CI 都是全新播种），
  // 测试只在这上面动手脚，绝不碰开发库与线上数据。
  webServer: {
    command: 'node .next/standalone/server.js',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: '3100',
      HOSTNAME: '127.0.0.1',
      MIGRATIONS_FOLDER: process.cwd() + '/drizzle',
      DATABASE_PATH: process.cwd() + '/e2e/.tmp/fitchat-e2e.db',
    },
  },
})
