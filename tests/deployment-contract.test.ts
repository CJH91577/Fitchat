import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * 部署形态契约。
 *
 * 这个文件以前叫 static-export.test.ts，钉的是「静态导出到 Cloudflare Pages」：
 * output: 'export'、generateStaticParams、构建期注入的 NEXT_PUBLIC_TODAY。
 * 站点改成服务端渲染（standalone + Docker）之后，那几条断言**全都变成了
 * 靠注释通过的假绿**——next.config.ts 里留着「之前这里是 output: 'export'」
 * 这类说明性注释，正则照样匹配，测试于是一直绿着，保护的是一个已经不存在的
 * 部署方式，而真正生效的 output: 'standalone' 没人管。
 *
 * 这与 css-modules-contract.test.ts 防的是同一类问题：**静默失效**。
 * 所以现在立两条规矩，并且**先把注释去掉再匹配**——说明性注释不能再把断言喂饱：
 *
 *   1. next.config.ts 里真正生效的 output 必须是 standalone；
 *   2. 任何读了数据库的页面都必须 force-dynamic。漏掉它的后果是数据被冻在
 *      构建那一刻：页面照常 200、测试照常绿，只是内容永远是旧的。
 */

/**
 * 去掉注释，但跳过字符串字面量。
 *
 * 「跳过字符串」这半句是必须的：否则 'http://…' 里的 `//` 会被当成行注释，
 * 把该行后面真正的代码一起吃掉——那是**过度删除**，会让断言变得比原来更宽松，
 * 正好又回到这个文件当初的毛病上。
 */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]

    if (quote !== null) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      out += ch
      i += 1
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i += 2
      continue
    }

    out += ch
    i += 1
  }

  return out
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const root = process.cwd()
const config = stripComments(readFileSync(join(root, 'next.config.ts'), 'utf8'))

const pages = walk(join(root, 'app')).filter(
  (file) => file.endsWith('page.tsx') && !file.endsWith('.test.tsx'),
)

/** 读了数据库的页面：内容来自库里，就必须每次请求现算 */
const dataPages = pages.filter((file) => /from '@\/lib\/db\//.test(readFileSync(file, 'utf8')))

describe('部署形态契约', () => {
  it('next.config.ts 真正生效的 output 是 standalone', () => {
    expect(config).toMatch(/output:\s*'standalone'/)
    // 静态导出已经不再是这套部署方式，配置里不该再留着它（注释不算）
    expect(config).not.toMatch(/output:\s*'export'/)
  })

  // 「今天」在服务端按请求算（lib/data/today.ts）。一旦回到构建期注入，
  // 长跑进程里的日期就永远是构建那天——而页面看起来完全正常。
  it('配置里不再注入构建期的「今天」', () => {
    expect(config).not.toContain('NEXT_PUBLIC_TODAY')
  })

  it('确实找到了读了数据库的页面（别让这条测试静默失效）', () => {
    // 断言集为空时，下面的循环会「全部通过」——先钉住它非空
    expect(dataPages.length).toBeGreaterThanOrEqual(6)
    const names = dataPages.map((file) => relative(root, file).replace(/\\/g, '/'))
    expect(names).toContain('app/page.tsx')
    expect(names).toContain('app/trends/page.tsx')
    expect(names).toContain('app/day/[date]/page.tsx')
  })

  it('每个读库的页面都声明了 force-dynamic', () => {
    const missing = dataPages.filter(
      (file) => !/export const dynamic = 'force-dynamic'/.test(readFileSync(file, 'utf8')),
    )
    expect(missing.map((file) => relative(root, file).replace(/\\/g, '/'))).toEqual([])
  })

  it('「今天」是请求期算出来的，不是写死的常量', () => {
    const today = stripComments(readFileSync(join(root, 'lib', 'data', 'today.ts'), 'utf8'))
    expect(today).toContain('todayKey()')
    expect(today).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  // 部署方式与说明写在同一处，改动其中一边时另一边不该被忘掉。
  it('DEPLOY.md 描述的部署方式与配置一致', () => {
    const deploy = readFileSync(join(root, 'DEPLOY.md'), 'utf8')
    expect(deploy).toContain('standalone')
    expect(deploy).toContain('docker compose')
  })
})
