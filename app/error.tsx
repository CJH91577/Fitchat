'use client'

import styles from './error.module.css'

/**
 * 路由段渲染失败时的兜底页（root layout 还活着时用它）。
 *
 * 不渲染任何数据、不做任何诊断输出：用户要的是一个「还能看懂、能重试」
 * 的页面，而不是白屏或者一堆堆栈。错误本身由服务端记录（见
 * instrumentation.ts 的 onRequestError），不在页面上泄露。
 */
export default function Error({
  reset,
}: {
  /** 错误对象不渲染（细节属于日志，见 instrumentation.ts），只保留签名 */
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>出错了</h1>
      <p className={styles.text}>页面渲染时出了问题，可以重试一下。</p>
      <p className={styles.text}>如果一直出现，请稍后再来。</p>
      <button type="button" className={styles.button} onClick={reset}>
        重试
      </button>
    </main>
  )
}
