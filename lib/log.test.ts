import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 日志模块测试。
 *
 * lib/log.ts 里留着「今天」与日志目录的模块级状态，测试之间要完全隔离：
 * 用 vi.resetModules 让每个用例拿到一份全新的模块实例，再动态 import。
 * 「今天」用 vi.hoisted 的变量控制，验证每日轮转与过期清理。
 */
const state = vi.hoisted(() => ({ day: '2026-10-15' }))

vi.mock('@/lib/data/dates', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/data/dates')>()
  return { ...original, todayKey: () => state.day }
})

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-log-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.resetModules()
})

async function loadLog() {
  return import('@/lib/log')
}

function logDir(): string {
  return join(tempDir, 'logs')
}

function linesOf(day: string): unknown[] {
  return readFileSync(join(logDir(), `app-${day}.log`), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

describe('文件日志', () => {
  it('访问日志与错误日志都落进按天命名的文件，字段可解析', async () => {
    process.env.LOG_DIR = logDir()
    try {
      const { accessLog, requestErrorLog } = await loadLog()

      accessLog({ method: 'GET', path: '/trends' })
      requestErrorLog(new Error('数据库连不上'), {
        path: '/trends',
        method: 'GET',
        routeType: 'render',
        routePath: '/trends',
      })

      const lines = linesOf('2026-10-15')
      expect(lines).toHaveLength(2)

      const access = lines[0] as Record<string, unknown>
      expect(access.type).toBe('access')
      expect(access.level).toBe('info')
      expect(access.method).toBe('GET')
      expect(access.path).toBe('/trends')
      // 时间必须能定位到分钟：ISO 格式，与日志内容同时落盘
      expect(String(access.time)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(new Date(access.time as string).getTime()).toBeGreaterThan(0)

      const errorLine = lines[1] as Record<string, unknown>
      expect(errorLine.type).toBe('request-error')
      expect(errorLine.level).toBe('error')
      expect(errorLine.message).toBe('数据库连不上')
      expect(errorLine.stack).toContain('log.test.ts')
      expect(errorLine.routeType).toBe('render')
    } finally {
      delete process.env.LOG_DIR
    }
  })

  it('跨天轮转：第二天写进新文件，过期文件被清掉、窗口内的保留', async () => {
    process.env.LOG_DIR = logDir()
    try {
      const { accessLog } = await loadLog()

      state.day = '2026-10-15'
      accessLog({ method: 'GET', path: '/a' })

      // 模拟历史文件：一个 20 天前（应被清掉），一个 5 天前（应保留）
      writeFileSync(join(logDir(), 'app-2026-09-25.log'), 'old\n')
      writeFileSync(join(logDir(), 'app-2026-10-10.log'), 'recent\n')

      state.day = '2026-10-16'
      accessLog({ method: 'GET', path: '/b' })

      expect(readdirSync(logDir()).sort()).toEqual([
        'app-2026-10-10.log',
        'app-2026-10-15.log',
        'app-2026-10-16.log',
      ])
      expect(linesOf('2026-10-16')).toHaveLength(1)
    } finally {
      delete process.env.LOG_DIR
    }
  })

  it('日志目录写不进去时退回控制台，而不是把请求带崩', async () => {
    // 指向一个「路径被文件占住」的位置：mkdir 会失败，write 必须吞掉
    const blocked = join(tempDir, 'blocked')
    writeFileSync(blocked, 'i am a file')
    process.env.LOG_DIR = join(blocked, 'logs')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { accessLog } = await loadLog()
      expect(() => accessLog({ method: 'GET', path: '/x' })).not.toThrow()
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      delete process.env.LOG_DIR
      errorSpy.mockRestore()
    }
  })
})
