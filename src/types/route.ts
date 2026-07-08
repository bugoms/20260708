export interface Location {
  lat: number
  lng: number
  name: string
}

export interface PoiResult {
  name: string
  lat: number
  lng: number
  address: string
}

export interface RouteResponse {
  path: Array<[number, number]>
  distance: number
  duration: number
  shadeScore?: number
}

export interface RouteRequest {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  routeType: 'optimal' | 'shade'
}

export interface SunPosition {
  azimuth: number
  altitude: number
}

export interface ShadeInfo {
  latitude: number
  longitude: number
  buildingShadow: number
  treesDensity: number
  pavingMaterial: number
  timeWeight: number
  totalScore: number
}

export type RouteType = 'optimal' | 'shade'
