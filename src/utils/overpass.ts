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
  isCrossing: boolean // 횡단보도 구간(footway=crossing) 여부
}

export interface WalkData extends AreaData {
  ways: WalkWay[]
  nodes: Map<number, Point> // OSM 노드 id -> 좌표
  crossingNodeIds: Set<number> // 횡단보도 지점(highway=crossing) 노드 id
  majorRoadNodeIds: Set<number> // 대로(primary/secondary) 센터라인 노드 id - 무단횡단 감지용
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
// primary/secondary(대로) 센터라인은 제외 - 대로변은 별도 매핑된 보도(footway)로 걷고,
// 대로 횡단은 횡단보도 구간(footway=crossing)으로만 가능해진다.
const WALKABLE_HIGHWAY =
  '^(footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary)$'

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
node["highway"="crossing"](${bboxStr});
out body;
way["highway"~"^(primary|secondary|primary_link|secondary_link|trunk)$"](${bboxStr});
out body;
(
  way["building"](${bboxStr});
  way["leisure"="park"](${bboxStr});
);
out tags geom;
`

  const json = await runOverpassQuery(query)

  const MAJOR_ROADS = new Set([
    'primary',
    'secondary',
    'primary_link',
    'secondary_link',
    'trunk',
  ])

  const ways: WalkWay[] = []
  const nodes = new Map<number, Point>()
  const crossingNodeIds = new Set<number>()
  const majorRoadNodeIds = new Set<number>()
  const areaElements: OverpassElement[] = []

  for (const el of json.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodes.set(el.id, { lat: el.lat, lng: el.lon })
      if (el.tags?.['highway'] === 'crossing') {
        crossingNodeIds.add(el.id)
      }
    } else if (el.type === 'way' && el.tags?.['highway'] && el.nodes) {
      if (MAJOR_ROADS.has(el.tags['highway'])) {
        // 대로 센터라인 - 보행 그래프에는 넣지 않고 교차 노드만 기록
        // (작은 도로가 대로와 만나는 노드를 지나며 대로를 건너는 것 = 무단횡단 감지)
        for (const nodeId of el.nodes) {
          majorRoadNodeIds.add(nodeId)
        }
      } else {
        ways.push({
          nodeIds: el.nodes,
          highway: el.tags['highway'],
          isCrossing: el.tags['footway'] === 'crossing',
        })
      }
    } else if (el.type === 'way' && el.geometry) {
      areaElements.push(el)
    }
  }

  const area = parseBuildingsAndParks(areaElements)
  const data: WalkData = {
    ...area,
    ways,
    nodes,
    crossingNodeIds,
    majorRoadNodeIds,
  }
  walkCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}
