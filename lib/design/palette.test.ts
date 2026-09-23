import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PALETTE } from './palette'

const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')

describe('设计令牌', () => {
  it.each(['light', 'dark'] as const)('%s 模式的每个色值都出现在 globals.css 中', (mode) => {
    for (const [token, hex] of Object.entries(PALETTE[mode])) {
      expect(css, `${mode} 缺少 ${token} = ${hex}`).toContain(hex)
    }
  })
})
