# Fitchat 项目说明（交接给下一个 agent 先读这份）

> 这份文档的目的是：**让一个从没看过这个仓库的 agent，在半小时内能安全地改代码、加功能、部署，而不破坏已有的东西。**
> 产品设计看 `docs/superpowers/specs/`，待办看 `TASKS.md`，部署看 `DEPLOY.md`，本文件讲的是**代码怎么组织、哪些东西不能碰、怎么验证**。

- **在线演示**：<http://43.142.16.200:3000>（腾讯云 Docker；现在是登录制，见下）
- **仓库**：`C:\Users\admin\Fitchat`（Windows 开发机）；生产在服务器 `/home/ubuntu/fitchat`
- **规模**：62 个源文件 + 43 个测试文件（353 个测试）+ 2 个迁移 + 11 张表

---

## 一、五分钟跑起来

```bash
npm install
npm run db:seed     # 建库 + 迁移 + 播种演示数据（约 1800 条，覆盖 387 天）
npm run dev         # http://localhost:3000
```

**打开第一件事是登录**：点「先看看演示账号」即可，或用 `demo@fitchat.local` / `fitchat-demo`；
想注册就用 `FITCHAT-DEMO-1/2/3` 之一 + 自己的邮箱（**每个码只能用一次**），新账号会先走一次首次引导。

验证命令（**任何改动之后都必须四条全绿再提交**）：

```bash
npm test            # 353 个测试
npx tsc --noEmit    # 类型检查（Windows 上若 npx.ps1 被策略禁用，用 npm.cmd exec tsc -- --noEmit 或 node_modules\.bin\tsc.cmd）
npm run lint        # ESLint，要求 0 warning
npm run build       # 生产构建（standalone）
```

---

## 二、技术栈与目录

Next.js 16（App Router，**服务端渲染**）· React 19 · TypeScript 5 · SQLite + Drizzle ORM · CSS Modules（**不用 Tailwind**）· Vitest + React Testing Library

```
app/
  layout.tsx                根布局（html/body、metadata；不在这里放底栏）
  (app)/                    已登录区域：路由分组，不改变 URL
    layout.tsx              底栏 + 第二道登录守卫
    page.tsx                首页（两个环 + 圆心净热量 + 今日饮食/运动/体重）
    calendar/               日历页（服务端算达成状态，客户端翻月）
    day/[date]/             某日详情（只读）
    trends/                 趋势页（最近 7 天 + 一行结论）
    plan/                   训练计划（只读周表）
    me/                     我的（资料、目标、退出登录）
    meals/new/              记录饮食（page=服务端取数据，MealForm=客户端表单，actions=写入）
    workouts/new/           记录运动（同上三段式）
    onboarding/             首次引导（两步：资料 → 算出的目标可微调）
    weight-action.ts        首页体重录入的 Server Action（不在页面目录里的 action 文件被 Next 忽略，是允许的）
  login/                    登录/注册（唯一公开页面；page=服务端壳，LoginForm=客户端）
lib/
  auth/                     认证：password（scrypt）、session（令牌哈希）、cookie（唯一边界）、
                            account（登录/注册规则）、actions（Server Action）、current-user（守卫）
  db/                       schema（11 表）、migrations、d1-shim（D1 接口的本地实现）、
                            queries（读）、writes（写）、seed、bootstrap（启动建库）、runtime（连接与用户）
  data/                     纯数据层：types、dates、selectors、generator、mock、pantry（食物单品）、
                            meal-parser（一句话解析）、target（目标估算）、workout（消耗估算）、today
components/                 RingGroup / HeroFigure / CalendarMonth / CalendarView / BottomNav /
                            WeightTable / SurplusTable / AiBadge
tests/                      setup、seeded-db（种子库夹具）、auth-cookie-mock、next-navigation-mock、
                            source（契约测试工具）、auth-guard、deployment-contract、css-modules-contract
drizzle/                    手写的迁移 SQL + meta/_journal.json（见第六节）
scripts/                    migrate.ts、seed.ts（CLI）
```

---

## 三、必须守住的不变量（改了会出事）

这些不是风格偏好，每一条都对应一次真实故障或一次差点上线的 bug。**破坏它们时测试会红**——如果测试没红，说明你也该补一条测试。

| # | 不变量 | 为什么 / 违反了会怎样 | 谁在守 |
|---|---|---|---|
| 1 | 页面不直接 import drizzle；读写只走 `lib/db/queries.ts`（读）与 `lib/db/writes.ts`（写） | 「写入有没有检查归属」「有没有放进事务」只在这两个文件回答一次 | 代码约定 + review |
| 2 | 页面取当前用户**只能**用 `lib/auth/current-user.ts` 的 `requireUser()` | 用 `getDemoUser()` 会让所有人看到同一个人的数据 | `tests/auth-guard.test.ts` 逐页检查 |
| 3 | 直接读请求 Cookie 的**只有** `lib/auth/cookie.ts` | 页面测试靠替换这一个模块模拟登录；多一个入口，页面就会以为「没人登录」，测试也会被改成假的 | `tests/auth-guard.test.ts` |
| 4 | 每个读数据库的页面都要 `export const dynamic = 'force-dynamic'` | 漏了会被构建期预渲染：页面照常 200，但数据永远冻在构建那天 | `tests/deployment-contract.test.ts` |
| 5 | 「今天」一律用 `lib/data/today.ts` 的 `today()` | 它按 `Asia/Shanghai` 在**请求期**算；别处自己 `new Date()` 会在容器（UTC）里差 8 小时 | 同上 |
| 6 | 日期一律 `YYYY-MM-DD` 文本键（`lib/data/dates.ts`） | 不要往库里写 `Date` 对象：跨时区会被隐式转 UTC，日期整体错位 | 类型 + 约定 |
| 7 | 营养值是**快照**，写记录时冻结 | 食物库日后被修正，历史记录不能跟着变，否则「那天吃了多少」会被追溯改写 | `lib/db/writes.ts` 注释 |
| 8 | 写入的数字由**服务端重算**，客户端只报 id 与克数/时长/组数 | 表单数据是用户可改的；信它等于记录里的热量由浏览器说了算 | `actions.test.ts` 里有「塞 99999 被忽略」的用例 |
| 9 | 删除/更新必须带 `user_id` 条件（写在 WHERE 里，不要先查再比） | 先查后删在两次查询之间有窗口；而且后来者可能把查出来的结果换掉，检查就静默失效 | `actions.test.ts` 的归属用例 |
| 10 | 空态要区分「还没开始用」/「当天没记」/「没有目标」 | 三种状态的用户感受完全不同；不许渲染 `null`、`NaN`，也不许编一个数字 | 各页面测试 |
| 11 | 不做「好坏着色」：体重涨跌、热量盈余都不上红绿 | 增肌期体重上涨是预期结果，红绿会直接冒犯用户 | `page.test.tsx`、`WeightTable.test.tsx` |
| 12 | CSS 类名必须同时存在于同目录的 `.module.css` | 拼错类名时 CSS Modules 返回 `undefined`，React 静默省略 class——构建/lint/测试全绿但布局失效 | `tests/css-modules-contract.test.ts` |
| 13 | 迁移 SQL 与 `schema.ts` 必须一致 | 漂移没有任何症状，直到线上报 `no such column` | `lib/db/schema.test.ts`（逐表逐列比对） |
| 14 | 跑迁移的连接上**必须关掉外键** | 见第六节事故；关掉之后由 `foreign_key_check` 兜底 | `lib/db/migrate.test.ts`（去掉修复就转红） |

---

## 四、领域语义（最容易弄错的地方）

- **`dayLogFor()` 的三种返回**：`null` = 那天用户**还没开始用**；空数组 = 在范围内但**什么都没记**；有内容 = 正常。合并前两者会丢掉一个真实状态（见 `lib/db/queries.ts` 的注释）。
- **未来的日期**：`isUpcoming(date, today)` 为真时，日历格子不可点、某日详情显示「这一天还没有到」。数据层对未来日期照样算得出内容，所以**判断必须在界面层做**。
- **体重一天一条**：`weight_entries` 的主键是 `(user_id, date)`，再记是**改**今天那条，不是追加——否则趋势页的日均值会把同一天算两遍。
- **目标一用户一行**：`goals` 以 `user_id` 为主键，改目标就是覆盖，**刻意不做版本历史**。副作用：趋势页回顾历史盈余用的是「当前目标」，这是已知取舍（写在 `schema.ts` 里）。
- **邀请码一次性**：`invite_codes` 用掉后 `used_by_user_id` 落库；重复播种**不会**把它重置回未使用（否则等于凭空多出注册机会）。
- **会话**：库里存的是**令牌的 SHA-256**，不是令牌本身；令牌是 32 字节随机数；退出登录 = 删掉那一行（所以是即时失效，签名令牌做不到）。
- **`food_entries.source`**：`curated`（食物库）/ `user`（用户自建）/ `ai-estimate`。**真实用户写入只会产生前两种**——项目没有接任何大模型，「一句话解析」是词表 + 量词换算（`lib/data/meal-parser.ts`）。演示数据里的 `ai-estimate` 是生成规则打上的，README 有说明。
- **演示账号的口令是公开的**（`lib/db/demo.ts`）：它里面是确定性生成的假数据，把公开口令包装成安全边界只会让人卡在门口。
- **播种范围 = 今天 + 90 天**（`SEED_HORIZON_DAYS`）。多播是为了「打开就有内容」；未来日期的格子本来就不可点。代价：播种日 + 90 天之后首页会显示「未记录」，需要补播（见 `TASKS.md` P0-1）。
- **食物库只能往后追加**：`starterFoodId(index)` 用下标算 id，插队会让现有部署里记录的 `food_id` 指到别的食物上。

---

## 五、数据模型（11 张表，一句话各表）

| 表 | 一句话 |
|---|---|
| `users` | 身份 + 资料（身高/年龄/性别**可空**，注册只要邮箱口令，资料在首次引导补）+ `started_at`（记录范围的起点）|
| `sessions` | 会话；`id` 是令牌的 sha256，`expires_at` 30 天 |
| `invite_codes` | 一次性邀请码，记谁用了、什么时候用的 |
| `goals` | 每日目标（方向、热量、三大营养素、运动消耗、目标体重），一用户一行 |
| `foods` | 食物库（`per_grams` 是那组营养值对应的克数——单品是 100，套餐是「一份」）|
| `food_entries` | 饮食记录；`(user_id, date)` 索引；营养值是快照；带 `source` |
| `exercise_entries` | 运动记录；`kind` = cardio（有 `minutes`）或 strength；带 `calories_burned` |
| `strength_sets` | 力量动作的每一组（`set_index` 从 1 开始，顺序不靠数据库返回顺序）|
| `weight_entries` | 体重；复合主键 `(user_id, date)`，一天一条 |
| `plan_days` / `plan_items` | 训练计划：一周七天各一行 + 每天的动作与目标组数次数 |

---

## 六、迁移：必须知道的四件事

1. **迁移 SQL 是手写的**（`drizzle/0000_init.sql`、`0001_users_profile_optional.sql`）。这台开发机禁止子进程管道，`drizzle-kit generate` 会 `spawn EPERM`。语句之间必须用 drizzle 的 statement-breakpoint 标记分隔；**注释里不能出现该标记的完整字样**，否则切分会从注释中间断开，迁移以「no statements」失败（踩过）。
2. **改列的约束只能靠表重建**（建新表 → 搬数据 → 删旧表 → 改名），而 `users` 下面挂着 `ON DELETE CASCADE` 的子表。
3. **`PRAGMA foreign_keys` 在事务里是空操作**，而迁移器把每个迁移包在事务里 → 迁移文件里写那句没用。外键是在 `lib/db/migrate.ts` 里、**执行迁移的连接上**关掉的；迁移之后跑 `foreign_key_check`，有孤儿行就直接失败。
   > 事故记录：0001 第一次跑在真实老库上时，`DROP TABLE users` 按级联把演示用户的 **1431 条饮食记录、285 条运动、387 条体重、696 组**全删了，用户那一行还在——从界面上看就是「账号还在，数据没了」。修好后在同一个老库上重测：一条不少。
4. **升级一个已经跑起来的站点**时，播种整段会被跳过（演示用户已存在），所以「新版本才有的东西」必须单独补齐：邀请码、演示账号口令、食物库新增条目（都在 `lib/db/bootstrap.ts`，用 on-conflict-do-nothing，**已有的不动**）。

`lib/db/migrate.test.ts` 用假的迁移目录复现了老库的形状，**去掉修复就会转红**。

---

## 七、怎么验证（别只跑测试）

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

**真机验证**（改了渲染或认证之后强烈建议做一次）：

```bash
# 1) 起一个 standalone 服务，指向一份临时库
$env:DATABASE_PATH = "$env:TEMP\check\fitchat.db"
$env:MIGRATIONS_FOLDER = "C:\Users\admin\Fitchat\drizzle"   # standalone server 会 chdir，必须绝对路径
$env:PORT = '3100'; $env:HOSTNAME = '127.0.0.1'
node .next/standalone/server.js

# 2) 造一条会话（令牌的 sha256 才是库里那行的 id）
node -e "const D=require('better-sqlite3');const {createHash,randomBytes}=require('node:crypto');
const db=new D(process.env.DATABASE_PATH);const t=randomBytes(32).toString('base64url');
db.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)')
  .run(createHash('sha256').update(t).digest('hex'),'demo-user',Date.now()+36e5,Date.now());
console.log('TOKEN='+t);db.close()"

# 3) 带 Cookie 打请求，检查状态码与内容
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://127.0.0.1:3100/trends      # 无 Cookie → 307 /login
curl -s -H "Cookie: fitchat_session=<TOKEN>" http://127.0.0.1:3100/ | grep 今日空腹体重
```

**服务器上怎么查**（不需要在宿主机装 Node，容器里有）：

```bash
sudo docker compose exec -T app node -e "..."          # 简单的一行
sudo docker run --rm --user root -v /home/ubuntu/fitchat/data:/d -v <脚本>:/app/x.js:ro -w /app fitchat:latest node /app/x.js
# 注意：脚本要挂到 /app 里才 require 得到 better-sqlite3；挂 /tmp 会 MODULE_NOT_FOUND
```

**部署**（详见 `DEPLOY.md`）：升级前先备份（停容器再 `cp`，WAL 模式下运行时直接拷可能不一致）→ 覆盖源码（保留 `data/`、`backups/`）→ `sudo docker compose up -d --build` → 逐表比对备份与现行库，确认**没有任何一张表减少**。

---

## 八、这台开发机的坑（会浪费你半小时的那种）

- **不能起子进程管道**：`npx`、`tsx`、`esbuild`、`drizzle-kit` 都会 `spawn EPERM`（`db:generate` 因此跑不了，`next build` 也需要 `experimental.workerThreads` 才过）。
- **`npx.ps1` / `npm.ps1` 被策略禁用** → 用 `npm.cmd`、`npx.cmd`，或 `node_modules\.bin\*.cmd`。
- **连不上 GitHub**：`git fetch` 会因 schannel 报 `SEC_E_NO_CREDENTIALS`。推代码要在用户自己的终端做。
- **不要把源码文件交给 PowerShell 文本 cmdlet 处理**：`Get-Content -Raw | Set-Content` 会把中文注释变成乱码（踩过，一个文件被搞坏）。用编辑工具改。
- **PowerShell 会吃掉传给原生命令的引号** → 稍微复杂的 JS 一律**写成文件再 `node 文件`**，不要 `node -e "..."`。
- **临时目录**：`$env:TEMP` 在一个会话里稳定，但每个 shell 调用是新进程 → 环境变量不会跨调用保留，路径要每次重设。
- **测试里的 `use*` 命名**：ESLint 的 `react-hooks/rules-of-hooks` 只认前缀，`useSecureCookie` / `useSeededDatabase` 这种普通函数会被判成「在非组件里调用 Hook」（踩过两次，改名即可）。

---

## 九、交接约定

1. `AGENTS.md` 的规矩：**每次改动都要有一个对应的 Git commit，并且交付前测试与验证必须全绿**。
2. **不要动线上数据**：线上库在服务器 `/home/ubuntu/fitchat/data/fitchat.db`，里面有真实写入。要验证就用临时库或副本（本项目的做法：拷一份老库副本，在副本上跑迁移与验证）。
3. **凭据不进仓库**：服务器口令、邀请码都只走环境变量或数据库；仓库里只保留**故意公开**的演示口令与三个一次性邀请码。
4. 改了产品行为，就同步改 `README.md`（定位/已知限制）、`DEPLOY.md`（运维）、`docs/superpowers/specs/`（设计与实现的差异要如实记）与走查清单（人要去点的项）。
5. 发现「测试是绿的但没测到东西」比发现 bug 更值钱——这个仓库里有三条契约测试就是这么来的（见第三节 #12/#13/#14 与 `tests/deployment-contract.test.ts` 的文件头注释）。

---

## 十、当前状态与已知限制

- **线上**：`http://43.142.16.200:3000`，容器 healthy，登录制；老库升级实测数据一条没丢。
- **已知限制**：见 `README.md` 的「已知限制」与 `docs/superpowers/plans/demo-走查清单.md` 第四节（口令找回、限流、体重只能记今天、计划只读、食物自建入口、错误监控、演示数据 90 天时限…）。
- **待办**：见 `TASKS.md`。
