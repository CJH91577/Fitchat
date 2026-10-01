import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const ROOTS = ['app', 'components']

describe('CSS Modules 类名契约', () => {
  // 引用一个不存在的 CSS 类时，CSS Modules 返回 undefined，React 会直接省略
  // 该 class 属性——**构建、lint、渲染测试全都不会报错**，但布局会静默失效。
  // 这条测试把「源码用到的类」与「样式表里定义的类」之间的契约钉住。
  //
  // 实测过：日历页曾引用 styles.calendarArea 而样式表里没有它，导致网格
  // 完全没有撑满，而所有自动化检查都是绿的。
  it('每个 .tsx 用到的 styles.X 都在同目录的 .module.css 里有定义', () => {
    const sources = ROOTS.flatMap((root) =>
      walk(join(process.cwd(), root)).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')),
    )
    expect(sources.length).toBeGreaterThan(0)

    const problems: string[] = []
    for (const file of sources) {
      const src = readFileSync(file, 'utf8')
      const importMatch = /from '\.\/([A-Za-z0-9_.-]+\.module\.css)'/.exec(src)
      if (!importMatch) continue // 这个文件不依赖 CSS 模块

      const cssName = importMatch[1]
      const css = readFileSync(join(dirname(file), cssName), 'utf8')
      const used = new Set([...src.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))

      for (const name of used) {
        if (!css.includes(`.${name}`)) {
          problems.push(`${file} 用到 styles.${name}，但 ${cssName} 里没有定义它`)
        }
      }
    }

    expect(problems).toEqual([])
  })
})
