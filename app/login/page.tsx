import styles from './login.module.css'

export default function Login() {
  return (
    <main className={styles.page}>
      <h1 className={styles.logo}>Fitchat</h1>
      <p className={styles.subtitle}>当前为邀请制，需要邀请码才能注册。</p>

      <input className={styles.input} placeholder="邀请码" />
      <button type="button" className={styles.primaryButton}>
        进入
      </button>

      <p className={styles.hint}>邀请码不正确时，这里会明确告诉你哪里不对。</p>
    </main>
  )
}
