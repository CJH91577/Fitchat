import { randomBytes } from 'node:crypto'
import type { Db } from '../lib/db'
import { dbPath } from '../lib/db/index'
import { inviteCodesForAdmin } from '../lib/db/queries'
import { openLocalDb } from '../lib/db/runtime'
import { createInviteCodes, revokeInviteCode } from '../lib/db/writes'

/**
 * 邀请码管理（管理员在服务器上跑）：
 *
 *   npm run invite -- issue --count 3 --note 给张三
 *   npm run invite -- list
 *   npm run invite -- revoke --code XXXXXXXX
 *
 * 以前发码只能往容器里手写 SQL（DEPLOY.md 第四节那串），现在收敛成
 * 三个子命令。库位置用 DATABASE_PATH 指定（容器里是 /data/fitchat.db）。
 *
 * 码用「去掉了易混字符」的字母表随机生成（没有 0/O、1/I），手抄不容易错。
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export type InviteCommand =
  | { type: 'issue'; count: number; note: string | null }
  | { type: 'list' }
  | { type: 'revoke'; code: string }

const USAGE = [
  '用法：',
  '  npm run invite -- issue --count 3 --note 给张三   发 3 张码',
  '  npm run invite -- list                         列出全部码（含谁用了）',
  '  npm run invite -- revoke --code XXXXXXXX       作废一张没用掉的码',
].join('\n')

export function parseArgs(argv: string[]): InviteCommand | { error: string } {
  const sub = argv[0]
  const flag = (name: string): string | undefined => {
    const eq = argv.find((arg) => arg.startsWith(`--${name}=`))
    if (eq !== undefined) return eq.slice(name.length + 3)
    const at = argv.indexOf(`--${name}`)
    if (at !== -1 && argv[at + 1] !== undefined && !argv[at + 1].startsWith('--')) {
      return argv[at + 1]
    }
    return undefined
  }

  if (sub === 'issue') {
    const raw = flag('count')
    const count = raw === undefined ? 1 : Number(raw)
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return { error: '--count 要填 1–50 的整数。\n' + USAGE }
    }
    return { type: 'issue', count, note: flag('note') ?? null }
  }

  if (sub === 'list') return { type: 'list' }

  if (sub === 'revoke') {
    const code = flag('code')
    if (code === undefined || code.trim() === '') {
      return { error: '--code 不能为空。\n' + USAGE }
    }
    return { type: 'revoke', code: code.trim().toUpperCase() }
  }

  return { error: USAGE }
}

/** 一张随机码：8 位、去掉易混字符、按 4 位分组便于抄写 */
export function newInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/**
 * 执行一个子命令，输出到 stdout，返回退出码。
 * 单独导出来是为了能直接用函数测，不用在这台机器上起子进程（它禁止 spawn）。
 */
export async function runInvite(db: Db, command: InviteCommand): Promise<number> {
  if (command.type === 'issue') {
    const codes = Array.from({ length: command.count }, () => newInviteCode())
    await createInviteCodes(
      db,
      codes.map((code) => ({ code, note: command.note })),
      new Date(),
    )
    console.log(`已生成 ${codes.length} 张邀请码（每张只能用一次）：`)
    for (const code of codes) console.log(`  ${code}`)
    if (command.note !== null) console.log(`  备注：${command.note}`)
    return 0
  }

  if (command.type === 'list') {
    const rows = await inviteCodesForAdmin(db)
    if (rows.length === 0) {
      console.log('库里没有邀请码。')
      return 0
    }
    console.log('邀请码（新的在上）：')
    for (const row of rows) {
      const used = row.usedAt === null ? '未使用' : `已用（${row.usedByEmail ?? '用户已删除'}）`
      const note = row.note !== null ? ` · 备注：${row.note}` : ''
      console.log(`  ${row.code}  ${used}${note}`)
    }
    return 0
  }

  const revoked = await revokeInviteCode(db, command.code)
  if (!revoked) {
    console.error(`作废失败：${command.code} 不存在，或者已经用掉（已用的码是历史记录，不能作废）。`)
    return 1
  }
  console.log(`已作废：${command.code}`)
  return 0
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if ('error' in parsed) {
    console.error(parsed.error)
    process.exit(1)
  }

  const { db, close } = openLocalDb(dbPath())
  try {
    process.exit(await runInvite(db, parsed))
  } finally {
    close()
  }
}

// 直接跑脚本（tsx scripts/invite.ts …）才进 main；被测试 import 时不执行
if (process.argv[1]?.endsWith('invite.ts')) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
