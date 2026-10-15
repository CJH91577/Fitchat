import type { Metadata } from 'next'
import BottomNav from '@/components/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fitchat',
  description: '饮食与健身管理',
  // 图标放在 public/ 里、由 metadata 显式引用。
  // Next 也支持 app/icon.svg 的约定式写法，但那样 public/ 会变成空目录——
  // 而空目录不进 git，Dockerfile 里的 `COPY public` 就会构建失败。
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
