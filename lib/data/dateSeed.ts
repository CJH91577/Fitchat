// 确定性伪随机。以日期字符串与盐值作种子。
// 绝不用 Math.random——否则每次刷新数据都变，测试无法编写，问题无法复现。
//
// 先做 FNV-1a 累积，再做一步 32 位雪崩混合（murmur3 的 fmix32）。
// 收尾混合不可省：仅靠 FNV-1a 的输出，对「只有末位字符不同」的日期串
// 分布极差——实测 28 个连续日期的值会挤在 0.06~0.65（salt 30）或
// 0.23~0.32（salt 1）这样的窄带里。值互不相同，所以「互不相同」的
// 断言抓不到，但生成器的分支判定会因此恒定走同一边。
function fmix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export function hashSeed(key: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return fmix32(h)
}

/** 返回 [0, 1) 区间内的确定性数值 */
export function seededUnit(key: string, salt: number): number {
  return hashSeed(key, salt) / 4294967296
}

/** 返回 [min, max] 闭区间内的确定性整数 */
export function seededInt(key: string, salt: number, min: number, max: number): number {
  if (max <= min) return min
  return min + Math.floor(seededUnit(key, salt) * (max - min + 1))
}

/** 从数组里确定性地取一项 */
export function seededPick<T>(key: string, salt: number, items: readonly T[]): T {
  return items[seededInt(key, salt, 0, items.length - 1)]
}
