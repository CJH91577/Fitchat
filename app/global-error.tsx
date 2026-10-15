'use client'

import styles from './global-error.module.css'

/**
 * root layout 自己渲染失败时的兜底页——layout 已经没了，所以这里必须自带
 * <html> 与 <body>。内容与 app/error.tsx 保持一致：可读、可重试，不泄露堆栈。
 */
export default function GlobalError({
  reset,
}: {
  /** 错误对象不渲染（细节属于日志，见 instrumentation.ts），只保留签名 */
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body className={styles.body}>
        <main className={styles.page}>
          <h1 className={styles.title}>出错了</h1>
          <p className={styles.text}>页面渲染时出了问题，可以重试一下。</p>
          <p className={styles.text}>如果一直出现，请稍后再来。</p>
          <button type="button" className={styles.button} onClick={reset}>
            重试
          </button>
        </main>
      </body>
    </html>
  )
}
