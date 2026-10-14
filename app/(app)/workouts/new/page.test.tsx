import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import NewWorkout from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/workouts/new' }))

describe('添加运动页', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('提供有氧与力量两条路径', () => {
    render(<NewWorkout />)
    expect(screen.getByRole('button', { name: '有氧' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '力量' })).toBeInTheDocument()
  })

  it('力量模式下显示「添加一组」按钮', () => {
    render(<NewWorkout />)
    expect(screen.getByRole('button', { name: '添加一组' })).toBeInTheDocument()
  })

  it('计划目标只作预填，重量与次数可改，且可增删组', async () => {
    const user = userEvent.setup()
    render(<NewWorkout />)

    // 默认力量模式，预填一组 60kg × 10
    const weight = screen.getByPlaceholderText('重量 kg')
    const reps = screen.getByPlaceholderText('次数')
    expect(weight).toHaveValue('60')
    expect(reps).toHaveValue('10')

    // 预填值不被锁定：记录反映实际发生的
    await user.clear(weight)
    await user.type(weight, '80')
    expect(weight).toHaveValue('80')

    await user.clear(reps)
    await user.type(reps, '12')
    expect(reps).toHaveValue('12')

    // 增组：1 → 2
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(2)

    // 删组：2 → 1
    await user.click(screen.getByRole('button', { name: '删除第 2 组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
  })

  it('同一毫秒内连加两组不会共享 id，删除其一不会误删另一组', async () => {
    const user = userEvent.setup()
    vi.spyOn(Date, 'now').mockReturnValue(1234567890123)
    render(<NewWorkout />)

    // 增组：1 → 3
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(3)

    // 删除中间一组：其余两组都应保留，而非连同共享 id 的那组一起消失
    await user.click(screen.getByRole('button', { name: '删除第 2 组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(2)
  })
})
