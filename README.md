# Fitchat

![CI](https://github.com/CJH91577/Fitchat/actions/workflows/ci.yml/badge.svg)

移动优先的 H5 饮食与健身记录应用：记下每天吃了什么、练了什么，再看体重与热量盈余的变化。基于 Next.js + React + TypeScript + SQLite，**服务端渲染**，可以部署在一台普通服务器上。

**在线演示**：<https://fitchat.pages.dev>（旧的静态快照，已冻结；完整版部署见下方）

## 定位与范围取舍

这是一个**演示项目**，范围是刻意收窄的：可打开、可点击、页面之间的数据自洽，数据存在真实的 SQLite 数据库里。目前**还没有登录与权限**，写操作（保存、解析）也还没有真实副作用，「AI 估算」标签来自生成规则而非真实模型。

之所以先这么做：这个阶段要验证的是「人愿不愿意每天记录」，而不是后端该怎么实现。所以力气花在数据一致性、可视化规范与无障碍上——这些才是当下会被用户感知的部分。

## 技术栈

Next.js 16（App Router，服务端渲染）· React 19 · TypeScript 5 · **SQLite + Drizzle ORM** · CSS Modules（无 Tailwind）· Vitest + React Testing Library

## 运行

```bash
npm install
npm run db:seed   # 首次：建库 + 迁移 + 播种演示数据（约 1800 条记录）
npm run dev       # 开发服务器 http://localhost:3000
npm test          # 240 个测试
npm run lint      # ESLint 检查
npm run build     # 生产构建（standalone 产物）
npm start         # 以生产模式启动
```

推送到 GitHub 后，CI 会自动执行 `test` / `lint` / `build`（见 `.github/workflows/ci.yml`）。

## 部署

**服务端渲染 + SQLite + Docker，部署在一台国内服务器（腾讯云）上。**完整步骤见 **[DEPLOY.md](DEPLOY.md)**。

- 数据是宿主机上的一个 SQLite 文件（挂载进容器），重建容器不丢数据；
- 应用首次启动时**自己建库**（迁移 + 播种），镜像里不需要额外的初始化步骤；
- 「今天」按请求计算，站点不会「过期」，**不需要每晚重建**。

## 数据层

```
页面（服务端组件）
      │  只依赖 lib/db/queries.ts 这一个接口，全部是 async
      ▼
drizzle-orm/d1  ← 一个驱动，两种实现
      ├── 线上 / 本地 / 测试：lib/db/d1-shim.ts（在 better-sqlite3 上实现 D1 的接口）
      └── 将来若迁到 Cloudflare：真正的 D1 绑定（改动只在 lib/db/runtime.ts 一处）
```

数据库结构、迁移与种子数据都在 `lib/db/`；演示数据以日期为种子确定性生成，所以每次播种得到的都是同一个库。

## 测试：两条值得单独说的

- **`tests/css-modules-contract.test.ts`** —— 源码引用样式表里不存在的类名时，CSS Modules 返回 `undefined`，React 会直接省略该 `class` 属性：构建、lint、渲染测试**全部通过**，但布局静默失效。日历页曾因 `styles.calendarArea` 缺失导致网格完全没撑满，而所有自动化检查都是绿的。这条测试把「源码用到的类」与「样式表里定义的类」之间的契约钉住。
- **`lib/db/schema.test.ts`** —— 迁移 SQL 与 `schema.ts` 是两份独立的描述，漂移了不会有任何症状（构建通过、lint 通过、页面照常跑，直到某天查询报「no such column」）。这条测试把迁移应用到一个全新的库上，再逐表逐列与 Drizzle 的定义比对。

## 设计上的几个取舍

- **首页只有两个圆环**（热量、运动），圆心是净热量。蛋白质与碳水仍然记录，但不占首页的视觉重心——行为指标（吃多少、练多少）优先于结果指标。
- **体重涨跌不做好坏着色**：增肌期体重上涨是预期结果，用红色或向下箭头表示会直接冒犯增肌用户。
- **假数据以日期为种子确定性生成**，不用 `Math.random()`：同一个日期永远得到同一组数值，页面之间才不会互相矛盾。哈希在 FNV-1a 之后补了一步 32 位雪崩混合——只用 FNV-1a 时，28 个连续日期的取值会挤在 0.06~0.65 这样的窄带里。
- **未来日期的两种处理**：日历里今天之后的格子**不可点**（构建期没有那些页面时点进去是 404），某日详情页对未来的日期显示「这一天还没有到」——那与「那天没记录」是两件事。
- **圆环的半径常量是算出来的，不是调出来的**：圆心空腔必须容得下四位数的净热量，`RingGroup.test.tsx` 用几何断言钉住这层约束。
- **空环的底轨用 0.4 不透明度，而不是 0.18 的淡洗**：后者会把橙色环的色度压到填充色的 17%（实测 `#F9E1D7`，视觉上已是浅粉），而蓝色在同样比例下仍被认作蓝。测试用色度保留率守住这条。

## 已知限制

没有登录与权限，任何页面都能直接打开；写操作（保存、解析）没有真实副作用；未接入任何大模型；演示数据只覆盖到「播种日 + 90 天」（多播是为了让站点打开就有内容，日历对未来日期的格子本来就是不可点的）。详细清单见[走查清单](docs/superpowers/plans/demo-走查清单.md)第四节。

## 文档

- [部署与更新](DEPLOY.md)
- [设计规格](docs/superpowers/specs/2026-09-22-fitchat-mvp-design.md)（含 2026-09-28 形态修订记录）
- [实施计划](docs/superpowers/plans/2026-09-28-fitchat-shape-revision.md)（当前有效）
- [手机端走查清单](docs/superpowers/plans/demo-走查清单.md)
- 历史记录：[前端 Demo 实施计划](docs/superpowers/plans/2026-09-22-fitchat-frontend-demo.md)、[上线清单（Vercel，已取代）](docs/superpowers/plans/deploy-上线清单.md)
