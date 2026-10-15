import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { addDays, todayKey } from './data/dates'
import { dbPath } from './db/index'

/**
 * 文件日志：错误与访问记录的落地处。
 *
 * 站点在公网跑，而「出事了能看」是底线——没有它，一个 500 只能靠猜。
 * 刻意不接外部服务（Sentry 之类）：这台机器与服务器都只有 Node + SQLite，
 * 文件 + docker logs 就够定位。两边都写：控制台（docker logs 实时看）
 * 与每日一个的日志文件（落在数据库旁边的挂载卷上，重启不丢，保留 14 天）。
 *
 * 日志文件自己按天轮转并在轮转时清掉过期文件——不依赖 cron。
 * 写入用同步 API：这个站点的量级下阻塞可以忽略，换来的是「fatal 日志在
 * process.exit 之前一定落盘」（异步写入在崩溃路径上可能根本没执行）。
 *
 * 写失败不能把站点带崩：任何 I/O 错误都退回控制台。
 */

/** 日志文件保留天数；轮转时清掉更早的 */
const RETENTION_DAYS = 14

type LogType = 'access' | 'request-error' | 'fatal'

let currentDay: string | null = null
let currentPath: string | null = null

function logDir(): string {
  // 默认与数据库同卷（容器里是挂载的 /data），重启容器日志不丢；
  // 测试用 LOG_DIR 指到临时目录
  return process.env.LOG_DIR ?? join(dirname(dbPath()), 'logs')
}

function rotate(day: string): void {
  currentDay = day
  currentPath = join(logDir(), `app-${day}.log`)
  mkdirSync(logDir(), { recursive: true })

  // 过期文件按「文件名里的日期」判断，而不是 mtime：文件被什么工具碰过
  // 都不影响保留窗口的语义。日期键是 YYYY-MM-DD 文本，字典序就是日期序。
  const cutoffDay = addDays(day, -RETENTION_DAYS)

  for (const name of readdirSync(logDir())) {
    if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue
    if (name.slice(4, 14) < cutoffDay) rmSync(join(logDir(), name), { force: true })
  }
}

function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack }
  return { message: String(error) }
}

function write(level: 'info' | 'error', type: LogType, fields: Record<string, unknown>): void {
  try {
    const day = todayKey()
    if (day !== currentDay) rotate(day)
    appendFileSync(currentPath!, `${JSON.stringify({ time: new Date().toISOString(), level, type, ...fields })}\n`)
  } catch (error) {
    console.error('[log] 写日志文件失败，退回控制台', error)
  }
  if (level === 'error') console.error(`[${type}]`, fields)
  else console.log(`[${type}]`, fields)
}

/** 访问日志：每个请求一行（middleware 里调用） */
export function accessLog(fields: { method: string; path: string }): void {
  write('info', 'access', fields)
}

/** 请求内出错（渲染 / route handler / server action）：路径 + 错误摘要 + 时间 */
export function requestErrorLog(
  error: unknown,
  context: { path?: string; method?: string; routeType?: string; routePath?: string },
): void {
  write('error', 'request-error', { ...context, ...describeError(error) })
}

/** 进程级未捕获异常：摘要 + 堆栈，落盘后进程退出（见 instrumentation.ts） */
export function fatalLog(error: unknown): void {
  write('error', 'fatal', describeError(error))
}
