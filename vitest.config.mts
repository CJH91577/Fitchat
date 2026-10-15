import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    // 每个 worker 建一次 jsdom，而不是每个测试文件建一次。测试文件数增长后
    // vitest 会为此打印一条性能提示——而「测试输出零告警」是本项目的质量信号，
    // 因为开发者不读代码、只读输出。vmThreads 保留逐文件的隔离语义。
    pool: 'vmThreads',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    // .next 里是构建产物（standalone 会带着一份旧的 app/ 源码与半个
    // node_modules），按文件名过滤跑测试时会被一起匹配进来，然后以
    // 「找不到 react 开发运行时」这类假错误挂掉——它们不是测试，是产物。
    exclude: [...configDefaults.exclude, '**/.next/**'],
  },
})
