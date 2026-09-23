import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NewWorkout from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/workouts/new' }))

describe('添加运动页', () => {
  it('提供有氧与力量两条路径', () => {
    render(<NewWorkout />)
    expect(screen.getByRole('button', { name: '有氧' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '力量' })).toBeInTheDocument()
  })

  it('力量模式下可增删组', () => {
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

    // 增组：1 → 2
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(2)

    // 删组：2 → 1
    await user.click(screen.getByRole('button', { name: '删除第 2 组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
  })
})
