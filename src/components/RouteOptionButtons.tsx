'use client'

import { useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { useRoute } from '@/hooks/useRoute'

export function RouteOptionButtons() {
  const { selectedRoute, setSelectedRoute, isLoading } = useRouteStore()
  const { fetchRoute } = useRoute()

  const handleOptimalClick = useCallback(async () => {
    setSelectedRoute('optimal')
    await fetchRoute('optimal')
  }, [setSelectedRoute, fetchRoute])

  const handleShadeClick = useCallback(async () => {
    setSelectedRoute('shade')
    await fetchRoute('shade')
  }, [setSelectedRoute, fetchRoute])

  const pillBase =
    'h-[44px] px-4 rounded-full text-[15px] tracking-[-0.2px] transition active:scale-95 disabled:active:scale-100'

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={handleOptimalClick}
        disabled={isLoading}
        className={`${pillBase} ${
          selectedRoute === 'optimal'
            ? 'bg-[#0066cc] text-white font-semibold'
            : 'bg-white text-[#0066cc] border border-[#0066cc]'
        }`}
        aria-label="최적의 길 추천"
        aria-pressed={selectedRoute === 'optimal'}
      >
        최적의 길
      </button>

      <button
        onClick={handleShadeClick}
        disabled={isLoading}
        className={`${pillBase} ${
          selectedRoute === 'shade'
            ? 'bg-[#0066cc] text-white font-semibold'
            : 'bg-white text-[#0066cc] border border-[#0066cc]'
        }`}
        aria-label="햇빛을 피하는 길 추천"
        aria-pressed={selectedRoute === 'shade'}
      >
        햇빛 피하는 길
      </button>
    </div>
  )
}
