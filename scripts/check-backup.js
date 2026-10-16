// 备份完整性校验：打开 backups/ 里最新的一份，跑 integrity_check 并数行数。
// 在服务器上用 fitchat 镜像挂载运行（better-sqlite3 从 /app 的 node_modules 解析）。
const D = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dir = '/b';
const files = fs
  .readdirSync(dir)
  .filter((name) => /^fitchat-.*\.db$/.test(name))
  .sort();
const latest = files[files.length - 1];
if (!latest) {
  console.error('no backup file found in', dir);
  process.exit(1);
}

const db = new D(path.join(dir, latest), { readonly: true });
console.log('file:', latest);
console.log('integrity:', JSON.stringify(db.pragma('integrity_check')));
console.log('tables:', db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n);
for (const table of ['users', 'food_entries', 'exercise_entries', 'strength_sets', 'weight_entries']) {
  console.log(table + ':', db.prepare(`SELECT count(*) n FROM ${table}`).get().n);
}
db.close();
