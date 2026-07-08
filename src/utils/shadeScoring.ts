// 경로 그늘 점수 계산 엔진 (서버 전용)
// 원리: 경로를 일정 간격으로 샘플링한 뒤 각 지점이
//  1) 건물 그림자 안인지 - 태양 방위각 방향의 건물이 그림자 길이(높이/tan(고도)) 안에 있는지
//  2) 공원 안인지 - 수목 그늘로 간주
// 를 판정하여 전체 경로의 그늘 비율을 점수화한다.

import { getSunPosition } from './sun'
import {
  samplePath,
  distanceMeters,
  bearingDegrees,
  angleDiff,
  pointInPolygon,
  type Point,
} from './geo'
import type { AreaData, Building } from './overpass'

export interface ShadeBreakdown {
  score: number // 0~100 그늘 비율
  buildingShadowRatio: number // 건물 그림자 구간 비율(%)
  parkRatio: number // 공원 구간 비율(%)
  exposedRatio: number // 노출 구간 비율(%)
  sunAltitude: number // 태양 고도(도)
  isNight: boolean
}

const SAMPLE_INTERVAL_M = 20 // 경로 샘플 간격
const BUILDING_FILTER_RADIUS_M = 80 // 그림자 후보 건물 사전 필터 반경
const SHADOW_DIRECTION_TOLERANCE = 75 // 태양 방향 허용 각도(도)
const PARK_SHADE_VALUE = 85 // 공원 그늘 값 (수목 밀도 고려)
const MAX_SHADOW_LENGTH_M = 120 // 그림자 길이 상한(비정상적으로 긴 새벽/저녁 값 방지)

/** 샘플 지점이 건물 그림자 안인지 판정 */
function isInBuildingShadow(
  point: Point,
  buildings: Building[],
  sunAzimuth: number,
  sunAltitude: number
): boolean {
  const tanAlt = Math.tan((sunAltitude * Math.PI) / 180)
  if (tanAlt <= 0) return true // 해가 지평선 아래

  for (const building of buildings) {
    const centerDist = distanceMeters(point, building.center)
    if (centerDist > BUILDING_FILTER_RADIUS_M) continue

    // 그림자는 태양 반대편으로 드리워지므로,
    // 지점에서 "태양 쪽"에 있는 건물만 그림자를 드리울 수 있다
    const bearingToBuilding = bearingDegrees(point, building.center)
    if (angleDiff(bearingToBuilding, sunAzimuth) > SHADOW_DIRECTION_TOLERANCE)
      continue

    const shadowLength = Math.min(building.height / tanAlt, MAX_SHADOW_LENGTH_M)

    // 건물 윤곽에서 가장 가까운 정점까지의 거리로 판정 (중심점보다 정확)
    let minDist = centerDist
    for (const vertex of building.footprint) {
      const d = distanceMeters(point, vertex)
      if (d < minDist) minDist = d
    }

    if (minDist <= shadowLength) return true
  }

  return false
}

/** 경로 전체의 그늘 점수 계산 */
export function scoreRoute(
  path: Array<[number, number]>, // [lng, lat][]
  area: AreaData,
  date: Date = new Date()
): ShadeBreakdown {
  const samples = samplePath(path, SAMPLE_INTERVAL_M)
  if (samples.length === 0) {
    return {
      score: 0,
      buildingShadowRatio: 0,
      parkRatio: 0,
      exposedRatio: 100,
      sunAltitude: 0,
      isNight: false,
    }
  }

  const mid = samples[Math.floor(samples.length / 2)]
  const sun = getSunPosition(date, mid.lat, mid.lng)

  // 해가 지평선 아래면 햇빛 자체가 없음
  if (sun.altitude <= 0) {
    return {
      score: 100,
      buildingShadowRatio: 0,
      parkRatio: 0,
      exposedRatio: 0,
      sunAltitude: sun.altitude,
      isNight: true,
    }
  }

  let shadowCount = 0
  let parkCount = 0
  let totalValue = 0

  for (const sample of samples) {
    const inPark = area.parks.some((park) =>
      pointInPolygon(sample, park.polygon)
    )
    const inShadow = isInBuildingShadow(
      sample,
      area.buildings,
      sun.azimuth,
      sun.altitude
    )

    if (inShadow) {
      shadowCount++
      totalValue += 100
    } else if (inPark) {
      parkCount++
      totalValue += PARK_SHADE_VALUE
    }
  }

  const n = samples.length
  return {
    score: Math.round(totalValue / n),
    buildingShadowRatio: Math.round((shadowCount / n) * 100),
    parkRatio: Math.round((parkCount / n) * 100),
    exposedRatio: Math.round(((n - shadowCount - parkCount) / n) * 100),
    sunAltitude: Math.round(sun.altitude * 10) / 10,
    isNight: false,
  }
}
