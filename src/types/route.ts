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
  outside?: boolean // 서비스 구역(역삼동) 밖 여부 - 서버에서 계산
}

export interface RouteResponse {
  path: Array<[number, number]>
  distance: number
  duration: number
  shadeScore?: number
  shadeDetail?: ShadeDetail
}

export interface ShadeDetail {
  buildingShadowRatio: number // 건물 그림자 구간 비율(%)
  parkRatio: number // 공원 구간 비율(%)
  exposedRatio: number // 햇빛 노출 구간 비율(%)
  sunAltitude: number // 태양 고도(도)
  isNight: boolean
  via?: string // 경유 정보 (예: "역삼개나리공원 경유")
}

export interface RouteRequest {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  routeType: 'optimal' | 'shade'
  departureTime?: number // epoch ms - 출발 시각 (미지정 시 현재 시각)
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
