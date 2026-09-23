import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Me from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/me' }))

describe('我的页', () => {
  it('渲染当前目标', () => {
    render(<Me />)
    expect(screen.getByText('每日目标')).toBeInTheDocument()
  })

  it('目标方向显示为词语而非原始枚举', () => {
    render(<Me />)
    expect(screen.getByText('目标方向')).toBeInTheDocument()
    expect(screen.getByText('减脂')).toBeInTheDocument()
    expect(screen.queryByText('cut')).not.toBeInTheDocument()
  })
})
