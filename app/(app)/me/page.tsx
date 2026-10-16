import Link from 'next/link'
import { signOutAction } from '@/lib/auth/actions'
import { requireUser } from '@/lib/auth/current-user'
import { today } from '@/lib/data/today'
import { goalFor, weightFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import styles from './me.module.css'

const DIRECTION_LABEL = { cut: '减脂', bulk: '增肌', maintain: '维持' } as const

// 每次请求都重新渲染：数据来自数据库，且「今天」要跟着真实日期走。
// 不加这一行，Next 会在构建时预渲染这些页面——数据被冻住，日期也一并冻住。
export const dynamic = 'force-dynamic'
export default async function Me() {
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()
  const db = getDb()
  // 没登录直接跳登录页（requireUser 内部会 redirect）
  const user = await requireUser(db)
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
            {/* 资料可以为空：注册只要邮箱与口令，身高/年龄是首次引导里才补的，
                补之前这里要说「未填写」，不能渲染 null 也不能编一个数 */}
            <span className={`${styles.rowMeta} num-tabular`}>
              {user.heightCm === null ? '未填写' : `${user.heightCm} cm`}
            </span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>年龄</span>
            <span className={`${styles.rowMeta} num-tabular`}>
              {user.age === null ? '未填写' : user.age}
            </span>
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

      {/* 数据是你自己的：一键拿走全部记录（只含当前登录用户的数据） */}
      <Link href="/export" className={styles.link}>
        导出我的记录（JSON）
      </Link>

      {/* 退出登录是**一次真正的注销**：Server Action 删掉库里的会话行再清 Cookie。
          这里以前是一个指向 /login 的链接——那只是换了页面，会话还是活的。 */}
      <form action={signOutAction}>
        <button type="submit" className={styles.linkButton}>
          退出登录
        </button>
      </form>
    </main>
  )
}
