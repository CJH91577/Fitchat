import Database from 'better-sqlite3'

/**
 * Cloudflare D1 的兼容层——**只用于测试与本地开发，生产走真正的 D1 绑定**。
 *
 * 为什么要它：这次迁移要统一到一个驱动（`drizzle-orm/d1`，因为线上是 D1），
 * 但 vitest 跑在 Node 里、workerd 起不来，而 `@cloudflare/vitest-pool-workers`
 * 又跑不了 jsdom 的 React 测试。于是在 better-sqlite3 上实现 D1 那点接口，
 * 让应用代码只有一个驱动，测试仍留在 vitest 里。
 *
 * 接口范围不是猜的，是对着 drizzle-orm/d1 的 session 实现定的：
 *   client.prepare(sql) → stmt.bind(...) → stmt.run() / stmt.all() → { results } / stmt.raw()
 *   client.batch([...])；事务直接用 begin / commit / rollback 走 SQL
 *
 * 内部是「同步执行 + 对外返回 Promise」两层：better-sqlite3 的事务要求
 * 同步回调，若把 async 回调交给 sqlite.transaction，事务边界会失效
 * （回调一返回就提交，而真正的语句还没跑）。所以真正干活的是同步版本，
 * 异步只是外壳。
 */
export type D1StatementLike = {
  bind(...params: unknown[]): D1StatementLike
  run(): Promise<unknown>
  all(): Promise<{ results: unknown[] }>
  raw(): Promise<unknown>
}

export type D1Like = {
  prepare(sql: string): D1StatementLike
  batch(statements: D1StatementLike[]): Promise<unknown>
  exec(sql: string): Promise<unknown>
}

/**
 * 兼容层比 D1Like 多一个 close()：真正的 D1 没有连接可关，所以它**不属于**
 * D1 接口——应用代码只拿到 D1Like，调不到它。测试与本地脚本用完要关，
 * 否则 Windows 上删不掉库文件（打开着的文件删不掉）。
 */
export type D1Shim = D1Like & { close(): void }

function metaOf(changes: number, lastRowId: number | bigint): Record<string, unknown> {
  // D1 的 D1Result.meta 形状；drizzle 只取 results，其余字段是为了让
  // 将来若有代码读 meta 时拿到合理的值，而不是 undefined。
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: changes,
    last_row_id: Number(lastRowId),
    changed_db: changes > 0,
    changes,
  }
}

/** 兼容层内部的同步句柄：batch 需要它才能在同一个事务里跑 */
const SYNC_EXEC = Symbol('d1ShimSyncExec')
const SYNC_RUN = Symbol('d1ShimSyncRun')

type SyncCapable = {
  [SYNC_EXEC]?: () => unknown[]
  [SYNC_RUN]?: () => number
}

export function createD1Shim(
  path: string,
  options: { foreignKeys?: boolean; wal?: boolean } = {},
): D1Shim {
  const sqlite = new Database(path)

  // SQLite 默认不校验外键——不显式打开的话，schema 里的 references() 只是文档。
  if (options.foreignKeys !== false) sqlite.pragma('foreign_keys = ON')
  if (options.wal !== false && path !== ':memory:') sqlite.pragma('journal_mode = WAL')

  function prepare(sql: string): D1StatementLike {
    const statement = sqlite.prepare(sql)
    let params: unknown[] = []

    // 同步执行：真正干活的地方
    const execRows = () => statement.all(...(params as never[])) as unknown[]
    const execRun = () => Number(statement.run(...(params as never[])).changes)

    // batch 会同时收到查询与写入两类语句，而 better-sqlite3 对非查询语句调
    // .all() 会直接抛「This statement does not return data」——真 D1 不会。
    // 按 statement.reader 分流，消掉这处差异。
    const execSync = () => (statement.reader ? execRows() : (execRun(), []))

    const api: D1StatementLike & SyncCapable = {
      bind(...values: unknown[]) {
        params = values
        return api
      },
      run: async () => ({ success: true, results: [], meta: metaOf(execRun(), 0) }),
      all: async () => ({ success: true, results: execRows(), meta: metaOf(0, 0) }),
      // D1 的 raw() 返回「每行是值数组」，drizzle 的 values 模式用它
      raw: async () => statement.raw().all(...(params as never[])),
      [SYNC_EXEC]: execSync,
      [SYNC_RUN]: execRun,
    }

    return api
  }

  return {
    prepare,
    async batch(statements: D1StatementLike[]) {
      // 真 D1 的 batch 在一个事务里顺序执行；这里照做，否则出错时留下的状态会不同。
      // 注意不是 sqlite.transaction(async ...)——那样事务会在语句执行前就提交。
      return sqlite.transaction(() =>
        statements.map((item) => (item as unknown as SyncCapable)[SYNC_EXEC]?.() ?? []),
      )()
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
    close() {
      sqlite.close()
    },
  }
}
