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

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={handleOptimalClick}
        disabled={isLoading}
        className={`py-3 px-4 rounded-lg font-semibold transition-all ${
          selectedRoute === 'optimal'
            ? 'bg-blue-500 text-white shadow-lg'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="최적의 길 추천"
        aria-pressed={selectedRoute === 'optimal'}
      >
        최적의 길
      </button>

      <button
        onClick={handleShadeClick}
        disabled={isLoading}
        className={`py-3 px-4 rounded-lg font-semibold transition-all ${
          selectedRoute === 'shade'
            ? 'bg-green-500 text-white shadow-lg'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="햇빛을 피하는 길 추천"
        aria-pressed={selectedRoute === 'shade'}
      >
        햇빛 피하는 길
      </button>
    </div>
  )
}
