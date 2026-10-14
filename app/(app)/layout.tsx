import BottomNav from '@/components/BottomNav'
import { requireUser } from '@/lib/auth/current-user'

/**
 * 已登录区域的外壳。
 *
 * 路由分组 `(app)` 不改变 URL（`app/(app)/trends/page.tsx` 仍然是 `/trends`），
 * 它把两件共同的事收进一处：底栏，以及「登录后才进得来」。
 *
 * `/login` 因此天然落在分组外面——登录页不显示底栏（那时点哪个标签都会被弹回
 * 登录页，纯属干扰），也不受这里的守卫影响。
 *
 * 这里再调一次 requireUser 是**兜底**，不是主力：每个数据页自己第一行也会调
 *（见 lib/auth/current-user.ts 里的说明），因为「新页面忘了加守卫」的后果是
 * 数据泄漏，不该只靠一层容易忘的外壳兜着。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
