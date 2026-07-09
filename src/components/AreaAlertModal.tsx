'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouteStore } from '@/store/routeStore'

/**
 * 서비스 구역 이탈 경고창.
 * backdrop-filter가 있는 패널 내부에서는 fixed 포지셔닝이 깨지므로
 * portal로 document.body에 직접 렌더링한다.
 */
export function AreaAlertModal() {
  const { areaAlert, setAreaAlert } = useRouteStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ESC로 닫기
  useEffect(() => {
    if (!areaAlert) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAreaAlert(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [areaAlert, setAreaAlert])

  if (!mounted || !areaAlert) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label="서비스 구역 안내"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={() => setAreaAlert(null)}
      ></div>
      <div className="relative w-full max-w-[300px] bg-white rounded-[18px] p-6 pt-7 text-center shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
        <p
          className="text-[17px] text-[#1d1d1f] tracking-[-0.374px] leading-[1.24] mb-2"
          style={{ fontWeight: 600 }}
        >
          서비스 구역 밖이에요
        </p>
        <p className="text-[14px] text-[#86868b] tracking-[-0.224px] leading-[1.43] mb-6">
          {areaAlert}
        </p>
        <button
          onClick={() => setAreaAlert(null)}
          className="w-full h-[44px] bg-[#0066cc] text-white text-[15px] tracking-[-0.2px] rounded-full active:scale-95 transition"
          style={{ fontWeight: 600 }}
        >
          확인
        </button>
      </div>
    </div>,
    document.body
  )
}
