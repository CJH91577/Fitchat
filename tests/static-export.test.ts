import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const root = process.cwd()
const config = readFileSync(join(root, 'next.config.ts'), 'utf8')
const dayPage = readFileSync(join(root, 'app', 'day', '[date]', 'page.tsx'), 'utf8')

describe('静态导出契约', () => {
  // 站点以静态产物交付（上传到 Cloudflare Pages 的 out/ 目录）。
  // 一旦 output: 'export' 被去掉，构建依然会成功、lint 与测试依然全绿，
  // 但产物从 out/ 变成 .next/，部署会静默失败——只有线上 404 能暴露它。
  // 这条测试把「部署方式」与「构建配置」之间的契约钉住，
  // 与 css-modules-contract.test.ts 防的是同一类问题：静默失效。
  it('next.config.ts 必须开启 output: export', () => {
    expect(config).toMatch(/output:\s*'export'/)
  })

  // 静态导出没有服务端，动态路由的所有路径必须在构建时列出来，
  // 否则 Next 会直接构建失败（missing generateStaticParams）。
  it('某日详情页必须提供 generateStaticParams', () => {
    expect(dayPage).toContain('generateStaticParams')
  })

  // 「今天」在构建时算一次并注入两端。若去掉这层注入，服务端预渲染与浏览器
  // 各自求值，跨零点时客户端首次渲染会与预渲染 HTML 不符（hydration 报错）。
  it('必须把构建时的「今天」注入客户端与服务端两个包', () => {
    expect(config).toContain('NEXT_PUBLIC_TODAY')
  })

  // 部署方式与产物目录写在同一处，改动其中一边时另一边不该被忘掉。
  it('部署说明里写明的产物目录与配置一致', () => {
    const deploy = readFileSync(join(root, 'DEPLOY.md'), 'utf8')
    expect(deploy).toContain('out')
    expect(config).toMatch(/output:\s*'export'/)
  })
})
