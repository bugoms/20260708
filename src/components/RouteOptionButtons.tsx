'use client'

import { useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { useRoute } from '@/hooks/useRoute'
import { gaEvent } from '@/utils/analytics'

export function RouteOptionButtons() {
  const {
    showOptimal,
    showShade,
    toggleRoute,
    isLoading,
    optimalRoute,
    shadeRoute,
  } = useRouteStore()
  const { fetchRoutes } = useRoute()

  // 길 찾기를 실행해 경로가 로드된 뒤에야 토글 가능
  // (출발/도착이 바뀌면 store가 경로를 비우므로 자동으로 다시 disabled)
  const chipsEnabled = optimalRoute !== null || shadeRoute !== null

  const handleFindRoute = useCallback(async () => {
    const { startLocation, endLocation, showOptimal, showShade } =
      useRouteStore.getState()

    // 핵심 측정 지표: 햇빛 피하는 길이 켜진 상태의 길 찾기
    if (showShade) {
      gaEvent('shade_route_click', {
        start_name: startLocation?.name ?? '(미선택)',
        end_name: endLocation?.name ?? '(미선택)',
        both_selected: Boolean(startLocation && endLocation),
      })
    }
    if (showOptimal) {
      gaEvent('optimal_route_click', {
        start_name: startLocation?.name ?? '(미선택)',
        end_name: endLocation?.name ?? '(미선택)',
      })
    }

    await fetchRoutes()

    // 결과 지표: 그늘 경로가 조회됐을 때 점수/거리 기록
    const { shadeRoute } = useRouteStore.getState()
    if (showShade && shadeRoute) {
      gaEvent('shade_route_result', {
        shade_score: shadeRoute.shadeScore ?? 0,
        distance_m: shadeRoute.distance,
        duration_min: Math.round(shadeRoute.duration / 60),
        is_night: shadeRoute.shadeDetail?.isNight ?? false,
        via: shadeRoute.shadeDetail?.via ?? '(없음)',
      })
    }
  }, [fetchRoutes])

  const chipBase =
    'h-[40px] px-3 rounded-full text-[14px] tracking-[-0.2px] transition active:scale-95 border'

  return (
    <div className="space-y-3">
      {/* 경로 유형 토글 - 둘 다 켤 수 있음, 최소 1개는 항상 활성 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleRoute('optimal')}
          disabled={!chipsEnabled}
          className={`${chipBase} ${
            !chipsEnabled
              ? 'bg-white text-[#a1a1a6] border-black/[0.08]'
              : showOptimal
                ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] font-semibold'
                : 'bg-white text-[#1d1d1f] border-black/[0.08]'
          }`}
          aria-pressed={showOptimal}
          aria-label="최적의 길 표시 토글"
        >
          최적의 길
        </button>

        <button
          onClick={() => toggleRoute('shade')}
          disabled={!chipsEnabled}
          className={`${chipBase} ${
            !chipsEnabled
              ? 'bg-white text-[#a1a1a6] border-black/[0.08]'
              : showShade
                ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] font-semibold'
                : 'bg-white text-[#1d1d1f] border-black/[0.08]'
          }`}
          aria-pressed={showShade}
          aria-label="햇빛 피하는 길 표시 토글"
        >
          햇빛 피하는 길
        </button>
      </div>

      {/* 길 찾기 실행 버튼 */}
      <button
        onClick={handleFindRoute}
        disabled={isLoading}
        className="w-full h-[44px] bg-[#0066cc] text-white text-[15px] tracking-[-0.2px] rounded-full transition active:scale-95 disabled:active:scale-100"
        style={{ fontWeight: 600 }}
        aria-label="길 찾기"
      >
        {isLoading ? '경로 찾는 중...' : '길 찾기'}
      </button>

      <p className="text-[11px] text-[#86868b] tracking-[-0.12px]">
        경로 색상: <span className="text-[#1D4ED8]">파랑=최적</span> ·{' '}
        <span className="text-[#059669]">초록=햇빛 회피</span>
      </p>
    </div>
  )
}
