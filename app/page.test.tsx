import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Home from './page'

describe('首页', () => {
  it('渲染应用名', () => {
    render(<Home />)
    expect(screen.getByText('Fitchat')).toBeInTheDocument()
  })
})
