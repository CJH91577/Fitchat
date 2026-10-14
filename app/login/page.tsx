import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import LoginForm from './LoginForm'

/**
 * 登录页。
 *
 * 它是**唯一**不需要登录就能看的页面，所以留在路由分组 (app) 外面——
 * 分组里那层外壳带底栏、带守卫，两者对登录页都不成立。
 *
 * 已经登录的人再进来会被送回首页：否则他会看到一个「进入」按钮，而点下去
 * 其实是再建一个会话，既没用又让人困惑。
 */
export const dynamic = 'force-dynamic'

export default async function Login() {
  if ((await getCurrentUser()) !== null) redirect('/')

  return <LoginForm />
}
