import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Login from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/login' }))

describe('登录页', () => {
  it('要求填写邀请码', () => {
    render(<Login />)
    expect(screen.getByPlaceholderText('邀请码')).toBeInTheDocument()
  })
})
