'use client'

import { useActionState, useState } from 'react'
import {
  ACTIVITY_LABEL,
  type ActivityLevel,
  type Sex,
  dailyTarget,
} from '@/lib/data/target'
import type { GoalDirection } from '@/lib/data/types'
import { saveOnboardingAction } from './actions'
import styles from './onboarding.module.css'

const DIRECTIONS: { key: GoalDirection; label: string; hint: string }[] = [
  { key: 'cut', label: '减脂', hint: '在需要量基础上制造热量赤字' },
  { key: 'bulk', label: '增肌', hint: '在需要量基础上制造热量盈余' },
  { key: 'maintain', label: '维持', hint: '保持当前体重，不做热量调整' },
]

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active']
const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: '男' },
  { key: 'female', label: '女' },
]

/**
 * 首次引导。
 *
 * 规格里的顺序是「填资料 → 选目标方向 → 展示算出的每日目标 → 允许手动微调」，
 * 所以这里是两步：资料齐了才进入第二步，第二步把公式算出来的数字摆出来，
 * 热量那一格可以直接改——改完蛋白与脂肪不变、碳水跟着重算，于是三者和热量
 * 永远自洽。
 */
export default function OnboardingForm() {
  const [step, setStep] = useState<1 | 2>(1)

  const [direction, setDirection] = useState<GoalDirection | null>(null)
  const [sex, setSex] = useState<Sex | null>(null)
  const [activity, setActivity] = useState<ActivityLevel>('light')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [age, setAge] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [calories, setCalories] = useState<number | null>(null)

  const [state, submit, pending] = useActionState(saveOnboardingAction, { error: null })

  const numbers = {
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    age: Number(age),
  }
  const profileReady =
    direction !== null &&
    sex !== null &&
    Number.isFinite(numbers.heightCm) &&
    numbers.heightCm >= 100 &&
    numbers.heightCm <= 250 &&
    Number.isFinite(numbers.weightKg) &&
    numbers.weightKg >= 20 &&
    numbers.weightKg <= 400 &&
    Number.isInteger(numbers.age) &&
    numbers.age >= 10 &&
    numbers.age <= 100

  const suggested =
    profileReady && direction !== null && sex !== null
      ? dailyTarget({
          sex,
          heightCm: numbers.heightCm,
          weightKg: numbers.weightKg,
          age: numbers.age,
          activity,
          direction,
        })
      : null

  const effectiveCalories = calories ?? suggested?.calories ?? null
  const carbs =
    effectiveCalories !== null && suggested !== null
      ? Math.max(0, Math.round((effectiveCalories - suggested.protein * 4 - suggested.fat * 9) / 4))
      : null

  if (step === 2 && suggested !== null && direction !== null && sex !== null) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>这是算出来的每日目标</h1>
        <p className={styles.subtitle}>
          由身高、体重、年龄、性别与活动量估算，误差在 ±10% 上下。热量可以直接改，碳水会跟着重算。
        </p>

        <form action={submit} className={styles.form}>
          <input type="hidden" name="heightCm" value={heightCm} />
          <input type="hidden" name="weightKg" value={weightKg} />
          <input type="hidden" name="age" value={age} />
          <input type="hidden" name="sex" value={sex} />
          <input type="hidden" name="activity" value={activity} />
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="targetWeightKg" value={targetWeightKg} />

          <label className={styles.field}>
            <span className={styles.fieldLabel}>每日热量（千卡）</span>
            <input
              className={styles.input}
              name="calories"
              inputMode="numeric"
              value={effectiveCalories ?? ''}
              onChange={(event) =>
                setCalories(Number(event.target.value.replace(/[^0-9]/g, '')) || 0)
              }
            />
          </label>

          <ul className={styles.list}>
            <li className={styles.row}>
              <span className={styles.rowName}>蛋白质</span>
              <span className={`${styles.rowMeta} num-tabular`}>{suggested.protein} 克</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>碳水</span>
              <span className={`${styles.rowMeta} num-tabular`}>{carbs} 克</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>脂肪</span>
              <span className={`${styles.rowMeta} num-tabular`}>{suggested.fat} 克</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>每日运动目标</span>
              <span className={`${styles.rowMeta} num-tabular`}>
                {suggested.exerciseCalories} 千卡
              </span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>目标体重</span>
              <span className={`${styles.rowMeta} num-tabular`}>{targetWeightKg} kg</span>
            </li>
          </ul>

          {state.error !== null && <p className={styles.error}>{state.error}</p>}

          <button type="submit" className={styles.primaryButton} disabled={pending}>
            {pending ? '正在保存…' : '就用这个目标'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setStep(1)}>
            回去改资料
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>你的目标是？</h1>
      <p className={styles.subtitle}>这一步决定每日热量目标是往下调还是往上调。</p>

      <div className={styles.options}>
        {DIRECTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setDirection(option.key)}
            aria-pressed={direction === option.key}
            className={`${styles.option} ${direction === option.key ? styles.selected : ''}`}
          >
            <span className={styles.optionLabel}>{option.label}</span>
            <span className={styles.optionHint}>{option.hint}</span>
          </button>
        ))}
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>身高（厘米）</span>
          <input
            className={styles.input}
            inputMode="numeric"
            aria-label="身高（厘米）"
            placeholder="175"
            value={heightCm}
            onChange={(event) => setHeightCm(event.target.value.replace(/[^0-9]/g, ''))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>当前体重（公斤）</span>
          <input
            className={styles.input}
            inputMode="decimal"
            aria-label="当前体重（公斤）"
            placeholder="78"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value.replace(/[^0-9.]/g, ''))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>年龄</span>
          <input
            className={styles.input}
            inputMode="numeric"
            aria-label="年龄"
            placeholder="30"
            value={age}
            onChange={(event) => setAge(event.target.value.replace(/[^0-9]/g, ''))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>目标体重（公斤）</span>
          <input
            className={styles.input}
            inputMode="decimal"
            aria-label="目标体重（公斤）"
            placeholder="70"
            value={targetWeightKg}
            onChange={(event) => setTargetWeightKg(event.target.value.replace(/[^0-9.]/g, ''))}
          />
        </label>
      </div>

      <div className={styles.fields}>
        <span className={styles.fieldLabel}>生理性别（基础代谢公式需要）</span>
        <div className={styles.options} role="group" aria-label="生理性别">
          {SEXES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSex(option.key)}
              aria-pressed={sex === option.key}
              className={`${styles.option} ${sex === option.key ? styles.selected : ''}`}
            >
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fields}>
        <span className={styles.fieldLabel}>活动量</span>
        <div className={styles.options} role="group" aria-label="活动量">
          {ACTIVITIES.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setActivity(level)}
              aria-pressed={activity === level}
              className={`${styles.option} ${activity === level ? styles.selected : ''}`}
            >
              <span className={styles.optionLabel}>{ACTIVITY_LABEL[level]}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={styles.primaryButton}
        disabled={!profileReady || targetWeightKg === ''}
        onClick={() => setStep(2)}
      >
        {profileReady && targetWeightKg !== '' ? '生成我的目标' : '请先填完上面的资料'}
      </button>

      <p className={styles.note}>算出的目标是估计值，下一步可以手动调整。</p>
    </main>
  )
}
