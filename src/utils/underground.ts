// 지하 보행 경로(지하철역 지하보도) 주입 — 서버 전용
//
// 신논현역·선정릉역·선릉역의 지하보도망을 OSM 보행 그래프에 합성 노드로 주입한다.
// 출입구 좌표는 OSM 실측(railway=subway_entrance), 내부 통로는 역 안내도 기반.
//  - 지하 통로 엣지: 완전 그늘(shadeFactor=1) -> 한낮 대로 구간에서 자연히 선택됨
//  - 출입구 연결 엣지: 가장 가까운 지상 보행 노드와 연결 + 계단 오르내림 페널티
// 지하 노드는 음수 id를 사용해 OSM 노드 id(양수)와 절대 충돌하지 않는다.

import undergroundData from '@/data/underground.json'
import { distanceToSegmentMeters, segmentsIntersect, type Point } from './geo'
import type { WalkData } from './overpass'

export interface UndergroundNode {
  id: string
  lat: number
  lng: number
  type: 'entrance' | 'elevator' | 'internal'
  name?: string
}

export interface UndergroundNetwork {
  id: string
  name: string // 표시용 (예: "선릉역")
  nodes: UndergroundNode[]
  edges: Array<[string, string]>
}

const NETWORKS = undergroundData.networks as unknown as UndergroundNetwork[]

// 출입구를 지상 그래프에 연결할 최대 거리 - 이보다 멀면 해당 출입구는 미연결
// (대로변 보도가 OSM에 없는 구역은 이면도로까지 40~60m 거리인 경우가 흔함)
const ENTRANCE_LINK_MAX_M = 70

/** 지상 보행 way의 선분 (출입구 연결 후보) */
interface SurfaceSegment {
  aId: number
  bId: number
  a: Point
  b: Point
}

/**
 * bbox에 걸치는 지하보도망을 보행 그래프에 주입 (walk를 직접 변형).
 * fetchWalkData에서 캐시 저장 전에 1회만 호출된다.
 */
export function injectUndergroundNetworks(
  walk: WalkData,
  bbox: { south: number; west: number; north: number; east: number }
): void {
  // 출입구 연결 후보: 지상 way의 선분 목록 (노드가 성긴 보도에서도 연결되도록
  // 가장 가까운 "선분"을 찾아 그 양 끝 노드에 연결한다 - 같은 보도 위 연결이라
  // 차도를 몰래 가로지르는 링크가 생기지 않는다)
  let surfaceSegments: SurfaceSegment[] | null = null

  let nextId = -1
  for (const network of NETWORKS) {
    const inBbox = network.nodes.some(
      (n) =>
        n.lat >= bbox.south &&
        n.lat <= bbox.north &&
        n.lng >= bbox.west &&
        n.lng <= bbox.east
    )
    if (!inBbox) continue

    if (surfaceSegments === null) {
      surfaceSegments = []
      for (const way of walk.ways) {
        if (way.isUnderground || way.isEntranceLink) continue
        for (let i = 1; i < way.nodeIds.length; i++) {
          const a = walk.nodes.get(way.nodeIds[i - 1])
          const b = walk.nodes.get(way.nodeIds[i])
          if (!a || !b) continue
          surfaceSegments.push({
            aId: way.nodeIds[i - 1],
            bId: way.nodeIds[i],
            a,
            b,
          })
        }
      }
    }

    // 1) 지하 노드 주입
    const idMap = new Map<string, number>()
    for (const n of network.nodes) {
      const numericId = nextId--
      idMap.set(n.id, numericId)
      walk.nodes.set(numericId, { lat: n.lat, lng: n.lng })
    }

    // 2) 지하 통로 엣지
    for (const [a, b] of network.edges) {
      const aId = idMap.get(a)
      const bId = idMap.get(b)
      if (aId === undefined || bId === undefined) continue
      walk.ways.push({
        nodeIds: [aId, bId],
        highway: 'underground',
        isCrossing: false,
        isUnderground: true,
      })
      walk.undergroundSegments.push([
        walk.nodes.get(aId)!,
        walk.nodes.get(bId)!,
      ])
    }

    // 3) 출입구/엘리베이터 <-> 지상 그래프 연결
    // 거리순 후보 중, 연결선이 대로 센터라인을 가로지르지 않는 첫 선분에 연결
    // (출입구가 대로 건너편 이면도로에 붙어 무단횡단 지름길이 생기는 것 방지)
    for (const n of network.nodes) {
      if (n.type === 'internal') continue
      const entrance: Point = { lat: n.lat, lng: n.lng }

      const candidates = surfaceSegments
        .map((seg) => ({
          seg,
          d: distanceToSegmentMeters(entrance, seg.a, seg.b),
        }))
        .filter((c) => c.d < ENTRANCE_LINK_MAX_M)
        .sort((x, y) => x.d - y.d)

      for (const { seg } of candidates) {
        const crossesMajorRoad = walk.majorRoadSegments.some(
          ([ra, rb]) =>
            segmentsIntersect(entrance, seg.a, ra, rb) ||
            segmentsIntersect(entrance, seg.b, ra, rb)
        )
        if (crossesMajorRoad) continue

        walk.ways.push({
          nodeIds: [seg.aId, idMap.get(n.id)!, seg.bId],
          highway: 'underground_access',
          isCrossing: false,
          isEntranceLink: true,
        })
        break
      }
    }
  }
}

/**
 * 경로가 실제로 통과한 지하보도망 이름 목록.
 * 경로 정점은 그래프 노드 좌표를 그대로 사용하므로, 한 망의 노드 2개 이상과
 * 좌표가 일치하면 그 역의 지하보도를 지나간 것으로 판정한다.
 */
export function undergroundNetworksOnPath(
  path: Array<[number, number]> // [lng, lat][]
): string[] {
  const names: string[] = []
  for (const network of NETWORKS) {
    let hits = 0
    for (const n of network.nodes) {
      for (const [lng, lat] of path) {
        if (Math.abs(lat - n.lat) < 1e-6 && Math.abs(lng - n.lng) < 1e-6) {
          hits++
          break
        }
      }
      if (hits >= 2) break
    }
    if (hits >= 2) names.push(network.name)
  }
  return names
}
