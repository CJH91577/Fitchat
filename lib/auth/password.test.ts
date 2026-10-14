import { scrypt } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from './password'

/**
 * 用手工构造的哈希：证明「参数写在存储格式里」不是一句空话——
 * 用比当前更低成本生成的记录，仍然必须能验证通过（将来调高参数时，
 * 老记录不该集体登录失败）。
 */
function scryptHash(plain: string, salt: string, n: number, r: number, p: number): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(plain, Buffer.from(salt), 32, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => {
      if (err) return reject(err)
      const saltB64 = Buffer.from(salt).toString('base64url')
      resolve(['scrypt', n, r, p, saltB64, key.toString('base64url')].join('$'))
    })
  })
}

const PASSWORD = 'correct horse battery'

describe('口令散列', () => {
  it('同一个口令可以验证通过', async () => {
    const stored = await hashPassword(PASSWORD)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('错的口令验不过', async () => {
    const stored = await hashPassword(PASSWORD)
    expect(await verifyPassword('correct horse batteru', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
    expect(await verifyPassword(PASSWORD + ' ', stored)).toBe(false)
  })

  // 这条是安全底线：users.password_hash 允许为空，若把「没有口令」当成
  // 「不需要口令」，所有这样的账号都能被空口令登进去。
  it('存储值为 null 时一律不通过，而不是放行', async () => {
    expect(await verifyPassword('', null)).toBe(false)
    expect(await verifyPassword(PASSWORD, null)).toBe(false)
  })

  it('每次散列都用新的盐，所以同一口令的两次结果不同、但都能验证', async () => {
    const a = await hashPassword(PASSWORD)
    const b = await hashPassword(PASSWORD)
    expect(a).not.toBe(b)
    expect(await verifyPassword(PASSWORD, a)).toBe(true)
    expect(await verifyPassword(PASSWORD, b)).toBe(true)
  })

  it('存储格式自带参数，换参数生成的老记录仍然能验证', async () => {
    const stored = await scryptHash(PASSWORD, 'a-fixed-salt', 1024, 8, 1)
    expect(stored.startsWith('scrypt$1024$8$1$')).toBe(true)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('格式不对的记录当作验证失败，而不是抛异常', async () => {
    const malformed = [
      '',
      'x',
      'scrypt',
      'scrypt$16384$8$1',
      'scrypt$16384$8$1$onlyfive',
      'bcrypt$16384$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaA',
      'scrypt$abc$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaA',
      'scrypt$1$0$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaA',
      'scrypt$16384$8$1$$aGFzaGhhc2hoYXNoaGFzaA',
      'scrypt$16384$8$1$c2FsdA$',
    ]
    for (const stored of malformed) {
      expect(await verifyPassword(PASSWORD, stored), stored).toBe(false)
    }
  })

  // 记录被改成天文数字的成本参数时，scrypt 会去申请几 GB 内存。
  // 这条测试要的是「立刻返回 false」，而不是把进程拖死或抛 OOM。
  it('成本参数被改得离谱时直接失败', async () => {
    const bomb = ['scrypt', 1073741824, 1024, 1, 'c2FsdA', 'aGFzaGhhc2hoYXNoaGFzaA'].join('$')
    expect(await verifyPassword(PASSWORD, bomb)).toBe(false)
  })

  it('太短的口令不允许用来创建记录', async () => {
    await expect(hashPassword('short')).rejects.toThrow(String(MIN_PASSWORD_LENGTH))
    await expect(hashPassword('')).rejects.toThrow()
  })
})
