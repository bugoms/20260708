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
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {tmapApiKey && (
          /* jsv2 로더는 document.write로 실제 SDK를 로드하는데, next/script(비동기)
             환경에서는 document.write가 브라우저에 의해 무시되어 지도가 영원히 안 뜸.
             -> 로더를 건너뛰고 실제 SDK(tmapjs2.min.js)를 직접 로드.
             SDK는 script 태그 src의 appKey= 쿼리에서 앱 키를 파싱함. */
          <Script
            src={`https://topopentile1.tmap.co.kr/scriptSDKV2/tmapjs2.min.js?version=20231206&appKey=${tmapApiKey}`}
            strategy="afterInteractive"
          />
        )}
        {/* Google Analytics (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4SHSGQ9XTM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4SHSGQ9XTM');
          `}
        </Script>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
