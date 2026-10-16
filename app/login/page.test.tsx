import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import LoginForm from './LoginForm'

vi.mock('next/navigation', () => ({ usePathname: () => '/login' }))

describe('登录页', () => {
  it('默认是登录形态：邮箱与口令', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('口令')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('邀请码')).not.toBeInTheDocument()
  })

  it('切到注册形态才出现邀请码输入框（邀请码是注册的唯一门槛）', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(screen.getByPlaceholderText('邀请码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('设置口令（至少 8 位）')).toBeInTheDocument()
    // 切形态后不再显示登录用的那个口令框，避免两个 name="password" 打架
    expect(screen.getAllByPlaceholderText(/口令/)).toHaveLength(1)
  })

  it('两个形态按钮用 aria-pressed 表达当前选中', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    expect(screen.getByRole('button', { name: '登录' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '注册' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(screen.getByRole('button', { name: '登录' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '注册' })).toHaveAttribute('aria-pressed', 'true')
    // 提交按钮与切换按钮名字不同：否则「点哪个才真的提交」得靠猜
    expect(screen.getByRole('button', { name: '用邀请码注册' })).toHaveAttribute('type', 'submit')
  })

  it('演示入口是一个独立按钮，且明确说明了里面是假数据', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: '先看看演示账号' })).toBeInTheDocument()
    expect(screen.getByText(/按日期生成的假数据/)).toBeInTheDocument()
  })

  it('登录形态有「忘记口令」入口，切到重置形态', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: '忘记口令？' }))

    expect(screen.getByPlaceholderText('重置码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('新口令（至少 8 位）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置新口令' })).toHaveAttribute('type', 'submit')
    // 重置码由管理员生成：没有邮件服务，界面上要如实说明
    expect(screen.getByText(/重置码由管理员生成/)).toBeInTheDocument()
  })

  it('重置形态能返回登录', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: '忘记口令？' }))
    await user.click(screen.getByRole('button', { name: '返回登录' }))

    expect(screen.getByPlaceholderText('口令')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('重置码')).not.toBeInTheDocument()
  })
})
