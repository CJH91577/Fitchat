# Fitchat

![CI](https://github.com/CJH91577/Fitchat/actions/workflows/ci.yml/badge.svg)

移动优先的 H5 饮食与健身记录应用：记下每天吃了什么、练了什么，再看体重与热量盈余的变化。基于 Next.js + React + TypeScript，**无后端**，全部数据按日期确定性生成。

**在线演示**：<https://fitchat.pages.dev>

## 定位与范围取舍

这是一个**前端演示**，范围是刻意收窄的：可打开、可点击、页面之间的数据自洽，但**没有登录、没有持久化**，写操作（保存、解析）没有真实副作用，「AI 估算」标签来自生成规则而非真实模型。

之所以先这么做：这个阶段要验证的是「人愿不愿意每天记录」，而不是后端该怎么实现。所以力气花在数据一致性、可视化规范与无障碍上——这些才是当下会被用户感知的部分。

## 技术栈

Next.js 16（App Router）· React 19 · TypeScript 5 · CSS Modules（无 Tailwind）· Vitest + React Testing Library

## 运行

```bash
npm install
npm run dev     # 开发服务器 http://localhost:3000
npm test        # 188 个测试
npm run lint    # ESLint 检查
npm run build   # 静态导出，产出 out/
```

推送到 GitHub 后，CI 会自动执行 `test` / `lint` / `build`（见 `.github/workflows/ci.yml`）。

## 部署

静态导出（`output: 'export'`）后，由 Cloudflare Pages 从 Git 仓库构建。完整的配置字段、每日重建机制与排错见 **[DEPLOY.md](DEPLOY.md)**。

> ⚠️ 「今天」是在构建时写进 HTML 的，站点不会自己往前翻页——必须每天重建一次，否则日期会永远停在最后一次构建那天。机制与取舍见 DEPLOY.md。

## 测试：两条值得单独说的

- **`tests/css-modules-contract.test.ts`** —— 源码引用样式表里不存在的类名时，CSS Modules 返回 `undefined`，React 会直接省略该 `class` 属性：构建、lint、渲染测试**全部通过**，但布局静默失效。日历页曾因 `styles.calendarArea` 缺失导致网格完全没撑满，而所有自动化检查都是绿的。这条测试把「源码用到的类」与「样式表里定义的类」之间的契约钉住。
- **`tests/static-export.test.ts`** —— 去掉 `output: 'export'` 后构建依然成功、lint 与测试依然全绿，但产物会从 `out/` 变成 `.next/`，部署静默失败。与上一条属于同一类问题，同样用契约测试守住。

## 设计上的几个取舍

- **首页只有两个圆环**（热量、运动），圆心是净热量。蛋白质与碳水仍然记录，但不占首页的视觉重心——行为指标（吃多少、练多少）优先于结果指标。
- **体重涨跌不做好坏着色**：增肌期体重上涨是预期结果，用红色或向下箭头表示会直接冒犯增肌用户。
- **假数据以日期为种子确定性生成**，不用 `Math.random()`：同一个日期永远得到同一组数值，页面之间才不会互相矛盾。哈希在 FNV-1a 之后补了一步 32 位雪崩混合——只用 FNV-1a 时，28 个连续日期的取值会挤在 0.06~0.65 这样的窄带里，生成器的分支判定会恒定走同一边。
- **「今天」取北京时间，并在构建时固定**：部署环境多为 UTC，按运行环境取日期会在北京时间凌晨显示成昨天。
- **圆环的半径常量是算出来的，不是调出来的**：圆心空腔必须容得下四位数的净热量，`RingGroup.test.tsx` 用几何断言钉住这层约束。
- **空环的底轨用 0.4 不透明度，而不是 0.18 的淡洗**：后者会把橙色环的色度压到填充色的 17%（实测 `#F9E1D7`，视觉上已是浅粉），而蓝色在同样比例下仍被认作蓝——同一个机制只在一半的环上出问题。测试用色度保留率守住这条。

## 已知限制

没有登录与权限，任何页面都能直接打开；数据不落库，刷新即回到原样；「保存」「解析」没有真实副作用；未接入任何大模型；「今天」是构建日期，不是浏览者打开页面的日期。详细清单见[走查清单](docs/superpowers/plans/demo-走查清单.md)第四节。

## 文档

- [部署与更新](DEPLOY.md)
- [设计规格](docs/superpowers/specs/2026-09-22-fitchat-mvp-design.md)（含 2026-09-28 形态修订记录）
- [实施计划](docs/superpowers/plans/2026-09-28-fitchat-shape-revision.md)（当前有效）
- [手机端走查清单](docs/superpowers/plans/demo-走查清单.md)
- 历史记录：[前端 Demo 实施计划](docs/superpowers/plans/2026-09-22-fitchat-frontend-demo.md)、[上线清单（Vercel）](docs/superpowers/plans/deploy-上线清单.md) —— 均已被取代，正文不再维护
