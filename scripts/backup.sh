#!/usr/bin/env bash
# 每日备份 SQLite 到 backups/，保留最近 14 份。
#
# 用容器里的 better-sqlite3 在线 backup（WAL 模式下仍然一致），
# **不需要停容器**——之前 DEPLOY.md 里「先停容器再 cp」是给手动的
# 安全下限，这个脚本走的是 SQLite 自己的备份 API。
#
# 服务器上装进 crontab（选一个避开整点的分钟）：
#   7 3 * * * /home/ubuntu/fitchat/scripts/backup.sh >> /home/ubuntu/fitchat/backups/backup.log 2>&1
#
# 验证当天那份：
#   docker compose exec -T app node -e "const D=require('better-sqlite3');const db=new D('/backups/fitchat-$(date +%F).db',{readonly:true});console.log(db.pragma('integrity_check'));db.close()"
set -euo pipefail

cd "$(dirname "$0")/.."

STAMP="$(date +%F)"

docker compose exec -T app node -e "
const D = require('better-sqlite3');
(async () => {
  const db = new D('/data/fitchat.db');
  // better-sqlite3 13.x 的 backup 是异步的（返回 Promise）：必须 await 完
  // 才能 close，否则备份在连接关闭后才真正执行，报 connection is not open
  await db.backup('/backups/fitchat-$STAMP.db');
  db.close();
  console.log('backup ok: /backups/fitchat-$STAMP.db');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"

# 保留最近 14 份，更早的删掉
ls -1t backups/fitchat-*.db 2>/dev/null | tail -n +15 | xargs -r rm --
