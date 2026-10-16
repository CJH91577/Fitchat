import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Calendar from './page'
import { today } from '@/lib/data/today'
import { setupSeededDatabase } from '@/tests/seeded-db'

/**
 * 首屏体积契约：日历页只下发**当月**的达成情况。
 *
 * 以前整段区间（开始使用日 → 今天，约 390 天 × 两个布尔值）随页面
 * 一起送过去，39 KB 的 HTML 是当时全站最大的页面。其它月份现在由
 * 客户端翻月时按需取（components/CalendarView.test.tsx 测翻月取数），
 * 这里钉住「首屏只有当月」——谁把整段区间又塞回 props，这条立刻转红。
 */
vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }))
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

const captured = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }))
vi.mock('@/components/CalendarView', () => ({
  default: (props: Record<string, unknown>) => {
    captured.props = props
    return null
  },
}))

setupSeededDatabase()

describe('日历页首屏体积', () => {
  it('只带当月的数据：不超过 31 天，且全部落在当月', async () => {
    render(await Calendar())

    const props = captured.props
    expect(props).not.toBeNull()
    const initial = props!.initialDayResults as Record<string, unknown>

    const keys = Object.keys(initial)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.length).toBeLessThanOrEqual(31)

    const month = today().slice(0, 7)
    expect(keys.every((date) => date.startsWith(month))).toBe(true)
  })
})
