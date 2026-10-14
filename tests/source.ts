import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 契约测试共用的小工具。
 *
 * 这些测试的共同点：断言的是**源码的结构**（谁引了谁、谁声明了什么），
 * 而不是运行时的行为。这种测试最容易变成假绿，所以两件事必须做对：
 * 注释不能算数，而且要确认自己真的找到了文件（find-nothing 也会全绿）。
 */

/**
 * 去掉注释，但跳过字符串字面量。
 *
 * 「跳过字符串」这半句是必须的：否则 'http://…' 里的 `//` 会被当成行注释，
 * 把该行后面真正的代码一起吃掉——那是**过度删除**，会让断言变得比原来更宽松，
 * 正好又回到「注释把测试喂饱」的毛病上。
 */
export function stripComments(source: string): string {
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

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** 读源码并去掉注释——契约测试一律用这个，避免说明性注释把断言喂饱 */
export function readCode(path: string): string {
  return stripComments(readFileSync(path, 'utf8'))
}

/** 仓库相对路径，且统一用正斜杠（Windows 上是反斜杠） */
export function repoPath(root: string, full: string): string {
  return join(full).replace(join(root), '').replace(/^[\\/]/, '').replace(/\\/g, '/')
}
