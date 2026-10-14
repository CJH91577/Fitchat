import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * 口令散列。
 *
 * 用 Node 内置的 scrypt，不引第三方库：bcrypt / argon2 都要编译原生模块，
 * 而这个项目的镜像里是用 `npm ci --ignore-scripts` 装依赖的（见 Dockerfile），
 * 编译型依赖在那里直接装不上。scrypt 是内存硬的 KDF，Node 自带，够用。
 *
 * 存储格式把**参数一起写进去**：`scrypt$N$r$p$salt$hash`。日后调高成本时，
 * 旧记录仍能按它自己的参数验证通过，不需要一次性重算所有人的口令。
 *
 * 用异步版 scrypt：它的开销在 libuv 线程池里，不会卡住事件循环（登录请求
 * 不至于把同进程的其他请求一起拖慢）。同步版在这里是能用但不该用。
 */

/** 成本参数。N 越大越慢、越难暴力破解；16384 在服务器上是几十毫秒量级。 */
const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64
const SALT_BYTES = 16

export const MIN_PASSWORD_LENGTH = 8

/**
 * scrypt 需要的内存约为 128 * N * r 字节，Node 默认上限是 32 MiB。
 * 当前参数只要 16 MiB，仍然显式写出来：调高 N 时应该看到这里一起改，
 * 而不是被一个「maxmem 超限」的运行时错误提醒。
 */
function maxMemFor(n: number, r: number): number {
  return 128 * n * r * 2
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: n, r, p, maxmem: maxMemFor(n, r) },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    )
  })
}

type Parsed = { n: number; r: number; p: number; salt: Buffer; hash: Buffer }

/**
 * 解析库里存的那串东西。任何不合规的输入都返回 null——**不抛异常**：
 * 登录路径不该因为一条脏记录变成 500，而且 500 与「口令不对」在攻击者
 * 眼里是两种不同的信号。
 */
function parseStored(stored: string): Parsed | null {
  const parts = stored.split('$')
  if (parts.length !== 6) return null
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts
  if (scheme !== 'scrypt') return null

  const n = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (![n, r, p].every((value) => Number.isSafeInteger(value))) return null
  if (n <= 1 || r < 1 || p < 1) return null

  // 参数是从库里读出来的：如果那条记录被改成一个荒谬的大数，scrypt 会去
  // 申请几 GB 内存。上限比当前成本宽一档，将来调高参数时不必改这里。
  if (n > 1 << 20 || r > 32 || p > 16) return null

  const salt = Buffer.from(saltRaw, 'base64url')
  const hash = Buffer.from(hashRaw, 'base64url')
  if (salt.length === 0 || hash.length < 16) return null

  return { n, r, p, salt, hash }
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`口令至少 ${MIN_PASSWORD_LENGTH} 位。`)
  }

  const salt = randomBytes(SALT_BYTES)
  const hash = await scryptAsync(plain, salt, KEY_LENGTH, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

/**
 * 校验口令。
 *
 * `stored` 允许为 null，因为 users.password_hash 就是可空的（演示用户没有凭据）。
 * 这种情况下**必须显式返回 false**：把「没有口令」当成「不需要口令」，
 * 等于给所有这样的账号留了一道无密码登录的后门。
 */
export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (stored === null) return false

  const parsed = parseStored(stored)
  if (parsed === null) return false

  const derived = await scryptAsync(
    plain,
    parsed.salt,
    parsed.hash.length,
    parsed.n,
    parsed.r,
    parsed.p,
  )

  // timingSafeEqual 要求两边等长，长度不等直接算失败（它本身会抛异常）
  if (derived.length !== parsed.hash.length) return false
  return timingSafeEqual(derived, parsed.hash)
}
