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
        className="absolute inset-0 bg-black/30"
        onClick={() => setAreaAlert(null)}
      ></div>
      <div className="relative w-full max-w-[320px] bg-white rounded-[18px] border border-[#e0e0e0] p-6 text-center">
        <p className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px] mb-2">
          서비스 구역 밖이에요
        </p>
        <p className="text-[14px] text-[#86868b] tracking-[-0.224px] leading-[1.43] mb-5">
          {areaAlert}
        </p>
        <button
          onClick={() => setAreaAlert(null)}
          className="w-full h-[44px] bg-[#0066cc] text-white text-[15px] font-semibold tracking-[-0.2px] rounded-full active:scale-95 transition"
        >
          확인
        </button>
      </div>
    </div>,
    document.body
  )
}
