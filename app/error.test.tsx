import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ErrorPage from './error'

describe('错误页（渲染失败时的兜底）', () => {
  it('给出可读的提示与重试按钮，而不是白屏', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />)

    expect(screen.getByRole('heading', { name: '出错了' })).toBeInTheDocument()
    expect(screen.getByText(/可以重试一下/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('不把错误细节渲染到页面上（诊断信息属于日志，不属于用户）', () => {
    render(<ErrorPage error={new Error('secret-detail')} reset={() => {}} />)
    expect(screen.queryByText(/secret-detail/)).not.toBeInTheDocument()
  })

  it('重试按钮调用 reset', async () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)

    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
