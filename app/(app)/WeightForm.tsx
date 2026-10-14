'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { saveWeightAction } from './weight-action'
import styles from './page.module.css'

/**
 * 今日空腹体重的录入。
 *
 * 卡片上那个大数字是**结果**，这个小表单是**入口**：今天记过就预填成那个值，
 * 按钮写「改一下」——一天一条，再记就是改今天这条（见 lib/db/writes.ts）。
 */
export default function WeightForm({ todayKg }: { todayKg: number | null }) {
  const router = useRouter()
  const [kg, setKg] = useState(todayKg === null ? '' : String(todayKg))
  const [state, submit, pending] = useActionState(saveWeightAction, { error: null, savedAt: 0 })

  // 保存成功后让服务端重新渲染：卡片上的数字直接跟着变，不需要整页跳转
  useEffect(() => {
    if (state.savedAt > 0) router.refresh()
  }, [state.savedAt, router])

  return (
    <form action={submit} className={styles.weightForm}>
      <input
        className={styles.weightInput}
        name="kg"
        inputMode="decimal"
        aria-label="今日体重（公斤）"
        placeholder={todayKg === null ? '今天的体重' : String(todayKg)}
        value={kg}
        onChange={(event) => setKg(event.target.value.replace(/[^0-9.]/g, ''))}
      />
      <button type="submit" className={styles.weightSave} disabled={pending || kg.trim() === ''}>
        {pending ? '保存中…' : todayKg === null ? '记录' : '改一下'}
      </button>
      {state.error !== null && <p className={styles.weightError}>{state.error}</p>}
    </form>
  )
}
