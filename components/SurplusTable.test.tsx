import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import SurplusTable from './SurplusTable'

describe('SurplusTable', () => {
  it('正数带 + 号', () => {
    render(<SurplusTable rows={[{ date: '2026-09-21', surplus: 300 }]} />)
    expect(screen.getByText('+300')).toBeInTheDocument()
  })

  it('负数带 − 号', () => {
    render(<SurplusTable rows={[{ date: '2026-09-20', surplus: -200 }]} />)
    expect(screen.getByText('−200')).toBeInTheDocument()
  })

  it('零不带符号，不显示成 +0 或 −0', () => {
    render(<SurplusTable rows={[{ date: '2026-09-22', surplus: 0 }]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('+0')).not.toBeInTheDocument()
    expect(screen.queryByText('−0')).not.toBeInTheDocument()
  })

  it('盈余的样式不含成功或危险状态色', () => {
    // 颜色定义在 CSS 模块里、不在 DOM 上，因此必须查样式表本身——
    // 查 innerHTML 永远查不到，那是一条恒真的假测试。
    const css = readFileSync(join(process.cwd(), 'components', 'SurplusTable.module.css'), 'utf8')
    expect(css).not.toContain('#0ca30c')
    expect(css).not.toContain('#fab219')
    expect(css).not.toContain('#ec835a')
    expect(css).not.toContain('#d03b3b')
  })

  it('空数据时显示空态文案', () => {
    render(<SurplusTable rows={[]} />)
    expect(screen.getByText(/还没有饮食记录/)).toBeInTheDocument()
  })

  it('表格容器可滚动（固定高度）', () => {
    render(<SurplusTable rows={[{ date: '2026-09-22', surplus: 0 }]} />)
    expect(screen.getByTestId('surplus-table-scroll')).toBeInTheDocument()
  })
})
