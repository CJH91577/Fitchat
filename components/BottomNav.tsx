'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

// 五项，日历居中
const ITEMS = [
  { href: '/', label: '今日' },
  { href: '/trends', label: '趋势' },
  { href: '/calendar', label: '日历' },
  { href: '/meals/new', label: '记录' },
  { href: '/me', label: '我的' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav} aria-label="主导航">
      {ITEMS.map((item) => {
        // 从属页面也应让所属项保持高亮，例如 /day/2026-09-22 归属首页
        const active =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
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
