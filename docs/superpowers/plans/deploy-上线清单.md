# Fitchat 上线清单（Vercel，以及将来迁回国内）

> 这份清单是给人照着做的，每一步都有一个可以自己验证的结果。
>
> 当前状态：代码已就绪——CI 与每晚重建的工作流都已提交，只差一个 GitHub 仓库和一个 Vercel 项目。

## 一、上线（约 10 分钟）

### 1. 推上 GitHub

先在 GitHub 网页上建一个**空仓库**：不要勾选 README、.gitignore、License，否则首次推送会撞车。然后：

```bash
cd C:\Users\admin\codex_project\Fitchat
git remote add origin https://github.com/<用户名>/fitchat.git
git push -u origin main
```

**验证**：仓库里能看到完整提交历史；Actions 里 CI 已自动跑起来并且是绿的。

CI 徽章已经加在 README 顶部。如果换了仓库位置，徽章地址是：

```markdown
![CI](https://github.com/<用户名>/<仓库>/actions/workflows/ci.yml/badge.svg)
```

### 2. 连 Vercel

vercel.com → Add New → Project → Import 刚推上去的仓库 → Framework 会自动识别为 Next.js → Deploy。

**不需要改任何配置**：项目没有环境变量、没有数据库、没有密钥。

**验证**：拿到 `*.vercel.app` 链接；用手机打开，首页日期栏显示的是**今天**，而不是搭建那一天。

### 3. 配 Deploy Hook（让「今天」每天自己往前走）

「今天」在构建时确定（见 `next.config.ts`），站点不会自己往前翻页，所以需要每天重建一次：

1. Vercel 项目 → Settings → Git → Deploy Hooks → 新建一个（名字随意，分支填 `main`）→ 复制 URL
2. GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret
3. 名字必须叫 `VERCEL_DEPLOY_HOOK`，值粘贴刚才那个 URL

**验证**：GitHub → Actions → 每晚重建 → Run workflow，跑完应变为绿色，Vercel 上多出一条部署记录。

不配也不会静默失败——工作流会明确报出缺少这个密钥。

### 4. 域名（可选，但值得）

Vercel 项目 → Settings → Domains → 添加域名，按提示改 DNS。年成本约 60 元。

**买域名时选 `.com` 或 `.cn`。** 将来若迁回国内就要备案，而备案要求域名后缀在工信部批复的列表内；`.app` 之类是否可备案我未能联网核实，不值得为省十几块钱冒这个险（换域名等于重新备案）。

## 二、为什么是 Vercel

| 方案 | 成本 | 上手 | 国内访问 | 需要改代码 |
|---|---|---|---|---|
| **Vercel 免费版（当前选择）** | ¥0 | 10 分钟 | 自定义域名一般可用，偶有波动 | 不用 |
| Cloudflare Pages | ¥0 | 20 分钟 | 通常可以，也会波动 | 要，需静态导出 |
| 阿里云 OSS + CDN | ¥10–30/月 | 半天 + 备案 | 最快最稳 | 要，需静态导出 |
| GitHub Pages | ¥0 | 30 分钟 | 一般 | 要，需静态导出 + basePath |

Vercel 面向个人非商业用途免费，作品集符合。它还有个额外好处：**每个 PR 自动生成一条预览链接**。

## 三、将来迁回国内：已用真实构建验证

2026-10-01 实测（把 `output: 'export'` 临时加进 `next.config.ts` 构建了一次）：

- **只需加一行 `output: 'export'`，构建一次通过，没有任何报错。** 其余代码不用动——375 个某日详情页已在构建期预生成。
- 产出 `out/` 目录：**1957 个文件、约 19 MB**。
- 产出结构要注意：首页是 `out/index.html`，某日详情页是 `out/day/2026-10-01.html`（**是 `日期.html`，不是 `日期/index.html`**）。
  - Vercel / Cloudflare Pages / Netlify 会自动把 `/day/2026-10-01` 指到 `2026-10-01.html`，不用管；
  - 裸的 OSS / COS 静态托管不会，要么再加 `trailingSlash: true`（产出 `2026-10-01/index.html`），要么在 CDN 上配 URL 重写。
- **顺序：先备案，再切换。** 备案期间域名不能正常解析访问，先切会白白断一段时间。
- 备案需要名下有符合接入商当期要求的国内云资源，周期通常一至两周。

## 四、上线后怎么确认「真的成了」

| 什么时候 | 看什么 | 通过标准 |
|---|---|---|
| 刚上线 | 手机打开线上链接 | 日期是今天、日历高亮在今天、五个导航都能点开 |
| 刚上线 | 电脑打开同一链接 | 内容居中成一条手机宽度的竖列，底栏与内容列同宽对齐 |
| 第二天再看 | 首页日期栏 | 仍是「今天」——说明定时重建生效了；若还停在前一天，去 Actions 看「每晚重建」是否失败 |
