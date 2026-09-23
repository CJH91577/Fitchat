'use client'

import { useState } from 'react'
import type { GoalDirection } from '@/lib/data/types'
import styles from './onboarding.module.css'

const OPTIONS: { key: GoalDirection; label: string; hint: string }[] = [
  { key: 'cut', label: '减脂', hint: '在需要量基础上制造热量赤字' },
  { key: 'bulk', label: '增肌', hint: '在需要量基础上制造热量盈余' },
  { key: 'maintain', label: '维持', hint: '保持当前体重，不做热量调整' },
]

export default function Onboarding() {
  // 规格 8.1 节：默认值不得设为减脂，必须由用户明确选择
  const [direction, setDirection] = useState<GoalDirection | null>(null)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>你的目标是？</h1>
      <p className={styles.subtitle}>这一步决定每日热量目标是往下调还是往上调。</p>

      <div className={styles.options}>
        {OPTIONS.map((option) => (
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
        <input className={styles.input} inputMode="numeric" placeholder="身高 cm" />
        <input className={styles.input} inputMode="decimal" placeholder="当前体重 kg" />
        <input className={styles.input} inputMode="numeric" placeholder="年龄" />
      </div>

      <button type="button" className={styles.primaryButton} disabled={!direction}>
        {direction ? '生成我的目标' : '请先选择目标'}
      </button>

      <p className={styles.note}>
        算出的目标是估计值，下一步可以手动调整。
      </p>
    </main>
  )
}
