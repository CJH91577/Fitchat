import Link from 'next/link'
import { today } from '@/lib/data/today'
import { goalFor, weightFor } from '@/lib/db/queries'
import { getDb, getDemoUser } from '@/lib/db/runtime'
import styles from './me.module.css'

const DIRECTION_LABEL = { cut: '减脂', bulk: '增肌', maintain: '维持' } as const

// 每次请求都重新渲染：数据来自数据库，且「今天」要跟着真实日期走。
// 不加这一行，Next 会在构建时预渲染这些页面——数据被冻住，日期也一并冻住。
export const dynamic = 'force-dynamic'
export default async function Me() {
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()
  const db = getDb()
  const user = await getDemoUser(db)
  const goal = await goalFor(db, user.id)
  const currentWeight = await weightFor(db, user, TODAY)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>我的</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>个人资料</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>身高</span>
            <span className={`${styles.rowMeta} num-tabular`}>{user.heightCm} cm</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>年龄</span>
            <span className={`${styles.rowMeta} num-tabular`}>{user.age}</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>当前体重</span>
            {/* null 只在「今天没有体重记录」时出现；保留判断以免渲染出字面量 null */}
            <span className={`${styles.rowMeta} num-tabular`}>{currentWeight ?? '—'} kg</span>
          </li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>每日目标</h2>
        {goal === null ? (
          <p className={styles.empty}>还没有设定每日目标。</p>
        ) : (
          <ul className={styles.list}>
            <li className={styles.row}>
              <span className={styles.rowName}>目标方向</span>
              <span className={styles.rowMeta}>{DIRECTION_LABEL[goal.direction]}</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>热量</span>
              <span className={`${styles.rowMeta} num-tabular`}>{goal.calories} 千卡</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>蛋白质</span>
              <span className={`${styles.rowMeta} num-tabular`}>{goal.protein} g</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>碳水</span>
              <span className={`${styles.rowMeta} num-tabular`}>{goal.carbs} g</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>脂肪</span>
              <span className={`${styles.rowMeta} num-tabular`}>{goal.fat} g</span>
            </li>
            <li className={styles.row}>
              <span className={styles.rowName}>目标体重</span>
              <span className={`${styles.rowMeta} num-tabular`}>{goal.targetWeightKg} kg</span>
            </li>
          </ul>
        )}
      </section>

      <Link href="/plan" className={styles.link}>
        训练计划
      </Link>
      <Link href="/login" className={styles.link}>
        退出登录
      </Link>
    </main>
  )
}
