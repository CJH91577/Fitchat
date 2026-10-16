'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { WEEKDAY_LABELS } from '@/lib/data/dates'
import type { PlanDay } from '@/lib/data/types'
import { savePlanDayAction } from './actions'
import { EMPTY_PLAN_FORM_STATE } from './types'
import styles from './plan.module.css'

/**
 * 训练计划：可读可改，今天那行带「去记录」入口。
 *
 * 编辑态只存在于浏览器里（这个组件是客户端组件），保存走 Server Action；
 * 保存成功后 router.refresh() 让服务端重新渲染，页面用
 * `key={JSON.stringify(plan)}`（见 page.tsx）在计划数据变化时把整个
 * 组件重挂一遍——编辑态随之退出，不需要在 effect 里手动重置状态。
 */

type DraftItem = { key: number; name: string; sets: string; reps: string }

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export default function PlanEditor({
  plan,
  todayWeekday,
}: {
  plan: PlanDay[]
  /** 1 = 周一 … 7 = 周日 */
  todayWeekday: number
}) {
  const router = useRouter()

  const [editingWeekday, setEditingWeekday] = useState<number | null>(null)
  const [theme, setTheme] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const nextKey = useRef(1)

  const [state, save, pending] = useActionState(savePlanDayAction, EMPTY_PLAN_FORM_STATE)

  useEffect(() => {
    if (state.savedAt > 0) router.refresh()
  }, [state.savedAt, router])

  const dayOf = (weekday: number) => plan.find((day) => day.weekday === weekday)

  function startEdit(weekday: number) {
    const day = dayOf(weekday)
    setEditingWeekday(weekday)
    setTheme(day?.theme ?? '')
    setItems(
      (day?.items ?? []).map((item, index) => ({
        key: index + 1,
        name: item.name,
        sets: String(item.sets),
        reps: item.reps,
      })),
    )
    nextKey.current = (day?.items.length ?? 0) + 10
  }

  function addItem() {
    setItems((previous) => [...previous, { key: nextKey.current++, name: '', sets: '3', reps: '10' }])
  }

  function updateItem(key: number, field: 'name' | 'sets' | 'reps', value: string) {
    setItems((previous) => previous.map((item) => (item.key === key ? { ...item, [field]: value } : item)))
  }

  function removeItem(key: number) {
    setItems((previous) => previous.filter((item) => item.key !== key))
  }

  function cancelEdit() {
    setEditingWeekday(null)
    setItems([])
  }

  const submittedItems = items.map((item) => ({
    name: item.name,
    sets: Number.parseInt(item.sets, 10) || 0,
    reps: item.reps,
  }))

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>训练计划</h1>

      <ul className={styles.days}>
        {WEEKDAYS.map((weekday) => {
          const day = dayOf(weekday)
          const isToday = weekday === todayWeekday
          const editing = editingWeekday === weekday

          if (editing) {
            return (
              <li key={weekday} className={`${styles.day} ${styles.editing}`}>
                <form action={save}>
                  <input type="hidden" name="weekday" value={weekday} />
                  <div className={styles.dayHead}>
                    <span className={styles.weekday}>{WEEKDAY_LABELS[weekday]}</span>
                    <input
                      className={styles.themeInput}
                      name="theme"
                      aria-label={`${WEEKDAY_LABELS[weekday]}的主题`}
                      placeholder="主题（休息日填「休息」）"
                      value={theme}
                      onChange={(event) => setTheme(event.target.value)}
                    />
                  </div>

                  <input
                    type="hidden"
                    name="items"
                    value={JSON.stringify(submittedItems)}
                  />

                  <ul className={styles.items}>
                    {items.map((item, index) => (
                      <li key={item.key} className={styles.item}>
                        <input
                          className={styles.itemNameInput}
                          aria-label={`第 ${index + 1} 个动作名称`}
                          placeholder="动作名称"
                          value={item.name}
                          onChange={(event) => updateItem(item.key, 'name', event.target.value)}
                        />
                        <input
                          className={styles.itemSetsInput}
                          aria-label={`第 ${index + 1} 个动作组数`}
                          inputMode="numeric"
                          value={item.sets}
                          onChange={(event) =>
                            updateItem(item.key, 'sets', event.target.value.replace(/[^0-9]/g, ''))
                          }
                        />
                        <span className={styles.times}>组 ×</span>
                        <input
                          className={styles.itemRepsInput}
                          aria-label={`第 ${index + 1} 个动作次数`}
                          placeholder="次数（如 10、力竭）"
                          value={item.reps}
                          onChange={(event) => updateItem(item.key, 'reps', event.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`删除第 ${index + 1} 个动作`}
                          onClick={() => removeItem(item.key)}
                        >
                          −
                        </button>
                      </li>
                    ))}
                  </ul>

                  <button type="button" className={styles.addItem} onClick={addItem}>
                    添加动作
                  </button>

                  {state.error !== null && <p className={styles.error}>{state.error}</p>}

                  <div className={styles.actions}>
                    <button type="submit" className={styles.save} disabled={pending}>
                      {pending ? '正在保存…' : '保存'}
                    </button>
                    <button type="button" className={styles.cancel} onClick={cancelEdit}>
                      取消
                    </button>
                  </div>
                </form>
              </li>
            )
          }

          return (
            <li key={weekday} className={`${styles.day} ${isToday ? styles.today : ''}`}>
              <div className={styles.dayHead}>
                <span className={styles.weekday}>{WEEKDAY_LABELS[weekday]}</span>
                <span className={styles.theme}>{day?.theme ?? '未设置'}</span>
                {isToday && <span className={styles.todayTag}>今天</span>}
                <button
                  type="button"
                  className={styles.editButton}
                  aria-label={`编辑${WEEKDAY_LABELS[weekday]}`}
                  onClick={() => startEdit(weekday)}
                >
                  编辑
                </button>
                {isToday && (
                  <Link className={styles.recordLink} href="/workouts/new">
                    去记录 ›
                  </Link>
                )}
              </div>

              {!day || day.items.length === 0 ? (
                <p className={styles.rest}>{day ? '休息' : '还没有设置计划'}</p>
              ) : (
                <ul className={styles.items}>
                  {day.items.map((item) => (
                    <li key={item.name} className={styles.item}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={`${styles.itemMeta} num-tabular`}>
                        {item.sets} 组 × {item.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
