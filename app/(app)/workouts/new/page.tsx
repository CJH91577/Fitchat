'use client'

import { useRef, useState } from 'react'
import styles from './new.module.css'

type Mode = 'cardio' | 'strength'

type SetRow = { id: number; weightKg: string; reps: string }

export default function NewWorkout() {
  const [mode, setMode] = useState<Mode>('strength')
  const [sets, setSets] = useState<SetRow[]>([
    { id: 1, weightKg: '60', reps: '10' },
  ])
  const nextId = useRef(2)

  const addSet = () =>
    setSets((prev) => [...prev, { id: nextId.current++, weightKg: '', reps: '' }])

  const removeSet = (id: number) => setSets((prev) => prev.filter((s) => s.id !== id))

  // 计划内容只作预填，用户可任意修改——记录反映实际发生的，不是计划的
  const updateSet = (id: number, field: 'weightKg' | 'reps', value: string) =>
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>记录运动</h1>

      <div className={styles.modes} role="group" aria-label="运动类型">
        {(['cardio', 'strength'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`${styles.mode} ${mode === m ? styles.modeActive : ''}`}
          >
            {m === 'cardio' ? '有氧' : '力量'}
          </button>
        ))}
      </div>

      {mode === 'strength' ? (
        <>
          <input className={styles.input} placeholder="动作名称，例如：卧推" />
          <p className={styles.hint}>计划里的目标：4 组 × 8–10 次。以下是实际完成的，可任意修改。</p>

          <div className={styles.sets}>
            {sets.map((set, i) => (
              <div key={set.id} className={styles.setRow}>
                <span className={`${styles.setIndex} num-tabular`}>{i + 1}</span>
                <input
                  className={styles.setInput}
                  inputMode="decimal"
                  placeholder="重量 kg"
                  value={set.weightKg}
                  onChange={(e) => updateSet(set.id, 'weightKg', e.target.value)}
                />
                <span className={styles.times}>×</span>
                <input
                  className={styles.setInput}
                  inputMode="numeric"
                  placeholder="次数"
                  value={set.reps}
                  onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeSet(set.id)}
                  aria-label={`删除第 ${i + 1} 组`}
                >
                  −
                </button>
              </div>
            ))}
          </div>

          <button type="button" className={styles.secondaryButton} onClick={addSet}>
            添加一组
          </button>
        </>
      ) : (
        <>
          <input className={styles.input} placeholder="运动名称，例如：慢跑" />
          <input className={styles.input} inputMode="numeric" placeholder="时长（分钟）" />
          <div className={styles.modes} role="group" aria-label="强度">
            {['轻松', '中等', '剧烈'].map((level) => (
              <button key={level} type="button" className={styles.mode}>
                {level}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className={styles.primaryButton}>
        保存
      </button>
    </main>
  )
}
