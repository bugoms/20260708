import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
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
  const tmapApiKey = process.env.NEXT_PUBLIC_TMAP_API_KEY

  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#ffffff" />
        {tmapApiKey && (
          <Script
            src={`https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${tmapApiKey}`}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
