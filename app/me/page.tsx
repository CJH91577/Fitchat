import Link from 'next/link'
import { MOCK_GOAL, MOCK_USER, TODAY, weightFor } from '@/lib/data/mock'
import styles from './me.module.css'

const DIRECTION_LABEL = { cut: '减脂', bulk: '增肌', maintain: '维持' } as const

export default function Me() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>我的</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>个人资料</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>身高</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_USER.heightCm} cm</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>年龄</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_USER.age}</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>当前体重</span>
            {/* null 只会在开始使用日期晚于今天时出现；保留判断以免渲染出字面量 null */}
            <span className={`${styles.rowMeta} num-tabular`}>
              {weightFor(TODAY) ?? '—'} kg
            </span>
          </li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>每日目标</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>目标方向</span>
            <span className={styles.rowMeta}>{DIRECTION_LABEL[MOCK_GOAL.direction]}</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>热量</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.calories} 千卡</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>蛋白质</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.protein} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>碳水</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.carbs} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>脂肪</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.fat} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>目标体重</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.targetWeightKg} kg</span>
          </li>
        </ul>
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
