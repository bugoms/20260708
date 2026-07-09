// 햇빛 회피(그늘) 경로 API — 하이브리드 방식
//
// 1순위: OSM 보행 네트워크(골목/공원 산책로 포함) 위에서 그늘 가중 A* 직접 탐색
//   - 엣지 비용 = 길이 x (1 - 그늘가중 x 그늘계수) x 최적길회피 페널티
//   - T-Map엔 없는 공원 내부 산책로/골목을 실제로 통과할 수 있음
//   - 최적길(T-Map 추천)과 겹치는 구간에 페널티 -> 두 경로가 항상 달라짐
// 2순위(폴백): T-Map 후보 경로(추천/최단/계단제외/공원경유) 그늘 점수 재랭킹
//
// 그늘 판정 근거: 현재 시각 태양 고도/방위각 + OSM 건물(높이) 그림자 + 공원

import type { RouteRequest, RouteResponse } from '@/types/route'
import {
  fetchWalkData,
  type AreaData,
  type WalkData,
  type Park,
} from '@/utils/overpass'
import { scoreRoute } from '@/utils/shadeScoring'
import { routeWithShade, pathSimilarity } from '@/utils/osmRouter'
import { undergroundNetworksOnPath } from '@/utils/underground'
import {
  distanceMeters,
  bboxWithMargin,
  samplePath,
  pointInPolygon,
  type Point,
} from '@/utils/geo'

export const maxDuration = 30

interface RawRoute {
  path: Array<[number, number]>
  distance: number
  duration: number
}

const MAX_DETOUR_RATIO = 2.2 // 최적길 대비 그늘길 최대 허용 배율
const MAX_DETOUR_NO_OPTIMAL = 3.0 // 최적길 없을 때 직선거리 대비 허용 배율
const SIMILARITY_LIMIT = 0.75 // 최적길과 이 이상 겹치면 회피 강화 재탐색
const MAX_PARK_DETOUR = 1.6
// 출발 시각을 10분 단위로 양자화 - 몇 초 간격의 재요청에서 태양 위치가
// 미세하게 달라져 경로가 흔들리는 것을 방지 (HTTP 캐시 적중률도 상승)
const TIME_BUCKET_MS = 10 * 60 * 1000

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
      headers: { 'Content-Type': 'application/json', appKey: apiKey },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) throw new Error(`T-Map API error: ${response.statusText}`)

  const data = (await response.json()) as Record<string, unknown>
  const features =
    (data.features as Array<{
      geometry?: { type?: string; coordinates?: unknown }
      properties?: Record<string, unknown>
    }>) || []
  if (features.length === 0) throw new Error('No route found')

  const summary = features[0].properties || {}
  const path: Array<[number, number]> = []
  for (const feature of features) {
    if (feature.geometry?.type === 'LineString') {
      path.push(...(feature.geometry.coordinates as Array<[number, number]>))
    }
  }

  return {
    path,
    distance: (summary.totalDistance as number) || 0,
    duration: (summary.totalTime as number) || 0,
  }
}

/** 경로가 통과하는 공원 이름 목록 */
function parksOnPath(path: Array<[number, number]>, parks: Park[]): string[] {
  const samples = samplePath(path, 25)
  const names = new Set<string>()
  for (const park of parks) {
    if (samples.some((p) => pointInPolygon(p, park.polygon))) {
      names.add(park.name)
    }
  }
  return [...names]
}

/** 폴백: T-Map 후보 경로들을 그늘 점수로 재랭킹 */
async function fallbackCandidateRoute(
  apiKey: string,
  start: Point,
  end: Point,
  area: AreaData,
  optimalPath: Array<[number, number]> | null,
  now: Date
): Promise<{ route: RawRoute; via?: string } | null> {
  const candidates: Array<{ route: RawRoute; via?: string }> = []

  const baseOptions = [10, 30] // 최단, 계단제외 (추천 0은 최적길과 동일하므로 제외)
  const nearbyParks = area.parks
    .map((park) => {
      const direct = distanceMeters(start, end)
      const via =
        distanceMeters(start, park.center) + distanceMeters(park.center, end)
      return { park, detour: direct > 0 ? via / direct : Infinity }
    })
    .filter((p) => p.detour <= MAX_PARK_DETOUR)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 2)

  const results = await Promise.allSettled([
    ...baseOptions.map((opt) =>
      callTmap(apiKey, start.lat, start.lng, end.lat, end.lng, opt)
    ),
    ...nearbyParks.map((p) =>
      callTmap(
        apiKey,
        start.lat,
        start.lng,
        end.lat,
        end.lng,
        0,
        `${p.park.center.lng},${p.park.center.lat}`
      )
    ),
  ])

  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') return
    const via =
      i >= baseOptions.length
        ? `${nearbyParks[i - baseOptions.length].park.name} 경유`
        : undefined
    candidates.push({ route: result.value, via })
  })

  if (candidates.length === 0) return null

  const scored = candidates.map((c) => ({
    ...c,
    breakdown: scoreRoute(c.route.path, area, now),
    similarity: optimalPath ? pathSimilarity(c.route.path, optimalPath) : 0,
  }))

  // 최적길과 다른 경로 우선, 그중 그늘 점수 최고
  scored.sort((a, b) => {
    const aDiff = a.similarity < 0.9 ? 0 : 1
    const bDiff = b.similarity < 0.9 ? 0 : 1
    if (aDiff !== bDiff) return aDiff - bDiff
    return b.breakdown.score - a.breakdown.score
  })

  return scored[0]
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
    const rawTime = body.departureTime ?? Date.now()
    const now = new Date(Math.floor(rawTime / TIME_BUCKET_MS) * TIME_BUCKET_MS)

    // 최적길(T-Map 추천)과 OSM 보행 데이터를 병렬 로드
    const bbox = bboxWithMargin([start, end], 400)
    const [optimalResult, walkResult] = await Promise.allSettled([
      callTmap(apiKey, startLat, startLng, endLat, endLng, 0),
      fetchWalkData(bbox),
    ])

    const optimal =
      optimalResult.status === 'fulfilled' ? optimalResult.value : null

    // ---------- 1순위: OSM 그늘 가중 라우팅 ----------
    // 최적길(T-Map)이 일시 실패해도 OSM 라우터로 그늘 경로는 항상 같은
    // 방식으로 생성 -> 요청마다 경로 스타일이 바뀌는 문제 방지
    if (walkResult.status === 'fulfilled') {
      const walk: WalkData = walkResult.value

      const detourBudget = optimal
        ? optimal.distance * MAX_DETOUR_RATIO
        : distanceMeters(start, end) * MAX_DETOUR_NO_OPTIMAL

      let osmRoute = routeWithShade(
        walk,
        start,
        end,
        now,
        optimal?.path ?? [],
        optimal ? 1.4 : 1.0
      )

      // 최적길과 너무 비슷하면 회피 강화 후 재탐색.
      // 단, 재탐색 결과가 우회 예산 안이면서 실제로 덜 겹칠 때만 채택
      // (예산 초과 결과를 무조건 채택하면 OSM 경로 전체가 버려져
      //  T-Map 폴백으로 떨어지고, 경로 모양이 요청마다 크게 흔들린다)
      if (osmRoute && optimal) {
        const similarity = pathSimilarity(osmRoute.path, optimal.path)
        if (similarity > SIMILARITY_LIMIT) {
          const retried = routeWithShade(walk, start, end, now, optimal.path, 2.5)
          if (
            retried &&
            retried.distance <= detourBudget &&
            pathSimilarity(retried.path, optimal.path) < similarity - 0.1
          ) {
            osmRoute = retried
          }
        }
      }

      // 우회가 과하지 않은 경우에만 채택
      if (osmRoute && osmRoute.distance <= detourBudget) {
        const breakdown = scoreRoute(osmRoute.path, walk, now)
        const crossedParks = parksOnPath(osmRoute.path, walk.parks)
        const namedParks = crossedParks.filter((n) => n !== '공원')
        const undergroundVia = undergroundNetworksOnPath(osmRoute.path)
        const viaParts = ['그늘 우선 탐색']
        if (undergroundVia.length > 0) {
          viaParts.push(`${undergroundVia.join(', ')} 지하보도 통과`)
        }
        if (namedParks.length > 0) {
          viaParts.push(`${namedParks.join(', ')} 통과`)
        } else if (crossedParks.length > 0) {
          viaParts.push('공원 통과')
        }

        const response: RouteResponse = {
          path: osmRoute.path,
          distance: osmRoute.distance,
          duration: osmRoute.duration,
          shadeScore: breakdown.score,
          shadeDetail: {
            buildingShadowRatio: breakdown.buildingShadowRatio,
            parkRatio: breakdown.parkRatio,
            undergroundRatio: breakdown.undergroundRatio,
            exposedRatio: breakdown.exposedRatio,
            sunAltitude: breakdown.sunAltitude,
            isNight: breakdown.isNight,
            via: viaParts.join(' · '),
          },
        }
        return Response.json(response, {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=300',
            'Content-Type': 'application/json',
          },
        })
      }
    }

    // ---------- 2순위 폴백: T-Map 후보 재랭킹 ----------
    const area: AreaData =
      walkResult.status === 'fulfilled'
        ? walkResult.value
        : { buildings: [], parks: [] }

    const fallback = await fallbackCandidateRoute(
      apiKey,
      start,
      end,
      area,
      optimal?.path ?? null,
      now
    )

    const chosen = fallback?.route ?? optimal
    if (!chosen) throw new Error('경로를 찾을 수 없습니다')

    const breakdown = scoreRoute(chosen.path, area, now)
    const response: RouteResponse = {
      path: chosen.path,
      distance: chosen.distance,
      duration: chosen.duration,
      shadeScore: breakdown.score,
      shadeDetail: {
        buildingShadowRatio: breakdown.buildingShadowRatio,
        parkRatio: breakdown.parkRatio,
        undergroundRatio: breakdown.undergroundRatio,
        exposedRatio: breakdown.exposedRatio,
        sunAltitude: breakdown.sunAltitude,
        isNight: breakdown.isNight,
        via: fallback?.via,
      },
    }
    return Response.json(response, {
      status: 200,
      headers: {
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
