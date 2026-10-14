'use client'

import { useActionState, useState } from 'react'
import { registerAction, signInAction, signInAsDemoAction } from '@/lib/auth/actions'
import { EMPTY_FORM_STATE } from '@/lib/auth/form-state'
import styles from './login.module.css'

/**
 * 登录 / 注册表单。
 *
 * 客户端组件，因为它要切换「登录 / 注册」两种形态并显示服务端返回的错误；
 * 提交本身走 Server Action（表单的 action 属性），所以即使 JS 没跑起来，
 * 表单也照样能提交——校验与跳转都在服务端。
 */

type Mode = 'signin' | 'register'

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')

  // 两种形态各有自己的状态：切回来时上一次的错误不该跟着回来
  const [signInState, signInSubmit, signInPending] = useActionState(signInAction, EMPTY_FORM_STATE)
  const [registerState, registerSubmit, registerPending] = useActionState(
    registerAction,
    EMPTY_FORM_STATE,
  )

  const pending = mode === 'signin' ? signInPending : registerPending

  return (
    <main className={styles.page}>
      <h1 className={styles.logo}>Fitchat</h1>
      <p className={styles.subtitle}>记录吃了什么、练了什么，剩下的交给趋势。</p>

      <div className={styles.tabs} role="group" aria-label="登录或注册">
        <button
          type="button"
          className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
          aria-pressed={mode === 'signin'}
          onClick={() => setMode('signin')}
        >
          登录
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
          aria-pressed={mode === 'register'}
          onClick={() => setMode('register')}
        >
          注册
        </button>
      </div>

      {mode === 'signin' ? (
        <form action={signInSubmit} className={styles.form}>
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="邮箱"
            required
          />
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="口令"
            required
          />
          {signInState.error !== null && (
            <p className={styles.error} role="alert">
              {signInState.error}
            </p>
          )}
          <button className={styles.primaryButton} type="submit" disabled={pending}>
            {pending ? '正在进入…' : '进入'}
          </button>
        </form>
      ) : (
        <form action={registerSubmit} className={styles.form}>
          <input
            className={styles.input}
            name="code"
            autoComplete="off"
            placeholder="邀请码"
            required
          />
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="邮箱"
            required
          />
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="设置口令（至少 8 位）"
            minLength={8}
            required
          />
          {registerState.error !== null && (
            <p className={styles.error} role="alert">
              {registerState.error}
            </p>
          )}
          <button className={styles.primaryButton} type="submit" disabled={pending}>
            {pending ? '正在创建…' : '用邀请码注册'}
          </button>
        </form>
      )}

      <p className={styles.hint}>当前为邀请制，注册需要邀请码；邀请码不正确、重复使用或邮箱已注册都会明确说明。</p>

      <form action={signInAsDemoAction} className={styles.demo}>
        <button className={styles.secondaryButton} type="submit">
          先看看演示账号
        </button>
      </form>
      <p className={styles.hint}>演示账号里是按日期生成的假数据，随便点、随便改。</p>
    </main>
  )
}
