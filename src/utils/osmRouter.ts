// OSM 보행 네트워크 기반 그늘 가중 경로 탐색 (서버 전용)
//
// T-Map 네트워크에 없는 골목/공원 내부 산책로까지 포함한 OSM 그래프 위에서
// "엣지 비용 = 길이 x (1 - 그늘가중 x 그늘계수) x 최적길회피 페널티" 로 A* 탐색.
// -> 그늘진 골목과 공원을 알아서 꿰어가고, 최적의 길과는 다른 경로가 나온다.

import { getSunPosition } from './sun'
import {
  distanceMeters,
  bearingDegrees,
  angleDiff,
  pointInPolygon,
  samplePath,
  type Point,
} from './geo'
import type { WalkData, Building } from './overpass'

export interface OsmRouteResult {
  path: Array<[number, number]> // [lng, lat][]
  distance: number // meters
  duration: number // seconds
}

const SHADE_WEIGHT = 0.55 // 그늘 선호 강도 (0~1): 완전 그늘 엣지는 길이의 45%로 취급
const PARK_SHADE_FACTOR = 0.85
const WALKING_SPEED_MPS = 1.12 // T-Map 보행 속도와 유사 (~4km/h)
const SNAP_MAX_DIST_M = 200 // 출발/도착 좌표를 그래프에 스냅할 최대 거리
const SHADOW_DIRECTION_TOLERANCE = 75
const MAX_SHADOW_LENGTH_M = 120
const BUILDING_FILTER_RADIUS_M = 80
// 차도가 큰 도로(tertiary)를 따라/가로질러 걷는 것에 대한 페널티.
// 단, 횡단보도 지점(crossing 노드)이 있는 구간은 정상 비용 -> 차도 횡단은 횡단보도로 유도.
// primary/secondary 대로는 아예 그래프에서 제외되어(overpass.ts) 보도+횡단보도로만 이동.
const BIG_ROAD_PENALTY = 1.5
// 대로 센터라인 노드(교차로)를 횡단보도 아닌 지점에서 통과 = 무단횡단 -> 강한 페널티
const ILLEGAL_CROSS_PENALTY = 3.0
// 횡단보도 구간(footway=crossing) 우대 - 경로가 횡단보도로 꺾이도록
const CROSSWALK_BONUS = 0.85

interface Edge {
  to: number
  length: number
  cost: number
}

// ---------- 건물 공간 인덱스 (그리드) ----------

const CELL_DEG = 0.001 // ~111m

function cellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`
}

function buildSpatialIndex(buildings: Building[]): Map<string, Building[]> {
  const index = new Map<string, Building[]>()
  for (const b of buildings) {
    const key = cellKey(b.center.lat, b.center.lng)
    const bucket = index.get(key)
    if (bucket) bucket.push(b)
    else index.set(key, [b])
  }
  return index
}

function nearbyBuildings(
  index: Map<string, Building[]>,
  point: Point
): Building[] {
  const ci = Math.floor(point.lat / CELL_DEG)
  const cj = Math.floor(point.lng / CELL_DEG)
  const result: Building[] = []
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      const bucket = index.get(`${i}:${j}`)
      if (bucket) result.push(...bucket)
    }
  }
  return result
}

// ---------- 그늘 계수 ----------

function shadeFactorAt(
  point: Point,
  walk: WalkData,
  buildingIndex: Map<string, Building[]>,
  sunAzimuth: number,
  tanAlt: number
): number {
  // 건물 그림자 판정
  for (const building of nearbyBuildings(buildingIndex, point)) {
    const centerDist = distanceMeters(point, building.center)
    if (centerDist > BUILDING_FILTER_RADIUS_M) continue

    const bearingToBuilding = bearingDegrees(point, building.center)
    if (angleDiff(bearingToBuilding, sunAzimuth) > SHADOW_DIRECTION_TOLERANCE)
      continue

    const shadowLength = Math.min(building.height / tanAlt, MAX_SHADOW_LENGTH_M)

    let minDist = centerDist
    for (const vertex of building.footprint) {
      const d = distanceMeters(point, vertex)
      if (d < minDist) minDist = d
    }
    if (minDist <= shadowLength) return 1
  }

  // 공원 내부 (수목 그늘)
  for (const park of walk.parks) {
    if (pointInPolygon(point, park.polygon)) return PARK_SHADE_FACTOR
  }

  return 0
}

// ---------- 최적길 회피용 근접 판정 ----------

function buildAvoidIndex(optimalPath: Array<[number, number]>): Set<string> {
  const cells = new Set<string>()
  const samples = samplePath(optimalPath, 10)
  for (const p of samples) {
    // 샘플 주변 셀도 등록해 12m 근접을 셀 단위로 근사
    const ci = Math.floor(p.lat / CELL_DEG)
    const cj = Math.floor(p.lng / CELL_DEG)
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        cells.add(`${i}:${j}`)
      }
    }
  }
  return cells
}

function isNearOptimal(
  point: Point,
  avoidCells: Set<string>,
  optimalSamples: Point[]
): boolean {
  if (!avoidCells.has(cellKey(point.lat, point.lng))) return false
  for (const s of optimalSamples) {
    if (distanceMeters(point, s) < 15) return true
  }
  return false
}

// ---------- 이진 힙 (A* 우선순위 큐) ----------

class MinHeap {
  private keys: number[] = []
  private priorities: number[] = []

  get size(): number {
    return this.keys.length
  }

  push(key: number, priority: number): void {
    this.keys.push(key)
    this.priorities.push(priority)
    let i = this.keys.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.priorities[parent] <= this.priorities[i]) break
      this.swap(i, parent)
      i = parent
    }
  }

  pop(): number | undefined {
    if (this.keys.length === 0) return undefined
    const top = this.keys[0]
    const lastKey = this.keys.pop()!
    const lastPriority = this.priorities.pop()!
    if (this.keys.length > 0) {
      this.keys[0] = lastKey
      this.priorities[0] = lastPriority
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let smallest = i
        if (
          left < this.keys.length &&
          this.priorities[left] < this.priorities[smallest]
        )
          smallest = left
        if (
          right < this.keys.length &&
          this.priorities[right] < this.priorities[smallest]
        )
          smallest = right
        if (smallest === i) break
        this.swap(i, smallest)
        i = smallest
      }
    }
    return top
  }

  private swap(a: number, b: number): void {
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
    ;[this.priorities[a], this.priorities[b]] = [
      this.priorities[b],
      this.priorities[a],
    ]
  }
}

// ---------- 메인: 그늘 가중 라우팅 ----------

/**
 * OSM 보행 그래프에서 그늘 가중 최단 경로 탐색.
 * @param avoidPenalty 최적길과 겹치는 엣지의 비용 배율 (>1이면 회피)
 * @returns 경로 또는 null (그래프 스냅/탐색 실패)
 */
export function routeWithShade(
  walk: WalkData,
  start: Point,
  end: Point,
  date: Date,
  optimalPath: Array<[number, number]>,
  avoidPenalty: number
): OsmRouteResult | null {
  if (walk.ways.length === 0 || walk.nodes.size === 0) return null

  // 태양 상태 (밤이면 그늘 계수 생략 -> 회피 페널티만 작동)
  const sun = getSunPosition(date, start.lat, start.lng)
  const isDaytime = sun.altitude > 0
  const tanAlt = isDaytime ? Math.tan((sun.altitude * Math.PI) / 180) : 0

  const buildingIndex = buildSpatialIndex(walk.buildings)
  const optimalSamples = samplePath(optimalPath, 10)
  const avoidCells = buildAvoidIndex(optimalPath)

  // 그래프 구축 (노드 id -> 엣지 목록), 엣지 비용에 그늘/회피 반영
  const adjacency = new Map<number, Edge[]>()
  const addEdge = (from: number, to: number, length: number, cost: number) => {
    const list = adjacency.get(from)
    if (list) list.push({ to, length, cost })
    else adjacency.set(from, [{ to, length, cost }])
  }

  for (const way of walk.ways) {
    for (let i = 1; i < way.nodeIds.length; i++) {
      const aId = way.nodeIds[i - 1]
      const bId = way.nodeIds[i]
      const a = walk.nodes.get(aId)
      const b = walk.nodes.get(bId)
      if (!a || !b) continue

      const length = distanceMeters(a, b)
      if (length === 0) continue

      const mid: Point = {
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2,
      }

      let cost: number

      if (way.isCrossing) {
        // 횡단보도 구간: 우대 비용, 그늘/회피 페널티 미적용
        // (대로를 건너는 유일하게 올바른 통로이므로 항상 매력적이어야 함)
        cost = length * CROSSWALK_BONUS
      } else {
        const shade = isDaytime
          ? shadeFactorAt(mid, walk, buildingIndex, sun.azimuth, tanAlt)
          : 0
        const avoid = isNearOptimal(mid, avoidCells, optimalSamples)
          ? avoidPenalty
          : 1

        // 차도 페널티
        let roadPenalty = 1

        // 대로(primary/secondary) 센터라인 노드를 횡단보도 아닌 지점에서
        // 지나는 엣지 = 교차로 무단횡단 -> 강한 페널티로 횡단보도로 유도
        const touchesMajorRoad =
          (walk.majorRoadNodeIds.has(aId) && !walk.crossingNodeIds.has(aId)) ||
          (walk.majorRoadNodeIds.has(bId) && !walk.crossingNodeIds.has(bId))

        if (touchesMajorRoad) {
          roadPenalty = ILLEGAL_CROSS_PENALTY
        } else if (way.highway === 'tertiary') {
          // tertiary는 횡단보도 지점을 포함한 구간만 정상 비용
          const touchesCrossing =
            walk.crossingNodeIds.has(aId) || walk.crossingNodeIds.has(bId)
          if (!touchesCrossing) roadPenalty = BIG_ROAD_PENALTY
        }

        cost = length * (1 - SHADE_WEIGHT * shade) * avoid * roadPenalty
      }

      addEdge(aId, bId, length, cost)
      addEdge(bId, aId, length, cost)
    }
  }

  // 출발/도착을 가장 가까운 그래프 노드에 스냅
  const snap = (p: Point): number | null => {
    let bestId: number | null = null
    let bestDist = SNAP_MAX_DIST_M
    for (const [id, coord] of walk.nodes) {
      if (!adjacency.has(id)) continue // 고립 노드 제외
      const d = distanceMeters(p, coord)
      if (d < bestDist) {
        bestDist = d
        bestId = id
      }
    }
    return bestId
  }

  const startId = snap(start)
  const endId = snap(end)
  if (startId === null || endId === null || startId === endId) return null

  const endPoint = walk.nodes.get(endId)!

  // A* 탐색
  const gScore = new Map<number, number>()
  const cameFrom = new Map<number, number>()
  const closed = new Set<number>()
  const heap = new MinHeap()

  gScore.set(startId, 0)
  heap.push(
    startId,
    distanceMeters(walk.nodes.get(startId)!, endPoint) * (1 - SHADE_WEIGHT)
  )

  let found = false
  while (heap.size > 0) {
    const current = heap.pop()!
    if (current === endId) {
      found = true
      break
    }
    if (closed.has(current)) continue
    closed.add(current)

    const currentG = gScore.get(current)!
    const edges = adjacency.get(current)
    if (!edges) continue

    for (const edge of edges) {
      if (closed.has(edge.to)) continue
      const tentative = currentG + edge.cost
      const existing = gScore.get(edge.to)
      if (existing === undefined || tentative < existing) {
        gScore.set(edge.to, tentative)
        cameFrom.set(edge.to, current)
        const h =
          distanceMeters(walk.nodes.get(edge.to)!, endPoint) *
          (1 - SHADE_WEIGHT)
        heap.push(edge.to, tentative + h)
      }
    }
  }

  if (!found) return null

  // 경로 재구성
  const nodePath: number[] = [endId]
  let cursor = endId
  while (cursor !== startId) {
    const prev = cameFrom.get(cursor)
    if (prev === undefined) return null
    nodePath.push(prev)
    cursor = prev
  }
  nodePath.reverse()

  const path: Array<[number, number]> = [[start.lng, start.lat]]
  let distance = 0
  let prevPoint: Point = start
  for (const id of nodePath) {
    const p = walk.nodes.get(id)!
    distance += distanceMeters(prevPoint, p)
    path.push([p.lng, p.lat])
    prevPoint = p
  }
  distance += distanceMeters(prevPoint, end)
  path.push([end.lng, end.lat])

  return {
    path,
    distance: Math.round(distance),
    duration: Math.round(distance / WALKING_SPEED_MPS),
  }
}

/** 두 경로의 유사도 (0~1): a의 샘플 중 b에서 15m 이내인 비율 */
export function pathSimilarity(
  a: Array<[number, number]>,
  b: Array<[number, number]>
): number {
  const aSamples = samplePath(a, 20)
  const bSamples = samplePath(b, 10)
  if (aSamples.length === 0 || bSamples.length === 0) return 0

  let near = 0
  for (const p of aSamples) {
    for (const q of bSamples) {
      if (distanceMeters(p, q) < 15) {
        near++
        break
      }
    }
  }
  return near / aSamples.length
}
