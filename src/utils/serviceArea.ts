// 서비스 구역(역삼동) 판정 - 서버/클라이언트 공용
// 경계 데이터를 번들에 직접 포함 -> 네트워크 로드 타이밍/실패와 무관하게 항상 판정 가능
// 경계는 역삼1동+역삼2동을 합친 단일 폴리곤 (rings[0])

import boundaryData from '@/data/boundary.json'
import { pointInPolygon, distanceToSegmentMeters, type Point } from './geo'

export const YEOKSAM_RINGS = boundaryData.rings as Array<
  Array<[number, number]>
>

/** 역삼동 면적 중심 (경계 폴리곤 centroid, 현위치 버튼 이동 지점) */
export const YEOKSAM_CENTER: Point = {
  lat: boundaryData.center[1],
  lng: boundaryData.center[0],
}

/** 좌표가 역삼동(역삼1동+역삼2동) 안인지 */
export function isInYeoksam(lat: number, lng: number): boolean {
  return YEOKSAM_RINGS.some((ring) =>
    pointInPolygon(
      { lat, lng },
      ring.map((c) => ({ lat: c[1], lng: c[0] }))
    )
  )
}

// 경계선 선분 목록 (닫는 선분 포함) - 구역 밖 지점의 이탈 거리 측정용
const BOUNDARY_SEGMENTS: Array<[Point, Point]> = YEOKSAM_RINGS.flatMap(
  (ring) => {
    const pts = ring.map((c) => ({ lat: c[1], lng: c[0] }))
    return pts.map(
      (p, i) => [p, pts[(i + 1) % pts.length]] as [Point, Point]
    )
  }
)

/** 경계선까지의 최단 거리 (미터) */
export function distanceToYeoksamBoundary(point: Point): number {
  let min = Infinity
  for (const [a, b] of BOUNDARY_SEGMENTS) {
    const d = distanceToSegmentMeters(point, a, b)
    if (d < min) min = d
  }
  return min
}
