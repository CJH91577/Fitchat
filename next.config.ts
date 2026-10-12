import type { NextConfig } from "next";
import { todayKey } from "./lib/data/dates";

const nextConfig: NextConfig = {
  // 静态导出：构建产出 out/ 目录，上传到任意静态托管即可（当前用 Cloudflare Pages）。
  // 代价是「今天」被烤进 HTML，站点不会自己往前翻页——见 DEPLOY.md 的「每日重建」。
  output: 'export',
  // 这两个 experimental 开关是为了让构建在「禁止子进程」的受限环境里也能跑：
  // workerThreads 让构建 worker 用线程而非子进程；useTypeScriptCli: false 让类型检查
  // 在 worker 内执行，而不是再拉一个 tsc 子进程。
  // 已实测：类型检查照常执行（3.0s 通过），产出 398 个页面 / 2012 个文件。
  // 普通环境（能正常 spawn 子进程）可删掉这一行，回到 Next 默认行为。
  experimental: { workerThreads: true, useTypeScriptCli: false },
  agentRules: false,
  // Turbopack 默认向上找 lockfile 来推断工作区根目录，本机的用户目录里恰好有
  // 一个无关的 package-lock.json，于是每次构建都会警告「它被忽略了」。把根目录
  // 钉成项目自身，警告消失，构建也不再多看仓库外面。
  turbopack: {
    root: __dirname,
  },
  // 「今天」在构建时算一次，并同时注入服务端与客户端两个包——两端拿到同一个
  // 字面量，客户端组件重新求值时不会与预渲染的 HTML 不一致。
  // 代价是日期随构建时间冻结，需要定期重建——机制见 DEPLOY.md。
  env: {
    NEXT_PUBLIC_TODAY: todayKey(),
  },
};

export default nextConfig;
