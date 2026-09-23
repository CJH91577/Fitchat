'use client'

import styles from './DateRangeFilter.module.css'

export type RangeKey = 7 | 30 | 90

const OPTIONS: RangeKey[] = [7, 30, 90]

export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: RangeKey
  onChange: (v: RangeKey) => void
}) {
  return (
    <div className={styles.row} role="group" aria-label="时间区间">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`${styles.button} ${value === option ? styles.selected : ''}`}
        >
          {/* 选中态靠字形加粗与底色，不只靠颜色 */}
          <span className={styles.check} aria-hidden="true">
            {value === option ? '✓' : ''}
          </span>
          {option} 天
        </button>
      ))}
    </div>
  )
}
