// 서비스 구역(역삼동) 판정 - 서버/클라이언트 공용
// 경계 데이터를 번들에 직접 포함 -> 네트워크 로드 타이밍/실패와 무관하게 항상 판정 가능

import boundaryData from '@/data/boundary.json'
import { pointInPolygon } from './geo'

export const YEOKSAM_RINGS = boundaryData.rings as Array<
  Array<[number, number]>
>

/** 좌표가 역삼동(역삼1동+역삼2동) 안인지 */
export function isInYeoksam(lat: number, lng: number): boolean {
  return YEOKSAM_RINGS.some((ring) =>
    pointInPolygon(
      { lat, lng },
      ring.map((c) => ({ lat: c[1], lng: c[0] }))
    )
  )
}
