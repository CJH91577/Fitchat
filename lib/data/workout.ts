/**
 * 运动消耗的估算。
 *
 * 这些数字是**粗估**，界面上也这么标：真实消耗跟体重、心率、动作幅度都有关，
 * 而这里只有一个动作名、时长或组数。写清楚比算得漂亮重要——用户看到的是
 * 一个「约」字，不会拿它当测量值。
 *
 * 有氧的每分钟消耗沿用演示数据里那张表（lib/data/generator.ts），这样库里
 * 已有的记录与今天新记的一条用的是同一套口径，不会出现「同样的慢跑，
 * 昨天 300 千卡今天 240 千卡」。
 */

export type Intensity = 'easy' | 'moderate' | 'hard'

export const INTENSITY_LABEL: Record<Intensity, string> = {
  easy: '轻松',
  moderate: '中等',
  hard: '剧烈',
}

const CARDIO_PER_MINUTE: Record<string, number> = {
  慢跑: 10,
  快走: 6,
  骑行: 11,
}

/** 没在表里的有氧动作按中等强度估 */
const DEFAULT_PER_MINUTE = 8

const INTENSITY_FACTOR: Record<Intensity, number> = {
  easy: 0.8,
  moderate: 1,
  hard: 1.25,
}

/** 一组力量动作（含组间休息）大约多少千卡。四组 ≈ 160，与演示数据里的量级一致 */
const KCAL_PER_SET = 40

export function estimateCardioCalories(name: string, minutes: number, intensity: Intensity): number {
  const perMinute = CARDIO_PER_MINUTE[name.trim()] ?? DEFAULT_PER_MINUTE
  return Math.round(minutes * perMinute * INTENSITY_FACTOR[intensity])
}

export function estimateStrengthCalories(setCount: number): number {
  return Math.round(setCount * KCAL_PER_SET)
}
