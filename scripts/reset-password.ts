import { createResetCode } from '../lib/auth/reset'
import { dbPath } from '../lib/db/index'
import { openLocalDb } from '../lib/db/runtime'

/**
 * 给某个账号生成一张一次性口令重置码（管理员在服务器上跑）。
 *
 *   npm run reset-password -- --email someone@example.com
 *
 * 生成的码 24 小时内有效、用一次作废；把它交给用户本人（聊天/电话均可），
 * 用户在登录页点「忘记口令」输入邮箱 + 码 + 新口令即可。
 * 库位置用 DATABASE_PATH 指定（容器里是 /data/fitchat.db），与其它脚本一致。
 */

function readArgs(argv: string[]): { email: string } | { error: string } {
  const email = argv.find((arg) => arg.startsWith('--email='))?.slice('--email='.length)
  if (email !== undefined && email.trim() !== '') return { email: email.trim() }
  return { error: '用法：npm run reset-password -- --email someone@example.com' }
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2))
  if ('error' in args) {
    console.error(args.error)
    process.exit(1)
  }

  const { db, close } = openLocalDb(dbPath())
  try {
    const result = await createResetCode(db, args.email)
    if (!result.ok) {
      console.error(result.message)
      process.exit(1)
    }
    console.log(`重置码（24 小时内有效，用一次作废）：${result.code}`)
    console.log(`交给 ${args.email} 本人，在登录页「忘记口令」里使用。`)
  } finally {
    close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
