import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PANTRY } from '@/lib/data/pantry'
import MealForm from './MealForm'
import type { TodayEntry } from './types'

vi.mock('next/navigation', () => ({
  usePathname: () => '/meals/new',
  useRouter: () => ({ refresh: () => {} }),
}))

const FOODS = PANTRY.map((food) => ({
  id: food.name,
  name: food.name,
  perGrams: 100,
  calories: food.calories,
  protein: food.protein,
  carbs: food.carbs,
  fat: food.fat,
}))

const ENTRIES: TodayEntry[] = [
  { id: 'e1', slot: 'breakfast', name: '鸡蛋', grams: 100, calories: 144, source: 'curated' },
]

function renderForm(entries: TodayEntry[] = []) {
  return render(<MealForm foods={FOODS} entries={entries} />)
}

describe('添加饮食页', () => {
  it('提供搜索与一句话描述两个入口', () => {
    renderForm()
    expect(screen.getByPlaceholderText('搜索食物')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/描述你吃了什么/)).toBeInTheDocument()
  })

  it('列出四个餐次供选择', () => {
    renderForm()
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByRole('button', { name: slot })).toBeInTheDocument()
    }
  })

  it('搜到食物后点一下，它就进入待确认列表', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText('搜索食物'), '鸡胸')
    await user.click(screen.getByRole('button', { name: /鸡胸肉/ }))

    expect(screen.getByText('确认这些条目')).toBeInTheDocument()
    // 默认按 100 克算，用户还能改（输入框是文本 + inputMode=numeric：手机上出数字键盘，
    // 但不受 number 输入框那些奇怪的取值行为影响）
    expect(screen.getByLabelText('鸡胸肉的克数')).toHaveValue('100')
    expect(screen.getByRole('button', { name: '保存到午餐' })).toBeInTheDocument()
  })

  it('一句话解析：拆出条目、说出没认出来的词、并把餐次也切过去', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText(/描述你吃了什么/), '中午吃了两个鸡蛋一碗米饭')
    await user.click(screen.getByRole('button', { name: '解析' }))

    expect(screen.getByLabelText('鸡蛋的克数')).toHaveValue('100')
    expect(screen.getByLabelText('米饭的克数')).toHaveValue('200')
    // 「中午」→ 餐次切到午餐：餐次按钮亮起来，保存按钮的说法也跟着变
    expect(screen.getByRole('button', { name: '午餐' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '保存到午餐' })).toBeInTheDocument()
    expect(screen.queryByText(/没认出来/)).not.toBeInTheDocument()
  })

  it('认不出的词原样列出来，而不是悄悄丢掉', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText(/描述你吃了什么/), '一个鸡蛋和一碗佛跳墙')
    await user.click(screen.getByRole('button', { name: '解析' }))

    expect(screen.getByText(/没认出来：一碗佛跳墙/)).toBeInTheDocument()
  })

  it('解析结果里没有一条被打上「AI 估算」（没有模型参与）', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText(/描述你吃了什么/), '两个鸡蛋一杯牛奶')
    await user.click(screen.getByRole('button', { name: '解析' }))

    expect(screen.queryByText('AI 估算')).not.toBeInTheDocument()
  })

  it('改克数时热量跟着变，合计也跟着变', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText('搜索食物'), '鸡蛋')
    await user.click(screen.getByRole('button', { name: /鸡蛋/ }))

    // 100 克鸡蛋 144 千卡
    expect(screen.getByText('144 千卡')).toBeInTheDocument()

    const grams = screen.getByLabelText('鸡蛋的克数')
    await user.clear(grams)
    await user.type(grams, '200')

    expect(screen.getByText('288 千卡')).toBeInTheDocument()
    expect(screen.getByText(/合计/)).toHaveTextContent('288')
  })

  it('待确认列表可以整条移除', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByPlaceholderText('搜索食物'), '鸡蛋')
    await user.click(screen.getByRole('button', { name: /鸡蛋/ }))
    await user.click(screen.getByRole('button', { name: '移除鸡蛋' }))

    expect(screen.queryByText('确认这些条目')).not.toBeInTheDocument()
  })

  it('提交时带的是食物 id 与克数，不是客户端算好的热量', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()

    await user.type(screen.getByPlaceholderText('搜索食物'), '鸡蛋')
    await user.click(screen.getByRole('button', { name: /鸡蛋/ }))

    const hidden = container.querySelector('input[name="items"]') as HTMLInputElement
    const items = JSON.parse(hidden.value) as { foodId: string; grams: number }[]
    expect(items).toEqual([{ foodId: '鸡蛋', grams: 100 }])
    // 表单里没有 calories 之类的字段：数字由服务端重算
    expect(hidden.value).not.toContain('calories')
  })

  it('今天已记录的条目带删除按钮（删除是独立的一次提交）', () => {
    renderForm(ENTRIES)
    expect(screen.getByText('今天已记录')).toBeInTheDocument()
    expect(screen.getByText('早餐 · 鸡蛋')).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: '删除鸡蛋' })
    expect(remove).toHaveAttribute('type', 'submit')
    expect(remove.closest('form')).not.toBeNull()
  })

  it('今天还没有记录时说清楚，而不是留一片空白', () => {
    renderForm([])
    expect(screen.getByText(/今天还没有记录/)).toBeInTheDocument()
  })
})
