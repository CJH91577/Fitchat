'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { saveWeightAction } from './weight-action'
import styles from './page.module.css'

/**
 * 体重录入（今天或补记过去的某一天）。
 *
 * 卡片上那个大数字是**结果**，这个小表单是**入口**：这一天记过就预填成那个值，
 * 按钮写「改一下」——一天一条，再记就是改这一天那条（见 lib/db/writes.ts）。
 *
 * 日期可选但服务端会再验一遍：min/max 只是浏览器侧的顺手拦截，
 * 真正的边界在 weight-action.ts 里。
 */
export default function WeightForm({
  currentKg,
  date,
  minDate,
  maxDate,
}: {
  /** 所选日期已经记过的体重；没记过就是 null */
  currentKg: number | null
  /** 表单默认的日期（首页=今天，某日详情页=那天） */
  date: string
  /** 日期可选范围的下限：用户开始使用那天 */
  minDate?: string
  /** 日期可选范围的上限：今天（未来不许记） */
  maxDate?: string
}) {
  const router = useRouter()
  const [kg, setKg] = useState(currentKg === null ? '' : String(currentKg))
  const [day, setDay] = useState(date)
  const [state, submit, pending] = useActionState(saveWeightAction, { error: null, savedAt: 0 })

  // 保存成功后让服务端重新渲染：卡片上的数字直接跟着变，不需要整页跳转
  useEffect(() => {
    if (state.savedAt > 0) router.refresh()
  }, [state.savedAt, router])

  return (
    <form action={submit} className={styles.weightForm}>
      <input
        className={styles.weightDate}
        type="date"
        name="date"
        aria-label="日期"
        value={day}
        min={minDate}
        max={maxDate}
        onChange={(event) => setDay(event.target.value)}
      />
      <input
        className={styles.weightInput}
        name="kg"
        inputMode="decimal"
        aria-label="体重（公斤）"
        placeholder={currentKg === null ? '体重' : String(currentKg)}
        value={kg}
        onChange={(event) => setKg(event.target.value.replace(/[^0-9.]/g, ''))}
      />
      <button type="submit" className={styles.weightSave} disabled={pending || kg.trim() === ''}>
        {pending ? '保存中…' : currentKg === null ? '记录' : '改一下'}
      </button>
      {state.error !== null && <p className={styles.weightError}>{state.error}</p>}
    </form>
  )
}
