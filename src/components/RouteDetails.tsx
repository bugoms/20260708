'use client'

import { useRouteStore } from '@/store/routeStore'

export function RouteDetails() {
  const { optimalRoute, shadeRoute, selectedRoute, error } = useRouteStore()

  const route = selectedRoute === 'optimal' ? optimalRoute : shadeRoute

  if (error) {
    return (
      <div className="bg-[#fff2f0] border border-[#f0c8c0] rounded-[18px] px-4 py-3">
        <p className="text-[14px] text-[#b64400] tracking-[-0.224px]">
          {error}
        </p>
      </div>
    )
  }

  if (!route) {
    return (
      <p className="text-[14px] text-[#86868b] tracking-[-0.224px] text-center py-6">
        경로를 검색하면 상세 정보가 표시됩니다.
      </p>
    )
  }

  const distanceKm = (route.distance / 1000).toFixed(1)
  const durationMin = Math.round(route.duration / 60)
  const shadeScore = route.shadeScore || 0
  const hasBoth = optimalRoute !== null && shadeRoute !== null

  return (
    <div className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-3">
          경로 정보
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[14px] text-[#86868b] tracking-[-0.224px]">
              거리
            </span>
            <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
              {distanceKm} km
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[14px] text-[#86868b] tracking-[-0.224px]">
              예상 시간
            </span>
            <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
              약 {durationMin}분
            </span>
          </div>
        </div>
      </div>

      {hasBoth && optimalRoute && shadeRoute && (
        <div className="border-t border-[#f0f0f0] pt-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-3">
            경로 비교
          </h3>
          <table className="w-full text-[13px] tracking-[-0.2px]">
            <thead>
              <tr className="text-[#86868b]">
                <th className="text-left font-normal pb-1.5"></th>
                <th
                  className={`text-right font-normal pb-1.5 ${
                    selectedRoute === 'optimal'
                      ? 'text-[#0066cc] font-semibold'
                      : ''
                  }`}
                >
                  최적의 길
                </th>
                <th
                  className={`text-right font-normal pb-1.5 ${
                    selectedRoute === 'shade'
                      ? 'text-[#0066cc] font-semibold'
                      : ''
                  }`}
                >
                  햇빛 회피
                </th>
              </tr>
            </thead>
            <tbody className="text-[#1d1d1f]">
              <tr>
                <td className="text-[#86868b] py-0.5">거리</td>
                <td className="text-right py-0.5">
                  {(optimalRoute.distance / 1000).toFixed(1)} km
                </td>
                <td className="text-right py-0.5">
                  {(shadeRoute.distance / 1000).toFixed(1)} km
                </td>
              </tr>
              <tr>
                <td className="text-[#86868b] py-0.5">시간</td>
                <td className="text-right py-0.5">
                  {Math.round(optimalRoute.duration / 60)}분
                </td>
                <td className="text-right py-0.5">
                  {Math.round(shadeRoute.duration / 60)}분
                </td>
              </tr>
              <tr>
                <td className="text-[#86868b] py-0.5">그늘</td>
                <td className="text-right py-0.5 text-[#86868b]">-</td>
                <td className="text-right py-0.5">
                  {shadeRoute.shadeScore ?? 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selectedRoute === 'shade' && (
        <div className="border-t border-[#f0f0f0] pt-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-3">
            햇빛 회피도
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#f0f0f0] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#0066cc] h-full transition-all duration-300"
                  style={{ width: `${shadeScore}%` }}
                  role="progressbar"
                  aria-valuenow={shadeScore}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
              <span className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] min-w-10 text-right">
                {shadeScore}%
              </span>
            </div>
            <p className="text-[12px] text-[#86868b] tracking-[-0.12px]">
              {route.shadeDetail?.isNight
                ? '지금은 해가 진 시간이에요. 햇빛 걱정 없이 걸으세요.'
                : shadeScore >= 75
                  ? '매우 좋은 그늘길입니다.'
                  : shadeScore >= 50
                    ? '적절한 그늘길입니다.'
                    : '햇빛이 있는 구간이 있습니다.'}
            </p>
          </div>

          {route.shadeDetail && !route.shadeDetail.isNight && (
            <div className="mt-3 space-y-1.5">
              {route.shadeDetail.via && (
                <p className="text-[12px] font-semibold text-[#0066cc] tracking-[-0.12px]">
                  {route.shadeDetail.via}
                </p>
              )}
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>건물 그림자</span>
                <span>{route.shadeDetail.buildingShadowRatio}%</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>공원 구간</span>
                <span>{route.shadeDetail.parkRatio}%</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>햇빛 노출</span>
                <span>{route.shadeDetail.exposedRatio}%</span>
              </div>
              <p className="text-[10px] text-[#a1a1a6] tracking-[-0.08px] leading-[1.3] pt-1">
                현재 태양 고도 {route.shadeDetail.sunAltitude}° 기준 · 건물
                그림자와 공원 데이터로 계산됨 · 차도 횡단은 횡단보도 기준
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
