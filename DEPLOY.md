# 部署与更新（腾讯云 + Docker）

架构一句话：**Next.js 服务端渲染 + 一个 SQLite 文件 + Docker Compose**。没有外部服务、没有数据库服务器、没有定时任务。

- 数据落在宿主机的 `./data/fitchat.db`（挂载进容器），重建容器不丢数据。
- **应用自己建库**：首次启动时跑迁移、库里没有演示用户就播种；演示用户已存在时检查演示数据 horizon，剩余不足 7 天就自动续播到「今天 + 90 天」（见 `instrumentation.ts` 与 `lib/db/bootstrap.ts`）。所以镜像里不需要额外的初始化步骤。
- 「今天」按请求计算，不是构建期常量——站点不会「过期」，**不需要每晚重建**。

## 一、服务器准备（一次性）

1. 买一台腾讯云轻量应用服务器 / CVM，镜像选 **Ubuntu 24.04 + Docker**（本清单按这个镜像写）。
2. 控制台 → 防火墙 / 安全组，放行：
   - **22**（SSH）
   - **3000**（先用 `IP:3000` 访问；之后套上 Nginx 再放行 80/443）
3. SSH 登录服务器。

**验证**：`docker --version` 与 `docker compose version` 都有输出。

## 二、把代码放上去并启动

```bash
git clone <你的仓库地址> fitchat
cd fitchat
mkdir -p data
sudo chown -R 10001:10001 data     # 见下方说明，这一步不能省
docker compose up -d --build
docker compose logs -f             # 看到 Ready 即可
```

> **为什么必须 chown**：容器以非 root 用户（uid 10001）运行，而 `./data` 是 Docker 在宿主机上以 root 创建的。不把目录交给 10001，应用就打不开数据库文件，日志里是 `SQLITE_CANTOPEN: unable to open database file`，页面全是 500。这一步是实测踩出来的。

首次启动会**多花几秒**：应用在建库并播种（数据覆盖「开始使用日 → 今天 + 90 天」，约 1800 条饮食记录）。

**验证**：浏览器打开 `http://<服务器IP>:3000`——首页日期栏应当是**当天**，四餐与圆环都有数据。

想确认数据落在哪：

```bash
ls -lh data/                      # 宿主机上的 fitchat.db
docker compose exec app ls -l /data
```

## 三、域名与 HTTPS（推荐，但需要备案）

用**域名**访问需要 ICP 备案（把域名解析到国内服务器并提供服务就必须备案），周期通常 1–2 周。备案期间可以继续用 `IP:3000` 开发和演示。

备案通过后，在服务器上装 Nginx 与证书：

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/fitchat`：

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fitchat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d 你的域名      # 申请证书并把上面的配置改成 443
```

之后可以把 compose 里的端口收成只绑本地：`"127.0.0.1:3000:3000"`，外部一律走 Nginx。

**上了 HTTPS 之后，务必打开会话 Cookie 的 Secure 标记**——在 `docker-compose.yml` 的 `environment` 里加一行：

```yaml
      SESSION_COOKIE_SECURE: '1'
```

默认是**关**的，因为明文 HTTP 下带 Secure 的 Cookie 会被浏览器直接丢弃，表现是「登录成功，但下一次请求又要求登录」。这是一个看起来像逻辑 bug 的现象，所以这里写清楚：**只要域名与证书生效了，就把它打开。**

## 四、账号与邀请码

站点是邀请制的：注册需要邀请码，**每个码只能用一次**。

- **演示账号**：`demo@fitchat.local` / `fitchat-demo`（口令公开，登录页上还有一个「先看看演示账号」按钮，点一下就能进）。它里面的数据是按日期确定性生成的假数据。
- **随部署附送三个一次性邀请码**，写在 `lib/db/demo.ts` 里（`FITCHAT-DEMO-1/2/3`，也是公开的）。它们不是安全边界，而是把「陌生人能注册几个账号」从无穷限到三个。
- 想换成自己的码，直接往库里插（**码值请用大写**，登录页会把输入转成大写再查）：

```bash
docker compose exec app node -e "const D=require('better-sqlite3');const db=new D('/data/fitchat.db');db.prepare('INSERT OR IGNORE INTO invite_codes (code, note, created_at) VALUES (?,?,?)').run('你的码','给谁',Date.now());db.close()"
```

- 想改演示账号的口令：设环境变量 `DEMO_PASSWORD` 后**删库重建**（口令只在建库时写入；已有库里若口令非空，重启不会覆盖它，这是有意的）。

## 五、更新代码

```bash
cd fitchat
git pull
docker compose up -d --build
```

数据不受影响（它在 `./data` 上）。新增的迁移会在下次启动时自动应用；**升级路径上有三件事是自动补齐的**，否则一个已经跑起来的站点会缺东西：

- 邀请码（新加的码会补进去，已经用掉的不会被重置）；
- 演示账号的口令（只在它为空时补，不覆盖运维改过的口令）；
- 食物库的新增条目（老库里只有 12 样套餐，新版加了 26 样常用单品）。

> 升级前建议先备份（见下一节）。表重建类的迁移已经用真实老库实测过：`users` 重建期间外键是关的，1431 条饮食记录、285 条运动记录、387 条体重记录在升级后一条不少（回归测试见 `lib/db/migrate.test.ts`）。

## 六、备份

SQLite 就是一个文件，备份 = 复制它。**但不要在服务运行时直接 `cp`**（WAL 模式下可能拿到不一致的快照），先停容器：

```bash
mkdir -p backups
docker compose stop app
cp data/fitchat.db "backups/fitchat-$(date +%F).db"
docker compose start app
```

丢数据的代价目前不低：库里已经有真实写入（记录饮食、运动、体重、目标）。**升级前先备份**，尤其是带表重建的迁移。

## 七、排错

出事了先看日志——两处都有：

```bash
sudo docker compose logs -f --tail=200 app   # 控制台：访问日志与错误，实时
ls data/logs/                                # 文件：每日一个 app-YYYY-MM-DD.log，保留 14 天
```

日志文件落在数据库同一个卷上（`data/logs/`），重启容器不丢；每行是 JSON：`time`（ISO 时间）、`type`（`access` / `request-error` / `fatal`）、`level`。请求内出错（页面渲染、route handler、server action）会带 `path` / `method` / `routeType`，与访问日志前后对照即可定位「是哪次请求出的错」。未捕获的进程级异常记成 `fatal` 后进程退出，容器会自动重启（`restart: unless-stopped`）。

| 现象 | 原因与处理 |
|---|---|
| 页面 500，日志报「找不到迁移文件」 | `MIGRATIONS_FOLDER` 指错了。镜像里设的是 `/app/drizzle`，且 `drizzle/` 必须真的被复制进镜像（见 Dockerfile 的 COPY）。**不要依赖相对路径**：Next 的 standalone server 启动时会把工作目录切到 `server.js` 所在目录。 |
| 首次启动慢几秒 | 正常：在建库 + 播种。看日志确认没有报错即可。 |
| 端口连不上 | 腾讯云的**安全组**没放行 3000（这是最常见的）。 |
| 容器起来又立刻退出 | `docker compose logs app` 看日志，多半是建库失败（挂载目录权限）。 |
| **登录成功，但下一次请求又要登录** | 上了 HTTPS 却没设 `SESSION_COOKIE_SECURE=1`（或反过来：明文 HTTP 下开了它，Cookie 会被浏览器丢掉）。见第四节。 |
| 登录一直说口令不对 | 演示账号的口令只在**建库时**写入；老库里若已有口令，重启不会覆盖。要重置就改 `DEMO_PASSWORD` 后删库重建。 |
| 注册提示邀请码用完 | 三个附送的码各只能用一次。要更多名额就按第四节插新码。 |
| 想重置演示数据 | `docker compose down && rm -rf data && docker compose up -d`（会重新建库并播种）。**这会删掉所有真实写入。** |
| 本地开发要数据 | 在项目根目录跑 `npm run db:seed`（同样会建库 + 播种）。 |

## 八、为什么不再是静态站

原先这个项目是 `output: 'export'` 的纯静态站，托管在 Cloudflare Pages 上。换成服务端渲染的原因：

- **认证**（会话 cookie）与**写操作**都需要请求期有服务端，静态站做不到。
- 顺带解决了「今天」被冻在构建那一刻的问题——那套「每晚重新构建一次」的机制因此彻底退休。

那个 Cloudflare Pages 站点保留为**历史快照**，不再更新。为它准备的 vinext / OpenNext 适配没有采用：国内服务器这条路的依赖最少，也不需要 beta 工具链。
