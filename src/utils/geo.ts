// 지리 계산 유틸 (거리, 방위각, 경로 샘플링, 다각형 포함 판정)

export interface Point {
  lat: number
  lng: number
}

const EARTH_RADIUS = 6371000 // meters
const RAD = Math.PI / 180

/** 두 지점 사이 거리 (미터, haversine) */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

/** a에서 b를 바라보는 방위각 (도, 북쪽 기준 시계방향) */
export function bearingDegrees(a: Point, b: Point): number {
  const dLng = (b.lng - a.lng) * RAD
  const lat1 = a.lat * RAD
  const lat2 = b.lat * RAD
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) / RAD) % 360 + 360) % 360
}

/** 두 방위각 차이 (0~180도) */
export function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** 경로를 일정 간격(미터)으로 샘플링 */
export function samplePath(
  path: Array<[number, number]>, // [lng, lat][]
  intervalMeters: number
): Point[] {
  if (path.length === 0) return []

  const points: Point[] = [{ lat: path[0][1], lng: path[0][0] }]
  let carried = 0

  for (let i = 1; i < path.length; i++) {
    const prev: Point = { lat: path[i - 1][1], lng: path[i - 1][0] }
    const curr: Point = { lat: path[i][1], lng: path[i][0] }
    const segLen = distanceMeters(prev, curr)
    if (segLen === 0) continue

    let offset = intervalMeters - carried
    while (offset < segLen) {
      const t = offset / segLen
      points.push({
        lat: prev.lat + (curr.lat - prev.lat) * t,
        lng: prev.lng + (curr.lng - prev.lng) * t,
      })
      offset += intervalMeters
    }
    carried = (carried + segLen) % intervalMeters
  }

  const last: Point = {
    lat: path[path.length - 1][1],
    lng: path[path.length - 1][0],
  }
  points.push(last)
  return points
}

/** 점이 다각형 안에 있는지 (ray casting - 교차 횟수 홀짝 판정) */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** 점에서 선분 a-b까지의 최단 거리 (미터, 국지 평면 근사) */
export function distanceToSegmentMeters(p: Point, a: Point, b: Point): number {
  const mPerLat = 111320
  const mPerLng = 111320 * Math.cos(p.lat * RAD)
  // p를 원점으로 하는 평면 좌표
  const ax = (a.lng - p.lng) * mPerLng
  const ay = (a.lat - p.lat) * mPerLat
  const bx = (b.lng - p.lng) * mPerLng
  const by = (b.lat - p.lat) * mPerLat
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t = lenSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0
  const cx = ax + dx * t
  const cy = ay + dy * t
  return Math.sqrt(cx * cx + cy * cy)
}

/** 두 선분(p1-p2, p3-p4)이 서로 가로지르는지 (끝점 접촉은 제외) */
export function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  // 방향 판정(외적 부호)은 위경도 비등방 스케일에 불변이므로 좌표 그대로 사용
  const cross = (a: Point, b: Point, c: Point) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng)
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}

/** 점에서 선분(polyline)까지 최소 거리 근사 (미터) — 정점 간 거리로 근사 */
export function minDistanceToPolyline(point: Point, line: Point[]): number {
  let min = Infinity
  for (const vertex of line) {
    const d = distanceMeters(point, vertex)
    if (d < min) min = d
  }
  return min
}

/** 점들에서 bbox 계산 + 마진(미터) */
export function bboxWithMargin(
  points: Point[],
  marginMeters: number
): { south: number; west: number; north: number; east: number } {
  let south = Infinity
  let north = -Infinity
  let west = Infinity
  let east = -Infinity
  for (const p of points) {
    if (p.lat < south) south = p.lat
    if (p.lat > north) north = p.lat
    if (p.lng < west) west = p.lng
    if (p.lng > east) east = p.lng
  }
  const latMargin = marginMeters / 111320
  const lngMargin =
    marginMeters / (111320 * Math.cos(((south + north) / 2) * RAD))
  return {
    south: south - latMargin,
    west: west - lngMargin,
    north: north + latMargin,
    east: east + lngMargin,
  }
}

/** 다각형 중심점 (centroid 근사) */
export function polygonCenter(polygon: Point[]): Point {
  let lat = 0
  let lng = 0
  for (const p of polygon) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / polygon.length, lng: lng / polygon.length }
}
