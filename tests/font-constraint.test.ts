import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const layout = readFileSync(resolve(process.cwd(), 'app/layout.tsx'), 'utf8')
const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

describe('字体约束（一律系统无衬线）', () => {
  it('app/layout.tsx 与 app/globals.css 均不得引入 next/font', () => {
    expect(layout).not.toContain('next/font')
    expect(globals).not.toContain('next/font')
  })

  it('不得出现被禁的衬线/装饰字体（Geist、Geist_Mono）', () => {
    for (const font of ['Geist', 'Geist_Mono']) {
      expect(layout).not.toContain(font)
      expect(globals).not.toContain(font)
    }
  })

  it('globals.css 使用规定的系统字体栈', () => {
    expect(globals).toContain('system-ui, -apple-system, "Segoe UI", sans-serif')
  })
})
