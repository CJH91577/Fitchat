import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NewMeal from './page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/meals/new',
}))

describe('添加饮食页', () => {
  it('提供搜索与一句话描述两个入口', () => {
    render(<NewMeal />)
    expect(screen.getByPlaceholderText('搜索食物')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/描述你吃了什么/)).toBeInTheDocument()
  })

  it('列出四个餐次供选择', () => {
    render(<NewMeal />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByRole('button', { name: slot })).toBeInTheDocument()
    }
  })

  it('解析后呈现待确认的条目，仅 AI 估算条目带标记', async () => {
    const user = userEvent.setup()
    render(<NewMeal />)
    // 解析前没有任何已入库的列表
    expect(screen.queryByText('确认这些条目')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/描述你吃了什么/), '中午吃了两个鸡蛋一碗米饭')
    await user.click(screen.getByRole('button', { name: '解析' }))

    // 呈现为「确认」步骤，而不是直接保存
    expect(screen.getByText('确认这些条目')).toBeInTheDocument()
    expect(screen.getByText(/请核对后保存/)).toBeInTheDocument()
    // 三条解析结果里只有「红烧肉」是 AI 估算，因此标记恰好出现一次
    expect(screen.getAllByText('AI 估算')).toHaveLength(1)
  })
})
