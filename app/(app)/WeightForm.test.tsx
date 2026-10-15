import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import WeightForm from './WeightForm'

/**
 * 体重录入表单。
 *
 * 关键行为：日期是表单的一部分（默认来自页面，可以改），提交时把
 * 所选日期与体重一起交给服务端。这里把 action 换掉来捕获提交内容——
 * 「选了日期后提交的日期正确」是 P1-5 的验收项。
 */
const saveSpy = vi.hoisted(() =>
  vi.fn(async (prev: { error: string | null; savedAt: number }, formData: FormData) => {
    // action 收到的必须是同一个 FormData（React 的 Server Action 协议）
    expect(formData).toBeInstanceOf(FormData)
    return { error: null, savedAt: prev.savedAt + 1 }
  }),
)
vi.mock('./weight-action', () => ({ saveWeightAction: saveSpy }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

function submittedForm(): FormData {
  expect(saveSpy).toHaveBeenCalled()
  const call = saveSpy.mock.calls[saveSpy.mock.calls.length - 1]
  return call[1] as FormData
}

describe('体重录入表单', () => {
  it('日期默认来自页面（首页=今天，某日详情=那天）', () => {
    render(<WeightForm currentKg={null} date="2026-10-15" />)
    expect(screen.getByLabelText('日期')).toHaveValue('2026-10-15')
  })

  it('日期选择带范围限制：最早开始使用那天，最晚今天', () => {
    render(
      <WeightForm currentKg={null} date="2026-10-15" minDate="2025-09-22" maxDate="2026-10-15" />,
    )
    const input = screen.getByLabelText('日期') as HTMLInputElement
    expect(input.min).toBe('2025-09-22')
    expect(input.max).toBe('2026-10-15')
  })

  it('选了别的日期后提交，提交内容带的是那个日期', async () => {
    const user = userEvent.setup()
    render(<WeightForm currentKg={null} date="2026-10-15" />)

    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-10-10' } })
    await user.type(screen.getByLabelText('体重（公斤）'), '70.5')
    await user.click(screen.getByRole('button', { name: '记录' }))

    const form = submittedForm()
    expect(form.get('date')).toBe('2026-10-10')
    expect(form.get('kg')).toBe('70.5')
  })

  it('这一天已经记过就预填，按钮写「改一下」', () => {
    render(<WeightForm currentKg={71.3} date="2026-10-15" />)
    expect(screen.getByLabelText('体重（公斤）')).toHaveValue('71.3')
    expect(screen.getByRole('button', { name: '改一下' })).toBeInTheDocument()
  })
})
