'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

// 五项，日历居中
const ITEMS = [
  { href: '/', label: '今日' },
  { href: '/trends', label: '趋势' },
  // 某日详情只能从日历进入，因此归为日历的下级
  { href: '/calendar', label: '日历', alsoUnder: ['/day/'] },
  { href: '/meals/new', label: '记录' },
  { href: '/me', label: '我的' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav} aria-label="主导航">
      {ITEMS.map((item) => {
        const underOwnPath = item.href !== '/' && pathname.startsWith(`${item.href}/`)
        const active =
          pathname === item.href ||
          underOwnPath ||
          (item.alsoUnder?.some((prefix) => pathname.startsWith(prefix)) ?? false)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
