'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { INTENSITY_LABEL, type Intensity, estimateCardioCalories, estimateStrengthCalories } from '@/lib/data/workout'
import { deleteWorkoutAction, saveWorkoutAction, updateWorkoutAction } from './actions'
import {
  EMPTY_DELETE_STATE,
  EMPTY_SAVE_STATE,
  EMPTY_UPDATE_STATE,
  type PlanHint,
  type TodayExercise,
} from './types'
import styles from './new.module.css'

type Mode = 'cardio' | 'strength'

type SetRow = { id: number; weightKg: string; reps: string }

const INTENSITIES: Intensity[] = ['easy', 'moderate', 'hard']

/**
 * 记录运动。
 *
 * 两条路径共用一份「实际完成了什么」的输入：有氧是时长与强度，力量是逐组的
 * 「重量 × 次数」。计划只作**预填**——记录反映实际发生的，不是计划的。
 */
export default function WorkoutForm({
  plan,
  entries,
}: {
  plan: PlanHint | null
  entries: TodayExercise[]
}) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('strength')
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [sets, setSets] = useState<SetRow[]>([{ id: 1, weightKg: '60', reps: '10' }])
  const nextId = useRef(2)

  const [saveState, save, saving] = useActionState(saveWorkoutAction, EMPTY_SAVE_STATE)
  const [deleteState, removeEntry, removing] = useActionState(
    deleteWorkoutAction,
    EMPTY_DELETE_STATE,
  )
  const [updateState, updateEntry, updating] = useActionState(
    updateWorkoutAction,
    EMPTY_UPDATE_STATE,
  )

  // 正在编辑的那条记录；null = 表单在「新记一条」模式
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (deleteState.removedAt > 0) router.refresh()
  }, [deleteState.removedAt, router])

  // 编辑保存成功后直接跳回首页（与保存同一路径），所以这里不需要
  // 在 effect 里重置任何状态——组件在跳转后自然卸载。

  /** 把一条已保存的记录预填进表单：改时长或逐组重量次数，保存即更新 */
  function startEdit(entry: TodayExercise) {
    setEditingId(entry.id)
    setName(entry.name)
    setMode(entry.kind)
    if (entry.kind === 'cardio') {
      setMinutes(String(entry.minutes ?? 30))
      setIntensity('moderate')
    } else {
      setSets(
        entry.sets.map((set, index) => ({
          id: index + 1,
          weightKg: String(set.weightKg),
          reps: String(set.reps),
        })),
      )
    }
  }

  const addSet = () =>
    setSets((previous) => [...previous, { id: nextId.current++, weightKg: '', reps: '' }])
  const removeSet = (id: number) => sets.length > 1 && setSets((previous) => previous.filter((s) => s.id !== id))
  const updateSet = (id: number, field: 'weightKg' | 'reps', value: string) =>
    setSets((previous) => previous.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  const estimate =
    mode === 'cardio'
      ? estimateCardioCalories(name, Number(minutes) || 0, intensity)
      : estimateStrengthCalories(sets.length)

  /** 提交给服务端的组数据：只传重量与次数，千卡由服务端估 */
  const submittedSets = sets
    .map((set) => ({ reps: Number(set.reps), weightKg: Number(set.weightKg) }))
    .filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weightKg))
  const setsValid =
    submittedSets.length === sets.length &&
    submittedSets.every((set) => set.reps >= 1 && set.reps <= 100 && set.weightKg >= 0 && set.weightKg <= 500)

  const canSave = name.trim() !== '' && (mode === 'cardio' ? Number(minutes) > 0 : setsValid)

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

      {plan !== null && plan.items.length > 0 && editingId === null && (
        <div className={styles.suggestions}>
          <p className={styles.hint}>今天该练 · {plan.theme}（点一下预填，记录的是实际完成的）</p>
          {plan.items.map((item) => (
            <button
              key={item.name}
              type="button"
              className={styles.suggestion}
              onClick={() => {
                setName(item.name)
                setSets(
                  Array.from({ length: item.sets }, () => ({
                    id: nextId.current++,
                    weightKg: '',
                    reps: String(Number.parseInt(item.reps, 10) || 10),
                  })),
                )
              }}
            >
              {item.name} · {item.sets} 组 × {item.reps}
            </button>
          ))}
        </div>
      )}

      {plan !== null && plan.items.length === 0 && (
        <p className={styles.hint}>今天计划是{plan.theme}。</p>
      )}

      <form action={editingId !== null ? updateEntry : save} className={styles.form}>
        {editingId !== null && <input type="hidden" name="entryId" value={editingId} />}
        <input type="hidden" name="kind" value={mode} />

        <input
          className={styles.input}
          name="name"
          placeholder={mode === 'cardio' ? '运动名称，例如：慢跑' : '动作名称，例如：卧推'}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {mode === 'strength' ? (
          <>
            <div className={styles.sets}>
              {sets.map((set, index) => (
                <div key={set.id} className={styles.setRow}>
                  <span className={`${styles.setIndex} num-tabular`}>{index + 1}</span>
                  <input
                    className={styles.setInput}
                    inputMode="decimal"
                    aria-label={`第 ${index + 1} 组重量`}
                    placeholder="重量 kg"
                    value={set.weightKg}
                    onChange={(event) => updateSet(set.id, 'weightKg', event.target.value)}
                  />
                  <span className={styles.times}>×</span>
                  <input
                    className={styles.setInput}
                    inputMode="numeric"
                    aria-label={`第 ${index + 1} 组次数`}
                    placeholder="次数"
                    value={set.reps}
                    onChange={(event) => updateSet(set.id, 'reps', event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => removeSet(set.id)}
                    aria-label={`删除第 ${index + 1} 组`}
                  >
                    −
                  </button>
                </div>
              ))}
            </div>

            <input type="hidden" name="sets" value={JSON.stringify(submittedSets)} />

            <button type="button" className={styles.secondaryButton} onClick={addSet}>
              添加一组
            </button>
          </>
        ) : (
          <>
            <input
              className={styles.input}
              name="minutes"
              inputMode="numeric"
              aria-label="时长（分钟）"
              placeholder="时长（分钟）"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
            />
            <div className={styles.modes} role="group" aria-label="强度">
              {INTENSITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setIntensity(level)}
                  aria-pressed={intensity === level}
                  className={`${styles.mode} ${intensity === level ? styles.modeActive : ''}`}
                >
                  {INTENSITY_LABEL[level]}
                </button>
              ))}
            </div>
            <input type="hidden" name="intensity" value={intensity} />
          </>
        )}

        <p className={styles.hint}>
          预计消耗约 <span className="num-tabular">{estimate}</span> 千卡——粗估，真实消耗还跟体重与心率有关。
        </p>

        {editingId === null && saveState.error !== null && (
          <p className={styles.error}>{saveState.error}</p>
        )}
        {editingId !== null && updateState.error !== null && (
          <p className={styles.error}>{updateState.error}</p>
        )}

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={(editingId !== null ? updating : saving) || !canSave}
        >
          {editingId !== null
            ? updating
              ? '正在保存…'
              : '保存修改'
            : saving
              ? '正在保存…'
              : '保存'}
        </button>
        {editingId !== null && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setEditingId(null)
              setName('')
              setMinutes('30')
              setSets([{ id: 1, weightKg: '60', reps: '10' }])
            }}
          >
            取消修改
          </button>
        )}
      </form>

      <section className={styles.entries}>
        <h2 className={styles.entriesTitle}>今天已记录</h2>
        {deleteState.error !== null && <p className={styles.error}>{deleteState.error}</p>}
        {entries.length === 0 ? (
          <p className={styles.hint}>今天还没有运动记录。</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.entryRow}>
                <span className={styles.entryName}>{entry.name}</span>
                <span className={`${styles.entryMeta} num-tabular`}>
                  {entry.kind === 'cardio' ? `${entry.minutes} 分钟` : `${entry.setCount} 组`} ·{' '}
                  {entry.caloriesBurned} 千卡
                </span>
                <button
                  type="button"
                  className={styles.edit}
                  aria-label={`编辑${entry.name}`}
                  onClick={() => startEdit(entry)}
                >
                  编辑
                </button>
                <form action={removeEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button
                    type="submit"
                    className={styles.remove}
                    aria-label={`删除${entry.name}`}
                    disabled={removing}
                  >
                    −
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
