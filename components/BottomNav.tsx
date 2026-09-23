'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

const ITEMS = [
  { href: '/', label: '今日' },
  { href: '/trends', label: '趋势' },
  { href: '/meals/new', label: '记录', primary: true },
  { href: '/me', label: '我的' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav} aria-label="主导航">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.item, active && styles.active, item.primary && styles.primary]
              .filter(Boolean)
              .join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
