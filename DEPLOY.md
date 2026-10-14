# 部署与更新（腾讯云 + Docker）

架构一句话：**Next.js 服务端渲染 + 一个 SQLite 文件 + Docker Compose**。没有外部服务、没有数据库服务器、没有定时任务。

- 数据落在宿主机的 `./data/fitchat.db`（挂载进容器），重建容器不丢数据。
- **应用自己建库**：首次启动时跑迁移、库里没有演示用户就播种（见 `instrumentation.ts` 与 `lib/db/bootstrap.ts`）。所以镜像里不需要额外的初始化步骤。
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

## 四、更新代码

```bash
cd fitchat
git pull
docker compose up -d --build
```

数据不受影响（它在 `./data` 上）。新增的迁移会在下次启动时自动应用。

## 五、备份

SQLite 就是一个文件，备份 = 复制它。**但不要在服务运行时直接 `cp`**（WAL 模式下可能拿到不一致的快照），先停容器：

```bash
mkdir -p backups
docker compose stop app
cp data/fitchat.db "backups/fitchat-$(date +%F).db"
docker compose start app
```

丢数据的代价目前很低（演示数据是确定性生成的，重建即可），但**一旦有了真实用户写入**，备份就不再是可有可无的。

## 六、排错

| 现象 | 原因与处理 |
|---|---|
| 页面 500，日志报「找不到迁移文件」 | `MIGRATIONS_FOLDER` 指错了。镜像里设的是 `/app/drizzle`，且 `drizzle/` 必须真的被复制进镜像（见 Dockerfile 的 COPY）。**不要依赖相对路径**：Next 的 standalone server 启动时会把工作目录切到 `server.js` 所在目录。 |
| 首次启动慢几秒 | 正常：在建库 + 播种。看日志确认没有报错即可。 |
| 端口连不上 | 腾讯云的**安全组**没放行 3000（这是最常见的）。 |
| 容器起来又立刻退出 | `docker compose logs app` 看日志，多半是建库失败（挂载目录权限）。 |
| 想重置演示数据 | `docker compose down && rm -rf data && docker compose up -d`（会重新建库并播种）。 |
| 本地开发要数据 | 在项目根目录跑 `npm run db:seed`（同样会建库 + 播种）。 |

## 七、为什么不再是静态站

原先这个项目是 `output: 'export'` 的纯静态站，托管在 Cloudflare Pages 上。换成服务端渲染的原因：

- **认证**（会话 cookie）与**写操作**都需要请求期有服务端，静态站做不到。
- 顺带解决了「今天」被冻在构建那一刻的问题——那套「每晚重新构建一次」的机制因此彻底退休。

那个 Cloudflare Pages 站点保留为**历史快照**，不再更新。为它准备的 vinext / OpenNext 适配没有采用：国内服务器这条路的依赖最少，也不需要 beta 工具链。
