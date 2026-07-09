import { useCallback, useRef } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { getTmapRoute } from '@/utils/tmapService'
import { saveRecentSearch } from '@/utils/recentSearches'

export function useRoute() {
  const {
    startLocation,
    endLocation,
    setIsLoading,
    setError,
    setOptimalRoute,
    setShadeRoute,
    setRecentSearches,
  } = useRouteStore()

  // 요청 순번 - 길 찾기 연타 시 늦게 도착한 이전 응답이
  // 최신 결과를 덮어쓰지 않도록 최신 요청만 반영한다
  const requestSeq = useRef(0)

  /** 길 찾기: 최적/그늘 경로를 병렬로 모두 조회 */
  const fetchRoutes = useCallback(async () => {
    if (!startLocation || !endLocation) {
      setError('출발지와 도착지를 모두 선택해주세요.')
      return
    }

    const seq = ++requestSeq.current
    setIsLoading(true)
    setError(null)

    try {
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

      if (seq !== requestSeq.current) return // 더 새로운 요청이 진행 중

      if (optimalResult.status === 'fulfilled') {
        setOptimalRoute(optimalResult.value)
      }
      if (shadeResult.status === 'fulfilled') {
        setShadeRoute(shadeResult.value)
      }

      // 둘 다 실패했을 때만 에러 표시 (하나라도 성공하면 그건 보여줌)
      if (
        optimalResult.status === 'rejected' &&
        shadeResult.status === 'rejected'
      ) {
        const reason = optimalResult.reason
        throw reason instanceof Error
          ? reason
          : new Error('경로를 불러오는 중 오류가 발생했습니다.')
      }

      // 검색 성공 시 최근 기록에 저장
      setRecentSearches(saveRecentSearch(startLocation, endLocation))
    } catch (error: unknown) {
      if (seq !== requestSeq.current) return
      const message =
        error instanceof Error
          ? error.message
          : '경로를 불러오는 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      if (seq === requestSeq.current) setIsLoading(false)
    }
  }, [
    startLocation,
    endLocation,
    setIsLoading,
    setError,
    setOptimalRoute,
    setShadeRoute,
    setRecentSearches,
  ])

  return { fetchRoutes }
}
