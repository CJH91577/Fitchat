import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayKey } from './lib/data/dates'
import { onRequestError } from './instrumentation'

/**
 * 请求内出错 → 日志里必须有可定位的一行（路径、错误摘要、时间）。
 * 这是 P0-3 的验收核心：出事了能在 1 分钟内知道是哪次请求。
 */
const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-instrumentation-'))
const logDir = join(tempDir, 'logs')

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.resetModules()
  rmSync(logDir, { recursive: true, force: true })
  process.env.NEXT_RUNTIME = 'nodejs'
  process.env.LOG_DIR = logDir
})

function lastLogLine(): Record<string, unknown> {
  const file = join(logDir, `app-${todayKey()}.log`)
  const lines = readFileSync(file, 'utf8').trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>
}

describe('onRequestError（Next 的请求错误钩子）', () => {
  it('请求内抛出的异常被记成一行：路径、方法、摘要、时间', async () => {
    await onRequestError(new Error('render exploded'), { path: '/trends', method: 'GET', headers: {} }, {
      routerKind: 'App Router',
      routePath: '/trends',
      routeType: 'render',
      revalidateReason: undefined,
    })

    const line = lastLogLine()
    expect(line.type).toBe('request-error')
    expect(line.path).toBe('/trends')
    expect(line.method).toBe('GET')
    expect(line.routeType).toBe('render')
    expect(line.message).toBe('render exploded')
    expect(String(line.time)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  })

  it('非 nodejs 运行时直接跳过，不碰文件', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    await onRequestError(new Error('x'), { path: '/', method: 'GET', headers: {} }, {
      routerKind: 'App Router',
      routePath: '/',
      routeType: 'route',
      revalidateReason: undefined,
    })

    // 连日志目录都没建出来——钩子在碰文件之前就返回了
    expect(existsSync(logDir)).toBe(false)
  })

  it('钩子自己抛错时，错误也被吞掉（错误路径上不能再炸一次）', async () => {
    // LOG_DIR 的父路径被一个文件占住：mkdir 必然失败，日志必须退回控制台
    const blocked = join(tempDir, 'blocked')
    writeFileSync(blocked, 'i am a file, not a directory')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.LOG_DIR = join(blocked, 'logs')
    try {
      await expect(
        onRequestError(new Error('x'), { path: '/', method: 'GET', headers: {} }, {
          routerKind: 'App Router',
          routePath: '/',
          routeType: 'action',
          revalidateReason: undefined,
        }),
      ).resolves.toBeUndefined()
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })
})
