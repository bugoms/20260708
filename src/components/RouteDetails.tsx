'use client'

import { useRouteStore } from '@/store/routeStore'

export function RouteDetails() {
  const { optimalRoute, shadeRoute, selectedRoute, error } = useRouteStore()

  const route = selectedRoute === 'optimal' ? optimalRoute : shadeRoute

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          경로를 선택하면 상세 정보가 표시됩니다
        </p>
      </div>
    )
  }

  const distanceKm = (route.distance / 1000).toFixed(1)
  const durationMin = Math.round(route.duration / 60)
  const shadeScore = route.shadeScore || 0

  return (
    <div className="space-y-4 py-4 border-t border-gray-200 dark:border-gray-700">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          경로 정보
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">거리</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {distanceKm} km
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">예상 시간</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              약 {durationMin}분
            </span>
          </div>
        </div>
      </div>

      {selectedRoute === 'shade' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            햇빛 회피도
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-300"
                  style={{ width: `${shadeScore}%` }}
                  role="progressbar"
                  aria-valuenow={shadeScore}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-12 text-right">
                {shadeScore}%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {shadeScore >= 75
                ? '매우 좋은 그늘길입니다'
                : shadeScore >= 50
                  ? '적절한 그늘길입니다'
                  : '햇빛이 있는 구간이 있습니다'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
