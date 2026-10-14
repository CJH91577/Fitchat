import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import * as schema from './schema'

/**
 * 把迁移应用到**本地库文件**——服务进程、本地开发与测试都走这里。
 *（线上是同一套：容器里也是这个 SQLite 文件，只是挂在数据卷上。）
 *
 * 仍然借 better-sqlite3 的迁移器，而不是自己解析 SQL 文件：迁移的执行顺序
 * 与记账（__drizzle_migrations 表）交给 drizzle 自己管，免得两份实现日后分歧。
 * 用完即关——Windows 上打开着的文件删不掉，测试要清临时目录。
 *
 * 关于 migrationsFolder：它是相对**工作目录**解析的，而 Next 的 standalone
 * server 启动时会把工作目录切到 server.js 所在目录。所以容器镜像里 drizzle/
 * 必须与 server.js 同目录（见 Dockerfile）。找不到时这里给出明确提示——
 * 否则你只会看到 drizzle 内部一句「Can't find meta/_journal.json」，
 * 完全看不出是工作目录的问题。
 */
export function applyMigrations(
  path: string,
  migrationsFolder: string = process.env.MIGRATIONS_FOLDER ?? './drizzle',
): void {
  const journal = join(migrationsFolder, 'meta', '_journal.json')
  if (!existsSync(journal)) {
    throw new Error(
      `找不到迁移文件：${resolve(journal)}（当前工作目录 ${process.cwd()}）。` +
        '容器镜像里 drizzle/ 必须与 server.js 放在同一层；' +
        '本地调试可以用环境变量 MIGRATIONS_FOLDER 指定它的位置。',
    )
  }

  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)

  /*
   * 迁移期间关掉外键，这不是「小心一点」，是 SQLite 的规则决定的：
   *
   *   1. `PRAGMA foreign_keys` 在**事务里是空操作**。而 drizzle 的迁移器把每个
   *      迁移文件包在一个事务里执行，所以迁移 SQL 自己写的那句
   *      `PRAGMA foreign_keys=OFF` 根本不起作用——连接上的设置才是真的。
   *   2. 改列的约束（比如去掉 NOT NULL）在 SQLite 里只能靠表重建：
   *      建新表 → 搬数据 → 删旧表 → 改名。而 users 下面用 ON DELETE CASCADE
   *      挂着这个用户的全部记录，一旦删旧表就会连带把它们清空。
   *
   * 这条不是纸上推演：0001 迁移第一次跑在真实的老库上时，演示用户的
   * 1431 条饮食记录、全部运动与体重记录都被这句 DROP 顺手删掉了，
   * 而用户那一行还在——从界面上看就是「账号还在，数据没了」。
   */
  sqlite.pragma('foreign_keys = OFF')
  migrate(drizzle(sqlite, { schema }), { migrationsFolder })

  // 外键关掉之后就没人替我们看着引用完整性了，所以迁移完自己查一遍。
  // 有孤儿行就**直接失败**：让部署停在这里，而不是把一份悄悄坏掉的库
  // 留给应用——那要等到某天页面显示空数据才会被发现。
  const violations = sqlite.pragma('foreign_key_check') as { table: string; rowid: number }[]
  sqlite.close()

  if (violations.length > 0) {
    throw new Error(
      `迁移之后引用完整性检查没通过：${violations
        .map((row) => `${row.table}#${row.rowid}`)
        .join('、')}。` +
        `库文件：${resolve(path)}。这说明某个迁移留下了孤儿行，` +
        '不要带着这份库启动服务，先从备份恢复再查迁移。',
    )
  }
}
