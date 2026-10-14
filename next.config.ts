import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署形态：Node 服务器（腾讯云 + Docker）。
  //
  // standalone 会产出 .next/standalone/——一个自带最小依赖树的服务入口，
  // 镜像因此不必复制整个 node_modules。这是 Next 官方的容器化部署形态。
  //
  // 之前这里是 output: 'export'（静态导出到 out/，托管在 Cloudflare Pages）。
  // 换成服务端渲染，是因为认证（会话 cookie）与写操作都需要请求期有服务端；
  // 顺带「今天」也不再被冻结在构建那一刻，每晚重建那套机制随之退休。
  output: 'standalone',
  // 这两个 experimental 开关是为了让构建在「禁止子进程」的受限环境里也能跑：
  // workerThreads 让构建 worker 用线程而非子进程；useTypeScriptCli: false 让类型检查
  // 在 worker 内执行，而不是再拉一个 tsc 子进程。
  // 普通环境（能正常 spawn 子进程）可删掉这一行，回到 Next 默认行为。
  experimental: { workerThreads: true, useTypeScriptCli: false },
  agentRules: false,
  // Turbopack 默认向上找 lockfile 来推断工作区根目录，本机的用户目录里恰好有
  // 一个无关的 package-lock.json，于是每次构建都会警告「它被忽略了」。把根目录
  // 钉成项目自身，警告消失，构建也不再多看仓库外面。
  turbopack: {
    root: __dirname,
  },
  // 这里曾经有一个 env: { NEXT_PUBLIC_TODAY } 注入，用来让服务端与浏览器拿到
  // 同一个「今天」。现在不需要了：服务端渲染下「今天」按请求计算
  //（见 lib/data/today.ts），构建时注入的常量在一个长跑的进程里只会过期。
};

export default nextConfig;
