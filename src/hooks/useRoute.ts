import { useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { getTmapRoute } from '@/utils/tmapService'
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
        const route = await getTmapRoute(
          startLocation.lat,
          startLocation.lng,
          endLocation.lat,
          endLocation.lng,
          routeType
        )

        if (routeType === 'optimal') {
          setOptimalRoute(route)
        } else {
          setShadeRoute(route)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '경로를 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [startLocation, endLocation, setIsLoading, setError, setOptimalRoute, setShadeRoute]
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
