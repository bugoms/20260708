// OpenStreetMap Overpass API — 건물/공원 데이터 조회 (서버 전용)

import type { Point } from './geo'
import { polygonCenter } from './geo'

export interface Building {
  footprint: Point[] // 건물 윤곽
  center: Point
  height: number // 미터 (추정 포함)
}

export interface Park {
  name: string
  polygon: Point[]
  center: Point
}

export interface AreaData {
  buildings: Building[]
  parks: Park[]
}

interface OverpassElement {
  type: string
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

// 실측 응답 속도 기준 우선순위 (메인 서버는 혼잡할 때가 많음)
const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const DEFAULT_FLOOR_HEIGHT = 3.0 // 층당 높이(m)
const DEFAULT_BUILDING_HEIGHT = 12 // 높이 정보 없을 때 기본값(m) - 역삼동 중저층 기준

// 서버리스 인스턴스 단위 인메모리 캐시 (bbox 반올림 키, 10분 TTL)
const cache = new Map<string, { data: AreaData; expires: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

function parseHeight(tags: Record<string, string>): number {
  const height = parseFloat(tags['height'] || '')
  if (!Number.isNaN(height) && height > 0) return height

  const levels = parseFloat(tags['building:levels'] || '')
  if (!Number.isNaN(levels) && levels > 0) return levels * DEFAULT_FLOOR_HEIGHT

  return DEFAULT_BUILDING_HEIGHT
}

export async function fetchAreaData(bbox: {
  south: number
  west: number
  north: number
  east: number
}): Promise<AreaData> {
  const key = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((v) => v.toFixed(3))
    .join(',')

  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  const query = `
[out:json][timeout:10];
(
  way["building"](${bboxStr});
  way["leisure"="park"](${bboxStr});
);
out tags geom;
`

  let lastError: unknown = null
  for (const mirror of MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'shade-route-webapp/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(6000),
      })
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`)

      const json = (await response.json()) as { elements: OverpassElement[] }
      const buildings: Building[] = []
      const parks: Park[] = []

      for (const el of json.elements) {
        if (!el.geometry || el.geometry.length < 3 || !el.tags) continue
        const polygon: Point[] = el.geometry.map((g) => ({
          lat: g.lat,
          lng: g.lon,
        }))

        if (el.tags['building']) {
          buildings.push({
            footprint: polygon,
            center: polygonCenter(polygon),
            height: parseHeight(el.tags),
          })
        } else if (el.tags['leisure'] === 'park') {
          parks.push({
            name: el.tags['name'] || '공원',
            polygon,
            center: polygonCenter(polygon),
          })
        }
      }

      const data: AreaData = { buildings, parks }
      cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
      return data
    } catch (error) {
      lastError = error
      // 다음 미러로 폴백
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Overpass mirrors failed')
}
