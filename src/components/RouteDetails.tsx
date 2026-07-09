'use client'

import { useRouteStore } from '@/store/routeStore'
import type { RouteResponse } from '@/types/route'

function SingleRouteInfo({
  route,
  label,
  color,
}: {
  route: RouteResponse
  label: string
  color: string
}) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold tracking-[-0.224px] mb-3" style={{ color }}>
        {label}
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] text-[#86868b] tracking-[-0.224px]">거리</span>
          <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
            {(route.distance / 1000).toFixed(1)} km
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] text-[#86868b] tracking-[-0.224px]">예상 시간</span>
          <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
            약 {Math.round(route.duration / 60)}분
          </span>
        </div>
      </div>
    </div>
  )
}

export function RouteDetails() {
  const { optimalRoute, shadeRoute, showOptimal, showShade, error } =
    useRouteStore()

  if (error) {
    return (
      <div className="bg-[#fff2f0] border border-[#f0c8c0] rounded-[18px] px-4 py-3">
        <p className="text-[14px] text-[#b64400] tracking-[-0.224px]">{error}</p>
      </div>
    )
  }

  const hasOptimal = showOptimal && optimalRoute !== null
  const hasShade = showShade && shadeRoute !== null

  if (!hasOptimal && !hasShade) {
    return (
      <p className="text-[14px] text-[#86868b] tracking-[-0.224px] text-center py-6">
        길 찾기를 누르면 경로 정보가 표시됩니다.
      </p>
    )
  }

  const shadeScore = shadeRoute?.shadeScore ?? 0

  return (
    <div className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 space-y-4">
      {/* 두 경로 모두 표시 중이면 비교표, 하나면 단일 정보 */}
      {hasOptimal && hasShade && optimalRoute && shadeRoute ? (
        <div>
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-3">
            경로 비교
          </h3>
          <table className="w-full text-[13px] tracking-[-0.2px]">
            <thead>
              <tr className="text-[#86868b]">
                <th className="text-left font-normal pb-1.5"></th>
                <th className="text-right font-semibold pb-1.5 text-[#1D4ED8]">
                  최적의 길
                </th>
                <th className="text-right font-semibold pb-1.5 text-[#059669]">
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
                <td className="text-right py-0.5">{shadeScore}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : hasOptimal && optimalRoute ? (
        <SingleRouteInfo route={optimalRoute} label="최적의 길" color="#1D4ED8" />
      ) : hasShade && shadeRoute ? (
        <SingleRouteInfo route={shadeRoute} label="햇빛 피하는 길" color="#059669" />
      ) : null}

      {/* 그늘 상세 (햇빛 회피 표시 중일 때) */}
      {hasShade && shadeRoute && (
        <div className="border-t border-[#f0f0f0] pt-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-3">
            햇빛 회피도
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#f0f0f0] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#059669] h-full transition-all duration-300"
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
              {shadeRoute.shadeDetail?.isNight
                ? '지금은 해가 진 시간이에요. 햇빛 걱정 없이 걸으세요.'
                : shadeScore >= 75
                  ? '매우 좋은 그늘길입니다.'
                  : shadeScore >= 50
                    ? '적절한 그늘길입니다.'
                    : '햇빛이 있는 구간이 있습니다.'}
            </p>
          </div>

          {shadeRoute.shadeDetail && !shadeRoute.shadeDetail.isNight && (
            <div className="mt-3 space-y-1.5">
              {shadeRoute.shadeDetail.via && (
                <p className="text-[12px] font-semibold text-[#059669] tracking-[-0.12px]">
                  {shadeRoute.shadeDetail.via}
                </p>
              )}
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>건물 그림자</span>
                <span>{shadeRoute.shadeDetail.buildingShadowRatio}%</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>공원 구간</span>
                <span>{shadeRoute.shadeDetail.parkRatio}%</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#86868b] tracking-[-0.12px]">
                <span>햇빛 노출</span>
                <span>{shadeRoute.shadeDetail.exposedRatio}%</span>
              </div>
              <p className="text-[10px] text-[#a1a1a6] tracking-[-0.08px] leading-[1.3] pt-1">
                현재 태양 고도 {shadeRoute.shadeDetail.sunAltitude}° 기준 · 건물
                그림자와 공원 데이터로 계산됨 · 차도 횡단은 횡단보도 기준
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
