# 部署与更新

本站是**纯静态**导出（`next.config.ts` 里的 `output: 'export'`）：`npm run build` 产出 `out/`，交给静态托管即可，不需要服务器、不需要数据库、不需要任何密钥。

当前路线：**GitHub 仓库 + Cloudflare Pages 的 Git 集成**——构建在 Cloudflare 云端完成，`git push` 即自动部署，另配一个定时器每天重建一次。

## 一、上线（一次性，约 10 分钟）

### 1. 建一个新的 GitHub 仓库并推送

在 <https://repo.new> 建一个**空仓库**（不要勾选 README / .gitignore / License，否则首次推送会撞车）。然后在项目目录执行：

```bash
cd C:\Users\admin\Fitchat
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

> 本地仓库的 `origin` 已被清空——原来指向 `github.com/CJH91577/Fitchat.git`，那个仓库已删除，留着只会在推送时报「Repository not found」。所以上面用 `git remote add` 而不是 `set-url`。

**验证**：GitHub 网页上能看到 56 个文件的完整提交历史。

### 2. 在 Cloudflare 建 Pages 项目

> 前置：仓库里**至少要有一个已推送的分支**，否则下一步的 Production branch 下拉是空的。

控制台 → **Workers & Pages** → **Create application** → **Pages** 标签 → **Connect to Git** → 按提示用 GitHub 登录并授权 → 选中仓库 → **Install & Authorize** → **Begin setup**。

在 **Set up builds and deployments** 里按下表填：

| 字段 | 填什么 |
|---|---|
| Project name | `fitchat`（**全局唯一**，它决定 `https://fitchat.pages.dev`；被占用就换，如 `fitchat-demo`） |
| Production branch | `main` |
| Framework preset | `Next.js (Static HTML Export)` |
| Build command | `npx next build`（选预设后自动带出） |
| Build directory | `out`（选预设后自动带出） |
| Root directory (advanced) | **留空** |
| Environment variables | **全部留空**（本项目不需要任何变量） |

然后 **Save and Deploy**，首次构建约 1–3 分钟。

**Node 版本不用管**：Cloudflare 构建镜像默认 Node.js **22.16.0**，而 Next 16 只要求 Node ≥ 20.9，够用。


> ⚠️ **不要用 Direct Upload（拖拽）**。官方文档写得很明确：「If you choose Direct Upload, you cannot switch to Git integration later. You will have to create a new project with Git integration to use automatic deployments.」——拖拽项目日后无法转成 Git 集成，只能重建项目、换域名。既然要自动重建，一开始就走 Git 集成。
>
> 反过来也要知道：Git 集成的项目**不能**再用控制台拖拽上传，只能靠 `git push` 或命令行 `wrangler pages deploy`。

### 3. 拿到网址

部署完成后是 `https://<项目名>.pages.dev`，这就是别人能访问的地址。想绑自己的域名：项目 → **Custom domains**。

**验证**：手机打开该网址——首页日期栏显示今天、日历里今天那格边框更亮、底部五项导航都能点开。

## 二、每日重建（必配，否则网站会「过期」）

「今天」是在**构建时**写进 HTML 的（`NEXT_PUBLIC_TODAY`，见 `next.config.ts`），所以站点不会自己往前翻页：不重建的话，日历和首页会永远停在最后一次构建那天。

> 时区不必担心：`todayKey()` 固定按 `Asia/Shanghai` 取日期，所以 Cloudflare 在 UTC 环境下构建，写进去的仍是正确的北京时间日期。

### 1. 建一个 Deploy Hook

Cloudflare 项目 → **Settings** → **Builds** → **Add deploy hook** → 名字随意（如 `nightly`），**Branch to build 填 `main`** → 拿到一个 URL。

### 2. 用定时服务每天 POST 一次

在 <https://cron-job.org>（免费）建一个任务：URL 填上面的 Deploy Hook 地址，方法 POST，频率设为每天一次。

**建议时间：16:05 UTC，即北京时间 00:05。** 这样每天零点一过就重建，站点上的「今天」立刻跟上。

> 为什么不把定时任务放在 GitHub Actions？因为 GitHub 会在**仓库 60 天没有活动**时自动停用 `schedule` 工作流。本仓库一个演示项目，平时不会有提交，正好会踩中这个坑。cron-job.org 是独立的第三方，不受影响。

**验证**：在 cron-job.org 上手动点一次「Run now」，Cloudflare 项目里应多出一条新的部署记录，站点日期随之更新。

## 三、改了代码之后怎么更新

```bash
git add -A
git commit -m "..."
git push
```

Cloudflare 会自动重新构建并部署，不需要手动做任何事。

## 四、本地预览与手动重建

```bash
npm install
npm run build     # 产出 out/
npx serve out     # 本地起一个静态服务器预览
```

> 直接双击 `out/index.html` 用 `file://` 打开是**不行**的：站内链接指向 `/calendar`、`/day/2026-10-12` 这类绝对路径，必须有一个 HTTP 服务器提供根目录。

想立刻让线上站点重建一次（不等定时器）：对 Deploy Hook 地址发一个 POST 即可。

```bash
curl -X POST "<Deploy Hook URL>"
```

## 五、排错

| 现象 | 原因与处理 |
|---|---|
| 仓库列表里找不到你的仓库 | Cloudflare 的 GitHub App 授权范围没覆盖它。去 GitHub → **Settings → Applications → Cloudflare Pages → Configure**，勾选该仓库（或选 All repositories）。 |
| Production branch 下拉是空的 | 仓库里还没有任何已推送的分支——先完成第 1 步的 `git push`。 |
| 项目名报已存在 | 项目名在 Cloudflare 上全局唯一，换一个（如 `fitchat-demo`），默认域名会跟着变。 |
| 构建成功但打开是 404 | Build directory 填错了，必须是 `out`（不是 `dist`、不是 `.next`）。 |
| 构建报 Node 版本不满足 | 正常不会发生（默认 22.16.0 已满足）。真要覆盖：**Settings → Environment variables** 加 `NODE_VERSION=24`。 |
| 某日详情页 404 | 这些页面在构建时按「开始使用日期 → 今天」预生成（约 386 个）。若这个范围不对，检查 `lib/data/mock.ts` 的 `MOCK_USER.startedAt` 与构建日期。 |
| 想手动上传而不是 push | Git 集成项目不能用拖拽，只能用 `npx wrangler pages deploy out --project-name=<项目名>`。 |
| 站点日期没跟上 | 看 Cloudflare 的部署记录是否每天新增一条；没有就是 Deploy Hook 或定时任务断了。 |

## 六、部署细节

- 构建产物体积约 **20 MB / 2012 个文件**（其中 386 个是某日详情页）。
- 某日详情页产出的是 `out/day/2026-10-12.html`，**不是** `2026-10-12/index.html`。Cloudflare Pages 会自动把 `/day/2026-10-12` 指到该文件；但**裸的对象存储（阿里云 OSS、腾讯云 COS）不会**，那种情况要么加 `trailingSlash: true`，要么在 CDN 上配 URL 重写。
- `out/` 已在 `.gitignore` 里，不会被提交。
- `next.config.ts` 里有 `experimental: { workerThreads: true, useTypeScriptCli: false }`：这是为了让构建在**禁止子进程的受限环境**里也能跑（构建 worker 与类型检查改用线程）。实测类型检查照常执行、产出正常。你的机器与 Cloudflare 都没有这个限制，删掉这一行回到 Next 默认行为也不会影响部署。

## 七、产品层面的已知限制（别把演示当成品）

站点能打开、能点、页面之间数据自洽，但**不能真正记账**：

- 没有登录与权限，任何页面都能直接打开。
- 没有后端、不落库，**数据是按日期规则确定性生成的假数据**，刷新即回到原样。
- 「保存」「解析」都没有真实副作用（解析返回的是写死的假结果）。
- 界面上的「AI 估算」标签来自生成规则，**没有接入任何大模型**。
- 「今天」取构建日期，不是浏览者打开页面的日期（所以才有上面第二节的每日重建）。
- 训练计划是固定的周表，与运动记录互不相关——这是刻意的，记录反映实际发生的事，不是计划的事。
