import type { NextConfig } from "next";
import { todayKey } from "./lib/data/dates";

const nextConfig: NextConfig = {
  agentRules: false,
  // Turbopack 默认向上找 lockfile 来推断工作区根目录，本机的用户目录里恰好有
  // 一个无关的 package-lock.json，于是每次构建都会警告「它被忽略了」。把根目录
  // 钉成项目自身，警告消失，构建也不再多看仓库外面。
  turbopack: {
    root: __dirname,
  },
  // 「今天」在构建时算一次，并同时注入服务端与客户端两个包——两端拿到同一个
  // 字面量，客户端组件重新求值时不会与预渲染的 HTML 不一致。
  // 代价是日期随构建时间冻结，由每晚的定时重建刷新。
  env: {
    NEXT_PUBLIC_TODAY: todayKey(),
  },
};

export default nextConfig;
