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
 * 三处与 better-sqlite3 的真实差异被刻意抹平（都在测试里钉着）：
 *   1. 非查询语句调 .all()：better-sqlite3 抛错，D1 的 batch 两类语句都吃 → 按 reader 分流
 *   2. 事务：better-sqlite3 要求同步回调，交给它一个 async 回调会在语句执行前就提交
 *      → 内部同步执行，只把结果包成 Promise
 *   3. SQL 错误：better-sqlite3 在 prepare() 时同步抛，D1 是远端调用、错误从 Promise 里抛
 *      → 捕获同步错误，改从 Promise 抛出，否则调用方的 try/catch 在两边行为不一致
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

type SyncCapable = {
  [SYNC_EXEC]?: () => unknown[]
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
    let statement: Database.Statement | undefined
    let prepareError: unknown

    try {
      statement = sqlite.prepare(sql)
    } catch (error) {
      // 差异 3：同步的 prepare 错误改从 Promise 里抛（见文件头说明）
      prepareError = error
    }

    let params: unknown[] = []

    // 同步执行：真正干活的地方
    const execRows = (): unknown[] => {
      if (prepareError) throw prepareError
      return statement!.all(...(params as never[])) as unknown[]
    }
    const execRun = (): number => {
      if (prepareError) throw prepareError
      return Number(statement!.run(...(params as never[])).changes)
    }

    // 差异 1：batch 会同时收到查询与写入两类语句，better-sqlite3 对非查询语句调
    // .all() 会直接抛「This statement does not return data」——真 D1 不会。
    const execSync = (): unknown[] => {
      if (prepareError) throw prepareError
      return statement!.reader ? execRows() : (execRun(), [])
    }

    const api: D1StatementLike & SyncCapable = {
      bind(...values: unknown[]) {
        params = values
        return api
      },
      run: async () => ({ success: true, results: [], meta: metaOf(execRun(), 0) }),
      all: async () => ({ success: true, results: execRows(), meta: metaOf(0, 0) }),
      // D1 的 raw() 返回「每行是值数组」，drizzle 的 values 模式用它
      raw: async () => {
        if (prepareError) throw prepareError
        return statement!.raw().all(...(params as never[]))
      },
      [SYNC_EXEC]: execSync,
    }

    return api
  }

  return {
    prepare,
    async batch(statements: D1StatementLike[]) {
      // 真 D1 的 batch 在一个事务里顺序执行；这里照做，否则出错时留下的状态会不同。
      // 差异 2：不能用 sqlite.transaction(async …)——那样事务会在语句执行前就提交。
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
