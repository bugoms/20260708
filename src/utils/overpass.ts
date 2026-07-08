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

/** 보행 네트워크 way (그래프 구축용 - 노드 id 참조 포함) */
export interface WalkWay {
  nodeIds: number[]
  highway: string
}

export interface WalkData extends AreaData {
  ways: WalkWay[]
  nodes: Map<number, Point> // OSM 노드 id -> 좌표
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  nodes?: number[]
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
  members?: Array<{
    type: string
    ref: number
    role: string
    geometry?: Array<{ lat: number; lon: number }>
  }>
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

async function runOverpassQuery(
  query: string
): Promise<{ elements: OverpassElement[] }> {
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
      return (await response.json()) as { elements: OverpassElement[] }
    } catch (error) {
      lastError = error
      // 다음 미러로 폴백
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('All Overpass mirrors failed')
}

function parseBuildingsAndParks(elements: OverpassElement[]): AreaData {
  const buildings: Building[] = []
  const parks: Park[] = []

  for (const el of elements) {
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

  return { buildings, parks }
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

  const json = await runOverpassQuery(query)
  const data = parseBuildingsAndParks(json.elements)
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}

// 보행 가능 도로 유형 (사유지/차량전용 제외)
const WALKABLE_HIGHWAY =
  '^(footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary|secondary|primary)$'

const walkCache = new Map<string, { data: WalkData; expires: number }>()

/**
 * 보행 네트워크(그래프용 way + 노드 좌표) + 건물/공원을 한 번의 쿼리로 로드.
 * way는 노드 id 배열을 포함하므로 교차점에서 그래프가 연결된다.
 */
export async function fetchWalkData(bbox: {
  south: number
  west: number
  north: number
  east: number
}): Promise<WalkData> {
  const key = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((v) => v.toFixed(3))
    .join(',')

  const cached = walkCache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  const query = `
[out:json][timeout:12];
way["highway"~"${WALKABLE_HIGHWAY}"]["foot"!="no"]["access"!="private"](${bboxStr})->.roads;
.roads out body;
node(w.roads);
out skel qt;
(
  way["building"](${bboxStr});
  way["leisure"="park"](${bboxStr});
);
out tags geom;
`

  const json = await runOverpassQuery(query)

  const ways: WalkWay[] = []
  const nodes = new Map<number, Point>()
  const areaElements: OverpassElement[] = []

  for (const el of json.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodes.set(el.id, { lat: el.lat, lng: el.lon })
    } else if (el.type === 'way' && el.tags?.['highway'] && el.nodes) {
      ways.push({ nodeIds: el.nodes, highway: el.tags['highway'] })
    } else if (el.type === 'way' && el.geometry) {
      areaElements.push(el)
    }
  }

  const area = parseBuildingsAndParks(areaElements)
  const data: WalkData = { ...area, ways, nodes }
  walkCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}

// ---------- 역삼동 행정 경계 ----------

let boundaryCache: { rings: Array<Array<[number, number]>>; expires: number } | null =
  null
const BOUNDARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 행정 경계는 거의 안 변함

/** 좌표를 끝점 매칭용 키로 (1e-7도 정밀도) */
function coordKey(p: { lat: number; lon: number }): string {
  return `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`
}

/**
 * way 조각들을 끝점 매칭으로 이어붙여 닫힌 링(들)으로 조립.
 * 행정 경계 relation의 outer way들은 순서/방향이 뒤섞여 있으므로 스티칭 필요.
 */
function stitchRings(
  segments: Array<Array<{ lat: number; lon: number }>>
): Array<Array<[number, number]>> {
  const remaining = segments.filter((s) => s.length >= 2)
  const rings: Array<Array<[number, number]>> = []

  while (remaining.length > 0) {
    let ring = [...remaining.shift()!]

    let extended = true
    while (extended) {
      extended = false
      const head = coordKey({ lat: ring[0].lat, lon: ring[0].lon })
      const tail = coordKey({
        lat: ring[ring.length - 1].lat,
        lon: ring[ring.length - 1].lon,
      })
      if (head === tail) break // 링 닫힘

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i]
        const segStart = coordKey(seg[0])
        const segEnd = coordKey(seg[seg.length - 1])

        if (segStart === tail) {
          ring = ring.concat(seg.slice(1))
        } else if (segEnd === tail) {
          ring = ring.concat([...seg].reverse().slice(1))
        } else if (segEnd === head) {
          ring = seg.slice(0, -1).concat(ring)
        } else if (segStart === head) {
          ring = [...seg].reverse().slice(0, -1).concat(ring)
        } else {
          continue
        }
        remaining.splice(i, 1)
        extended = true
        break
      }
    }

    if (ring.length >= 4) {
      rings.push(ring.map((p) => [p.lon, p.lat]))
    }
  }

  return rings
}

/**
 * 역삼동(역삼1동+역삼2동) 통합 경계 조회.
 * 두 행정동이 공유하는 내부 경계 way를 제거하고 외곽만 이어붙인다.
 * @returns 닫힌 링 배열 ([lng, lat][][]) - 병합 성공 시 1개, 실패 시 동별 링
 */
export async function fetchYeoksamBoundary(): Promise<
  Array<Array<[number, number]>>
> {
  if (boundaryCache && boundaryCache.expires > Date.now()) {
    return boundaryCache.rings
  }

  const query = `
[out:json][timeout:15];
(
  relation["boundary"="administrative"]["admin_level"="8"]["name"="역삼1동"](37.48,127.01,37.52,127.06);
  relation["boundary"="administrative"]["admin_level"="8"]["name"="역삼2동"](37.48,127.01,37.52,127.06);
);
out geom;
`

  const json = await runOverpassQuery(query)
  const relations = json.elements.filter(
    (el) => el.type === 'relation' && el.members
  )

  // way ref별 등장 횟수 - 두 relation 모두에 있으면 내부(공유) 경계
  const refCount = new Map<number, number>()
  for (const rel of relations) {
    for (const m of rel.members!) {
      if (m.type === 'way' && m.geometry) {
        refCount.set(m.ref, (refCount.get(m.ref) || 0) + 1)
      }
    }
  }

  const outerSegments: Array<Array<{ lat: number; lon: number }>> = []
  const seen = new Set<number>()
  for (const rel of relations) {
    for (const m of rel.members!) {
      if (m.type !== 'way' || !m.geometry || seen.has(m.ref)) continue
      seen.add(m.ref)
      if ((refCount.get(m.ref) || 0) >= 2) continue // 내부 공유 경계 제거
      outerSegments.push(m.geometry)
    }
  }

  let rings = stitchRings(outerSegments)

  // 병합 실패(링이 안 닫히거나 조각남) 시 동별 개별 링으로 폴백
  if (rings.length === 0 || rings.length > 2) {
    rings = relations.flatMap((rel) =>
      stitchRings(
        rel
          .members!.filter((m) => m.type === 'way' && m.geometry)
          .map((m) => m.geometry!)
      )
    )
  }

  boundaryCache = { rings, expires: Date.now() + BOUNDARY_CACHE_TTL_MS }
  return rings
}
