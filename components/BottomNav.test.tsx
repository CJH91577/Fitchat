import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BottomNav from './BottomNav'

const { mockPathname } = vi.hoisted(() => ({ mockPathname: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname() }))

describe('BottomNav', () => {
  it('五项齐全且日历居中', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const labels = screen.getAllByRole('link').map((el) => el.textContent)
    expect(labels).toEqual(['今日', '趋势', '日历', '记录', '我的'])
  })

  it('精确匹配的当前页高亮', () => {
    mockPathname.mockReturnValue('/trends')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: '趋势' })).toHaveAttribute('aria-current', 'page')
  })

  it('某日详情归为「日历」的下级，高亮日历项', () => {
    mockPathname.mockReturnValue('/day/2026-09-22')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('aria-current', 'page')
  })

  it('某日详情不应高亮「今日」', () => {
    mockPathname.mockReturnValue('/day/2026-09-22')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: '今日' })).not.toHaveAttribute('aria-current')
  })

  it('首页路径不会让所有项都高亮', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const current = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('今日')
  })
})
