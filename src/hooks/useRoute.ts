import { useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { getTmapRoute } from '@/utils/tmapService'
import { saveRecentSearch } from '@/utils/recentSearches'
import type { Location, RouteType, RouteResponse } from '@/types/route'

export function useRoute() {
  const {
    startLocation,
    endLocation,
    selectedRoute,
    setIsLoading,
    setError,
    setOptimalRoute,
    setShadeRoute,
    setRecentSearches,
  } = useRouteStore()

  const fetchRoute = useCallback(
    async (routeType: RouteType) => {
      if (!startLocation || !endLocation) {
        setError('출발지와 도착지를 모두 선택해주세요.')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // 비교 표시를 위해 두 경로를 항상 병렬로 조회
        const [optimalResult, shadeResult] = await Promise.allSettled([
          getTmapRoute(
            startLocation.lat,
            startLocation.lng,
            endLocation.lat,
            endLocation.lng,
            'optimal'
          ),
          getTmapRoute(
            startLocation.lat,
            startLocation.lng,
            endLocation.lat,
            endLocation.lng,
            'shade'
          ),
        ])

        if (optimalResult.status === 'fulfilled') {
          setOptimalRoute(optimalResult.value)
        }
        if (shadeResult.status === 'fulfilled') {
          setShadeRoute(shadeResult.value)
        }

        // 사용자가 선택한 경로가 실패했으면 에러 표시
        const selected =
          routeType === 'optimal' ? optimalResult : shadeResult
        if (selected.status === 'rejected') {
          const reason = selected.reason
          throw reason instanceof Error
            ? reason
            : new Error('경로를 불러오는 중 오류가 발생했습니다.')
        }

        // 검색 성공 시 최근 기록에 저장
        setRecentSearches(saveRecentSearch(startLocation, endLocation))
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '경로를 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [startLocation, endLocation, setIsLoading, setError, setOptimalRoute, setShadeRoute, setRecentSearches]
  )

  const getSelectedRoute = useCallback((): RouteResponse | null => {
    const { optimalRoute: optimal, shadeRoute: shade } = useRouteStore.getState()
    return selectedRoute === 'optimal' ? optimal : shade
  }, [selectedRoute])

  return {
    fetchRoute,
    getSelectedRoute,
  }
}
