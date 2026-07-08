import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: '사용자 편의 길 추천 - 햇빛 회피 경로',
  description: '강남구 역삼동에서 햇빛을 피하는 최적의 보행 경로를 추천합니다.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
