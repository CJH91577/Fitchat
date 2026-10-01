# Fitchat

![CI](https://github.com/CJH91577/fitchat/actions/workflows/ci.yml/badge.svg)

移动优先的 H5 饮食与健身应用演示：记录每天吃了什么、练了什么，再看体重与热量盈余的变化。基于 Next.js + React + TypeScript，**全部数据来自本地 mock，无后端**。

在线演示：<!-- 部署后把 Vercel 链接填在这里 -->

## 技术栈

Next.js 16（App Router）· React 19 · TypeScript 5 · CSS Modules（无 Tailwind）· Vitest + React Testing Library

## 运行

本项目唯一使用 npm 作为包管理器：

```bash
npm install
npm run dev     # 启动开发服务器 http://localhost:3000
npm test        # 运行全部测试
npm run lint    # ESLint 检查
npm run build   # 生产构建
```

推送到 GitHub 后，CI 会自动执行上面后三条（见 `.github/workflows/ci.yml`）。

## 上线

见 [上线清单](docs/superpowers/plans/deploy-上线清单.md)。站点需要一个每晚的重建任务来让「今天」跟上真实日期（见 `.github/workflows/nightly-rebuild.yml`）。

## 设计上的几个取舍

- **首页只有两个圆环**（热量、运动），圆心是净热量。蛋白质与碳水仍然记录，但不占首页的视觉重心——行为指标（吃多少、练多少）优先于结果指标。
- **体重涨跌不做好坏着色**：增肌期体重上涨是预期结果，用红色或向下箭头表示会直接冒犯增肌用户。
- **假数据以日期为种子确定性生成**，不用 `Math.random()`：同一个日期永远得到同一组数值，页面之间才不会互相矛盾。
- **「今天」取北京时间，并在构建时固定**：部署环境多为 UTC，按运行环境取日期会在北京时间凌晨显示成昨天。

## 已知限制

这是演示，不是成品：没有登录与权限，写操作（保存、解析）没有真实副作用，也没有接入 AI——界面上的「AI 估算」标签来自生成规则。详细清单见[走查清单](docs/superpowers/plans/demo-走查清单.md)第四节。
