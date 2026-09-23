'use client'

import { useState } from 'react'
import AiBadge from '@/components/AiBadge'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import styles from './new.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

// demo 阶段：解析结果是可编辑列表，用户逐条确认才入库（规格 5.4 节其一）
const MOCK_PARSED = [
  { id: 'p1', name: '鸡蛋', grams: 100, calories: 144, source: 'curated' as const },
  { id: 'p2', name: '米饭', grams: 200, calories: 232, source: 'curated' as const },
  { id: 'p3', name: '红烧肉', grams: 100, calories: 472, source: 'ai-estimate' as const },
]

export default function NewMeal() {
  const [slot, setSlot] = useState<MealSlot>('lunch')
  const [sentence, setSentence] = useState('')
  const [parsed, setParsed] = useState<typeof MOCK_PARSED | null>(null)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>记录饮食</h1>

      <div className={styles.slots} role="group" aria-label="餐次">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            aria-pressed={slot === s}
            className={`${styles.slot} ${slot === s ? styles.slotActive : ''}`}
          >
            {MEAL_SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      <input className={styles.input} placeholder="搜索食物" />

      <div className={styles.divider}>或者</div>

      <textarea
        className={styles.textarea}
        placeholder="用一句话描述你吃了什么，例如：中午吃了两个鸡蛋一碗米饭"
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
      />
      <button
        type="button"
        className={styles.primaryButton}
        disabled={sentence.trim().length === 0}
        onClick={() => setParsed(MOCK_PARSED)}
      >
        解析
      </button>

      {parsed && (
        <section className={styles.parsed}>
          <h2 className={styles.parsedTitle}>确认这些条目</h2>
          <p className={styles.parsedHint}>模型可能认错食物或估错份量，请核对后保存。</p>
          <ul className={styles.list}>
            {parsed.map((item) => (
              <li key={item.id} className={styles.row}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowTags}>
                  {item.source === 'ai-estimate' && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>{item.calories} 千卡</span>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.primaryButton}>
            保存到{MEAL_SLOT_LABEL[slot]}
          </button>
        </section>
      )}
    </main>
  )
}
