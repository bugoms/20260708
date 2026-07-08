// 햇빛 회피(그늘) 경로 API
//
// 동작 원리:
// 1. T-Map 보행자 API로 후보 경로 여러 개 생성
//    - 기본 후보: 추천(0) / 최단(10) / 최단+계단제외(30)
//    - 공원 경유 후보: 출발-도착 사이 우회가 크지 않은 공원을 경유지(passList)로 강제
//      (T-Map 보행자 네트워크는 골목길/공원 산책로/횡단보도를 포함하므로
//       경유지를 넣으면 경로선이 자연스럽게 그 구간을 지나간다)
// 2. OSM(Overpass)에서 일대 건물(높이 포함)/공원 데이터 로드
// 3. 각 후보를 "현재 시각 태양 위치 + 건물 그림자 + 공원" 기준으로 그늘 점수화
// 4. 과도한 우회(최단 대비 1.8배 초과) 제외 후 최고 점수 경로 선택

import type { RouteRequest, RouteResponse } from '@/types/route'
import { fetchAreaData, type AreaData, type Park } from '@/utils/overpass'
import { scoreRoute, type ShadeBreakdown } from '@/utils/shadeScoring'
import { distanceMeters, bboxWithMargin, type Point } from '@/utils/geo'

export const maxDuration = 30 // Overpass + T-Map 다중 호출 대비

interface Candidate {
  label: string
  via?: string
  route: RawRoute
}

interface RawRoute {
  path: Array<[number, number]>
  distance: number
  duration: number
}

const MAX_DETOUR_RATIO = 1.8 // 최단 경로 대비 허용 우회 배율
const MAX_PARK_DETOUR = 1.6 // 공원 경유 후보로 삼을 최대 우회 배율(직선거리 기준)

async function callTmap(
  apiKey: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  searchOption: number,
  passList?: string
): Promise<RawRoute> {
  const body: Record<string, unknown> = {
    startX: startLng,
    startY: startLat,
    endX: endLng,
    endY: endLat,
    startName: encodeURIComponent('출발'),
    endName: encodeURIComponent('도착'),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption,
  }
  if (passList) body.passList = passList

  const response = await fetch(
    'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appKey: apiKey,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    throw new Error(`T-Map API error: ${response.statusText}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  const features =
    (data.features as Array<{
      geometry?: { type?: string; coordinates?: unknown }
      properties?: Record<string, unknown>
    }>) || []

  if (features.length === 0) {
    throw new Error('No route found')
  }

  const summary = features[0].properties || {}
  const distance = (summary.totalDistance as number) || 0
  const duration = (summary.totalTime as number) || 0

  const path: Array<[number, number]> = []
  for (const feature of features) {
    if (feature.geometry?.type === 'LineString') {
      path.push(...(feature.geometry.coordinates as Array<[number, number]>))
    }
  }

  return { path, distance, duration }
}

/** 출발-도착 코리도 근처에서 우회가 크지 않은 공원 선정 (최대 2개) */
function pickNearbyParks(start: Point, end: Point, parks: Park[]): Park[] {
  const directDist = distanceMeters(start, end)
  if (directDist < 200) return [] // 너무 짧은 경로는 경유 무의미

  return parks
    .map((park) => {
      const viaDist =
        distanceMeters(start, park.center) + distanceMeters(park.center, end)
      return { park, detour: viaDist / directDist }
    })
    .filter((p) => p.detour <= MAX_PARK_DETOUR)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 2)
    .map((p) => p.park)
}

export async function POST(request: Request) {
  try {
    const body: RouteRequest = await request.json()
    const { startLat, startLng, endLat, endLng } = body

    if (!startLat || !startLng || !endLat || !endLng) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const apiKey =
      process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: 'T-Map API key is not configured' },
        { status: 500 }
      )
    }

    const start: Point = { lat: startLat, lng: startLng }
    const end: Point = { lat: endLat, lng: endLng }

    // OSM 데이터와 기본 후보 경로를 병렬로 로드
    const bbox = bboxWithMargin([start, end], 400)
    const [areaResult, ...baseResults] = await Promise.allSettled([
      fetchAreaData(bbox),
      callTmap(apiKey, startLat, startLng, endLat, endLng, 0),
      callTmap(apiKey, startLat, startLng, endLat, endLng, 10),
      callTmap(apiKey, startLat, startLng, endLat, endLng, 30),
    ])

    const candidates: Candidate[] = []
    const baseLabels = ['추천 경로', '최단 경로', '계단 제외 경로']
    baseResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        candidates.push({ label: baseLabels[i], route: result.value })
      }
    })

    if (candidates.length === 0) {
      throw new Error('경로를 찾을 수 없습니다')
    }

    // OSM 데이터 로드 실패 시: 그늘 계산 불가 -> 추천 경로 + 점수 없음으로 폴백
    if (areaResult.status === 'rejected') {
      const fallback = candidates[0].route
      const response: RouteResponse = {
        ...fallback,
        shadeDetail: {
          buildingShadowRatio: 0,
          parkRatio: 0,
          exposedRatio: 0,
          sunAltitude: 0,
          isNight: false,
          via: '그늘 데이터 일시 사용 불가 (기본 경로 표시)',
        },
      }
      return Response.json(response, { status: 200 })
    }

    const area: AreaData = areaResult.value

    // 공원 경유 후보 추가
    const nearbyParks = pickNearbyParks(start, end, area.parks)
    const parkResults = await Promise.allSettled(
      nearbyParks.map((park) =>
        callTmap(
          apiKey,
          startLat,
          startLng,
          endLat,
          endLng,
          0,
          `${park.center.lng},${park.center.lat}`
        )
      )
    )
    parkResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        candidates.push({
          label: `${nearbyParks[i].name} 경유`,
          via: `${nearbyParks[i].name} 경유`,
          route: result.value,
        })
      }
    })

    // 모든 후보 그늘 점수화 (departureTime 지정 시 해당 시각 기준)
    const now = body.departureTime ? new Date(body.departureTime) : new Date()
    const scored = candidates.map((candidate) => ({
      ...candidate,
      breakdown: scoreRoute(candidate.route.path, area, now),
    }))

    // 과도한 우회 제외 (전체 후보 중 최단 거리 기준)
    const minDistance = Math.min(...scored.map((c) => c.route.distance))
    const eligible = scored.filter(
      (c) => c.route.distance <= minDistance * MAX_DETOUR_RATIO
    )

    // 그늘 점수 최고 경로 선택 (동점이면 짧은 경로)
    const best = eligible.reduce((a, b) => {
      if (b.breakdown.score > a.breakdown.score) return b
      if (b.breakdown.score === a.breakdown.score &&
          b.route.distance < a.route.distance) return b
      return a
    })

    const breakdown: ShadeBreakdown = best.breakdown
    const response: RouteResponse = {
      path: best.route.path,
      distance: best.route.distance,
      duration: best.route.duration,
      shadeScore: breakdown.score,
      shadeDetail: {
        buildingShadowRatio: breakdown.buildingShadowRatio,
        parkRatio: breakdown.parkRatio,
        exposedRatio: breakdown.exposedRatio,
        sunAltitude: breakdown.sunAltitude,
        isNight: breakdown.isNight,
        via: best.via,
      },
    }

    return Response.json(response, {
      status: 200,
      headers: {
        // 태양 위치가 시간에 따라 변하므로 짧게 캐시
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
