# ---------- 构建阶段 ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# 依赖单独一层：只要 package.json / package-lock.json 没变，改源码不会重建它
COPY package.json package-lock.json ./
# --ignore-scripts 是必要的，不是图快：better-sqlite3 自带 binding.gyp，而 npm 在
# 包里没有 install 脚本时会自动跑 node-gyp rebuild——精简镜像里没有 python3/make/g++，
# 于是构建直接失败。而它根本不需要编译：预编译二进制就在包的 prebuilds/ 里
#（linux-x64 / linuxmusl-x64 / darwin / win32 都齐全），运行时由 node-gyp-build
# 自己挑。本项目的其余依赖（next / react / drizzle / tsx / eslint / vitest）也都
# 不依赖 install 脚本，所以跳过生命周期脚本是安全的。
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Next 的 standalone server 默认绑到 HOSTNAME，而在容器里 HOSTNAME 是容器 ID——
# 于是容器内用 127.0.0.1 连不上自己，健康检查会一直报 unhealthy（实测过）。
# 显式绑 0.0.0.0：容器内的健康检查与容器外的端口映射都能连。
ENV HOSTNAME=0.0.0.0
# 数据库落在挂载的数据卷上：重建容器不丢数据。
# 首次启动时应用会自己建库并播种（见 instrumentation.ts 与 lib/db/bootstrap.ts）。
ENV DATABASE_PATH=/data/fitchat.db
# 迁移 SQL 的位置。这里刻意用绝对路径：Next 的 standalone server 启动时会把
# 工作目录切到 server.js 所在目录，靠相对路径很容易「莫名其妙找不到文件」。
ENV MIGRATIONS_FOLDER=/app/drizzle

# 非 root 运行。better-sqlite3 自带各平台预编译二进制，所以这里不需要
# python3/make/g++ 之类的构建工具链。
RUN useradd --create-home --uid 10001 app \
 && mkdir -p /data \
 && chown -R app:app /data /app

# standalone 产物自带最小依赖树（含原生模块），不必复制整个 node_modules
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# 迁移 SQL 必须跟着走：应用启动时会自己跑迁移，缺了它容器起不来
COPY --from=build --chown=app:app /app/drizzle ./drizzle

USER app
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
