import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Plan from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

describe('训练计划页', () => {
  it('渲染七个星期', () => {
    render(<Plan />)
    for (const w of ['周一', '周二', '周三', '周四', '周五', '周六', '周日']) {
      expect(screen.getByText(w)).toBeInTheDocument()
    }
  })

  it('周二是训练主题「胸 + 三头」而非休息', () => {
    render(<Plan />)
    expect(screen.getByText('胸 + 三头')).toBeInTheDocument()
    expect(screen.getByText('卧推')).toBeInTheDocument()
  })

  it('不提供指向错误目标的编辑入口', () => {
    render(<Plan />)
    expect(screen.queryByRole('link', { name: '编辑' })).not.toBeInTheDocument()
  })
})
