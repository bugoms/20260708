'use client'

import { useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { useRoute } from '@/hooks/useRoute'
import { gaEvent } from '@/utils/analytics'

export function RouteOptionButtons() {
  const { selectedRoute, setSelectedRoute, isLoading } = useRouteStore()
  const { fetchRoute } = useRoute()

  const handleOptimalClick = useCallback(async () => {
    const { startLocation, endLocation } = useRouteStore.getState()
    // 비교 지표용 (핵심 지표는 shade_route_click)
    gaEvent('optimal_route_click', {
      start_name: startLocation?.name ?? '(미선택)',
      end_name: endLocation?.name ?? '(미선택)',
    })

    setSelectedRoute('optimal')
    await fetchRoute('optimal')
  }, [setSelectedRoute, fetchRoute])

  const handleShadeClick = useCallback(async () => {
    const { startLocation, endLocation } = useRouteStore.getState()
    // 핵심 측정 지표: 햇빛 피하는 길 버튼 클릭
    gaEvent('shade_route_click', {
      start_name: startLocation?.name ?? '(미선택)',
      end_name: endLocation?.name ?? '(미선택)',
      both_selected: Boolean(startLocation && endLocation),
    })

    setSelectedRoute('shade')
    await fetchRoute('shade')

    // 결과 지표: 실제로 그늘 경로가 나왔을 때 점수/거리 기록
    const { shadeRoute } = useRouteStore.getState()
    if (shadeRoute) {
      gaEvent('shade_route_result', {
        shade_score: shadeRoute.shadeScore ?? 0,
        distance_m: shadeRoute.distance,
        duration_min: Math.round(shadeRoute.duration / 60),
        is_night: shadeRoute.shadeDetail?.isNight ?? false,
        via: shadeRoute.shadeDetail?.via ?? '(없음)',
      })
    }
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
