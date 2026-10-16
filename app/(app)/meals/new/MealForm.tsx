'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'
import AiBadge from '@/components/AiBadge'
import { type FoodOption, nutritionFor, parseMealSentence } from '@/lib/data/meal-parser'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { deleteMealEntryAction, saveMealAction, updateMealEntryAction } from './actions'
import {
  EMPTY_DELETE_STATE,
  EMPTY_SAVE_STATE,
  EMPTY_UPDATE_STATE,
  type TodayEntry,
} from './types'
import styles from './new.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** 与 actions.ts 的上限一致：界面上先挡住，服务端再挡一次 */
const MAX_ITEMS = 20

type Draft = { key: string; foodId: string; name: string; grams: number }

/**
 * 记录饮食。
 *
 * 两个入口（搜食物、说一句话）最终都落到同一份「待确认列表」上，用户改完份量
 * 才保存——这正是规格里「逐条确认后入库」的意思。解析在**浏览器里**做
 *（lib/data/meal-parser 是纯函数），所以没有网络往返，也不会因为「模型超时」
 * 而记不了饭。
 */
export default function MealForm({
  foods,
  entries,
}: {
  foods: FoodOption[]
  entries: TodayEntry[]
}) {
  const router = useRouter()

  const [slot, setSlot] = useState<MealSlot>('lunch')
  const [query, setQuery] = useState('')
  const [sentence, setSentence] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [unrecognized, setUnrecognized] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)

  const [saveState, save, saving] = useActionState(saveMealAction, EMPTY_SAVE_STATE)
  const [deleteState, removeEntry, removing] = useActionState(
    deleteMealEntryAction,
    EMPTY_DELETE_STATE,
  )
  const [updateState, updateEntry, updating] = useActionState(
    updateMealEntryAction,
    EMPTY_UPDATE_STATE,
  )

  // 正在编辑的那条记录；null = 表单在「新记一餐」模式
  const [editingId, setEditingId] = useState<string | null>(null)

  // 删掉一条之后让服务端重新渲染：列表由服务端查询得出，不在浏览器里自己猜一份
  useEffect(() => {
    if (deleteState.removedAt > 0) router.refresh()
  }, [deleteState.removedAt, router])

  // 编辑保存成功后直接跳回首页（与保存同一路径），所以这里不需要
  // 在 effect 里重置任何状态——组件在跳转后自然卸载。

  /** 把一条已保存的记录预填进表单：改成多少克，由「确认条目」里的克数决定 */
  function startEdit(entry: TodayEntry) {
    const food = foods.find((candidate) => candidate.name === entry.name)
    setSlot(entry.slot)
    if (!food) {
      setEditingId(null)
      setDrafts([])
      setNote('这条记录的食物已经不在食物库里，没法改了。')
      return
    }
    setDrafts([
      { key: `edit-${entry.id}`, foodId: food.id, name: food.name, grams: entry.grams },
    ])
    setEditingId(entry.id)
    setNote(null)
  }

  const byId = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])

  const results = useMemo(() => {
    const keyword = query.trim()
    if (keyword === '') return []
    return foods.filter((food) => food.name.includes(keyword)).slice(0, 8)
  }, [foods, query])

  function addFood(food: FoodOption, grams: number) {
    setDrafts((previous) => [
      ...previous,
      { key: `${food.id}-${previous.length}-${grams}`, foodId: food.id, name: food.name, grams },
    ])
    setQuery('')
    setNote(null)
  }

  function parseSentence() {
    const result = parseMealSentence(sentence, foods)

    setDrafts(
      result.items.map((item, index) => ({
        key: `${item.foodId ?? item.name}-${index}`,
        foodId: item.foodId ?? '',
        name: item.name,
        grams: item.grams,
      })),
    )
    setUnrecognized(result.unrecognized)
    // 句子里说了「中午」，就把餐次也一起换了——用户随后还能改
    if (result.slotHint !== null) setSlot(result.slotHint)
    setNote(
      result.items.length === 0
        ? '这句话里没有认出来的食物。可以直接搜食物，或者换个说法（例如「两个鸡蛋一碗米饭」）。'
        : null,
    )
  }

  const totalCalories = drafts.reduce((sum, draft) => {
    const food = byId.get(draft.foodId)
    return food ? sum + nutritionFor(food, draft.grams).calories : sum
  }, 0)

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

      <input
        className={styles.input}
        placeholder="搜索食物"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((food) => (
            <li key={food.id}>
              <button type="button" className={styles.result} onClick={() => addFood(food, 100)}>
                <span className={styles.resultName}>{food.name}</span>
                <span className={`${styles.resultMeta} num-tabular`}>每 100 克 {food.calories} 千卡</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.divider}>或者</div>

      <textarea
        className={styles.textarea}
        placeholder="用一句话描述你吃了什么，例如：中午吃了两个鸡蛋一碗米饭"
        value={sentence}
        onChange={(event) => setSentence(event.target.value)}
      />
      <button
        type="button"
        className={styles.primaryButton}
        disabled={sentence.trim().length === 0}
        onClick={parseSentence}
      >
        解析
      </button>
      <p className={styles.hint}>
        这里用的是食物词表加量词换算，不是模型：认不出的词会原样列出来，份量也会摆出来让你改。
      </p>

      {unrecognized.length > 0 && (
        <p className={styles.unrecognized}>没认出来：{unrecognized.join('、')}</p>
      )}
      {note !== null && <p className={styles.error}>{note}</p>}

      {drafts.length > 0 && (
        <form action={editingId !== null ? updateEntry : save} className={styles.drafts}>
          <h2 className={styles.parsedTitle}>
            {editingId !== null ? '修改这条记录' : '确认这些条目'}
          </h2>
          <p className={styles.parsedHint}>
            份量是按常见说法估的（「一个鸡蛋」≈ 50 克），可以直接改成实际克数。
          </p>

          {editingId !== null ? (
            <>
              <input type="hidden" name="entryId" value={editingId} />
              <input type="hidden" name="foodId" value={drafts[0]?.foodId ?? ''} />
              <input type="hidden" name="grams" value={drafts[0]?.grams ?? 0} />
            </>
          ) : (
            <>
              <input type="hidden" name="slot" value={slot} />
              <input
                type="hidden"
                name="items"
                value={JSON.stringify(
                  drafts.map((draft) => ({ foodId: draft.foodId, grams: draft.grams })),
                )}
              />
            </>
          )}

          <ul className={styles.list}>
            {drafts.map((draft, index) => {
              const food = byId.get(draft.foodId)
              const calories = food ? nutritionFor(food, draft.grams).calories : 0
              return (
                <li key={draft.key} className={styles.draftRow}>
                  <span className={styles.rowName}>{draft.name}</span>
                  <input
                    className={`${styles.grams} num-tabular`}
                    inputMode="numeric"
                    aria-label={`${draft.name}的克数`}
                    value={draft.grams}
                    onChange={(event) => {
                      const grams = Number(event.target.value.replace(/[^0-9]/g, ''))
                      setDrafts((previous) =>
                        previous.map((item, at) =>
                          at === index ? { ...item, grams: Number.isFinite(grams) ? grams : 0 } : item,
                        ),
                      )
                    }}
                  />
                  <span className={styles.gramsUnit}>克</span>
                  <span className={`${styles.rowMeta} num-tabular`}>{calories} 千卡</span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`移除${draft.name}`}
                    onClick={() =>
                      setDrafts((previous) => previous.filter((_, at) => at !== index))
                    }
                  >
                    −
                  </button>
                </li>
              )
            })}
          </ul>

          <p className={styles.parsedHint}>
            合计 <span className="num-tabular">{totalCalories}</span> 千卡
          </p>

          {saveState.error !== null && editingId === null && (
            <p className={styles.error}>{saveState.error}</p>
          )}
          {updateState.error !== null && editingId !== null && (
            <p className={styles.error}>{updateState.error}</p>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              (editingId !== null ? updating : saving) ||
              drafts.length === 0 ||
              drafts.length > MAX_ITEMS
            }
          >
            {editingId !== null
              ? updating
                ? '正在保存…'
                : '保存修改'
              : saving
                ? '正在保存…'
                : `保存到${MEAL_SLOT_LABEL[slot]}`}
          </button>
          {editingId !== null && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setEditingId(null)
                setDrafts([])
              }}
            >
              取消修改
            </button>
          )}
        </form>
      )}

      <section className={styles.entries}>
        <h2 className={styles.parsedTitle}>今天已记录</h2>
        {deleteState.error !== null && <p className={styles.error}>{deleteState.error}</p>}
        {entries.length === 0 ? (
          <p className={styles.parsedHint}>今天还没有记录。上面记一条，首页立刻就会变。</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.rowName}>
                  {MEAL_SLOT_LABEL[entry.slot]} · {entry.name}
                </span>
                <span className={styles.rowTags}>
                  {entry.source === 'ai-estimate' && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {entry.grams} 克 · {entry.calories} 千卡
                </span>
                <button
                  type="button"
                  className={styles.edit}
                  aria-label={`编辑${entry.name}`}
                  onClick={() => startEdit(entry)}
                >
                  编辑
                </button>
                {/* 删除是独立的一次提交，所以它自己一个表单：
                    表单不能嵌套，而保存那一次提交的是待确认列表 */}
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
