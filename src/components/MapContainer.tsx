'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouteStore } from '@/store/routeStore'
import type { RouteResponse } from '@/types/route'

interface TmapLatLng {
  lat: () => number
  lng: () => number
}

interface TmapSize {
  width: number
  height: number
}

interface TmapMarker {
  setMap: (map: TmapMap | null) => void
}

interface TmapPolyline {
  setMap: (map: TmapMap | null) => void
}

interface TmapPolygon {
  setMap: (map: TmapMap | null) => void
}

interface TmapGroundOverlay {
  setMap: (map: TmapMap | null) => void
}

interface TmapBounds {
  extend: (latlng: TmapLatLng) => void
}

interface TmapMap {
  fitBounds: (bounds: TmapBounds) => void
  setZoom: (zoom: number) => void
  setCenter: (latlng: TmapLatLng) => void
  panTo: (latlng: TmapLatLng) => void
  setMapType: (type: number) => void // 1=일반, 4=위성, 5=하이브리드(위성+라벨)
}

interface Tmapv2Static {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => TmapMap
  LatLng: new (lat: number, lng: number) => TmapLatLng
  Size: new (width: number, height: number) => TmapSize
  Marker: new (options: Record<string, unknown>) => TmapMarker
  Polyline: new (options: Record<string, unknown>) => TmapPolyline
  Polygon: new (options: Record<string, unknown>) => TmapPolygon
  GroundOverlay: new (options: Record<string, unknown>) => TmapGroundOverlay
  LatLngBounds: new () => TmapBounds
  base?: {
    Config?: {
      getMapVersion?: () => string
    }
  }
}

declare global {
  interface Window {
    Tmapv2?: Tmapv2Static
  }
}

// T-Map 공식 마커 아이콘 (빨강: 출발, 파랑: 도착)
const START_ICON = 'https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png'
const END_ICON = 'https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_e.png'

interface SunlightMeta {
  south: number
  west: number
  north: number
  east: number
}

export interface MapContainerProps {
  onMapReady?: (map: TmapMap) => void
}

export function MapContainer({ onMapReady }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<TmapMap | null>(null)
  const markersRef = useRef<TmapMarker[]>([])
  const polylinesRef = useRef<TmapPolyline[]>([])
  const boundaryPolygonsRef = useRef<TmapPolygon[]>([])
  const sunlightOverlayRef = useRef<TmapGroundOverlay | null>(null)
  const sunlightMetaRef = useRef<SunlightMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSatellite, setIsSatellite] = useState(false)

  const {
    startLocation,
    endLocation,
    optimalRoute,
    shadeRoute,
    showOptimal,
    showShade,
    boundary,
    setBoundary,
    sunlightTime,
  } = useRouteStore()

  // 지도 초기화 - SDK(window.Tmapv2)가 로드될 때까지 기다렸다가 생성
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const initializeMap = () => {
      if (cancelled) return

      const Tmapv2 = window.Tmapv2
      if (!mapContainer.current || !Tmapv2 || !Tmapv2.Map) {
        timer = setTimeout(initializeMap, 100)
        return
      }

      if (mapRef.current) return // 중복 생성 방지

      try {
        const map = new Tmapv2.Map(mapContainer.current, {
          center: new Tmapv2.LatLng(37.4979, 127.0276),
          width: '100%',
          height: '100%',
          zoom: 16,
        })

        // 위성 전환용 버전 조회 URL을 same-origin 프록시로 교체
        // (원본 topopentile 서버는 CORS 미지원이라 브라우저에서 XHR 차단됨)
        if (Tmapv2.base?.Config?.getMapVersion) {
          Tmapv2.base.Config.getMapVersion = () => '/api/tms-version'
        }

        mapRef.current = map
        setIsLoading(false)
        onMapReady?.(map)
      } catch (error) {
        console.error('지도 초기화 실패:', error)
        timer = setTimeout(initializeMap, 100)
      }
    }

    initializeMap()

    return () => {
      cancelled = true
      clearTimeout(timer)
      mapRef.current = null
      if (mapContainer.current) {
        mapContainer.current.innerHTML = ''
      }
    }
  }, [onMapReady])

  // 지도 유형 전환 (일반 <-> 위성 하이브리드)
  useEffect(() => {
    if (!mapRef.current || isLoading) return
    // 1=일반, 5=하이브리드(위성+도로/라벨 - 위성만(4)보다 실용적)
    mapRef.current.setMapType(isSatellite ? 5 : 1)
  }, [isSatellite, isLoading])

  // 역삼동 행정 경계 로드 (최초 1회)
  // 정적 파일(행정안전부 행정동 경계 기반) - 외부 API 의존 없이 항상 즉시 로드됨
  useEffect(() => {
    if (boundary) return
    let cancelled = false

    fetch('/boundary.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rings?: Array<Array<[number, number]>> } | null) => {
        if (!cancelled && data?.rings && data.rings.length > 0) {
          setBoundary(data.rings)
        }
      })
      .catch(() => {
        // 로드 실패 시에도 SearchBar가 주소 기반 검증으로 폴백함
      })

    return () => {
      cancelled = true
    }
  }, [boundary, setBoundary])

  // 경계 폴리곤을 연하게 표시
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading || !boundary) return

    boundaryPolygonsRef.current.forEach((polygon) => polygon.setMap(null))
    boundaryPolygonsRef.current = boundary.map(
      (ring) =>
        new Tmapv2.Polygon({
          paths: ring.map((coord) => new Tmapv2.LatLng(coord[1], coord[0])),
          strokeColor: '#EAB308', // 연한 노란색 경계
          strokeWeight: 2,
          fillColor: '#FDE047',
          fillOpacity: 0.06,
          map: mapRef.current,
        })
    )
  }, [boundary, isLoading])

  // 일조량 이미지 오버레이 (시간대별 사전 생성 이미지)
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading) return

    // 기존 오버레이 제거
    if (sunlightOverlayRef.current) {
      sunlightOverlayRef.current.setMap(null)
      sunlightOverlayRef.current = null
    }

    if (!sunlightTime) return

    let cancelled = false
    const apply = async () => {
      try {
        if (!sunlightMetaRef.current) {
          const res = await fetch('/sunlight/meta.json')
          if (!res.ok) return
          sunlightMetaRef.current = (await res.json()) as SunlightMeta
        }
        if (cancelled || !mapRef.current) return

        const meta = sunlightMetaRef.current
        const bounds = new Tmapv2.LatLngBounds()
        bounds.extend(new Tmapv2.LatLng(meta.south, meta.west))
        bounds.extend(new Tmapv2.LatLng(meta.north, meta.east))

        sunlightOverlayRef.current = new Tmapv2.GroundOverlay({
          url: `/sunlight/sunlight-${sunlightTime}.png`,
          bounds,
          opacity: 0.5,
          map: mapRef.current,
        })
      } catch {
        // 이미지 로드 실패 시 오버레이만 생략
      }
    }
    apply()

    return () => {
      cancelled = true
    }
  }, [sunlightTime, isLoading])

  // 출발/도착 마커 표시 + 지도 자동 이동
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading) return

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    if (startLocation) {
      const startMarker = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(startLocation.lat, startLocation.lng),
        icon: START_ICON,
        iconSize: new Tmapv2.Size(24, 38),
        title: `출발: ${startLocation.name}`,
        label: '출발',
        map: mapRef.current,
      })
      markersRef.current.push(startMarker)
    }

    if (endLocation) {
      const endMarker = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(endLocation.lat, endLocation.lng),
        icon: END_ICON,
        iconSize: new Tmapv2.Size(24, 38),
        title: `도착: ${endLocation.name}`,
        label: '도착',
        map: mapRef.current,
      })
      markersRef.current.push(endMarker)
    }

    // 지도 이동: 둘 다 선택되면 두 지점이 모두 보이게, 하나면 그 지점으로 이동
    if (startLocation && endLocation) {
      const bounds = new Tmapv2.LatLngBounds()
      bounds.extend(new Tmapv2.LatLng(startLocation.lat, startLocation.lng))
      bounds.extend(new Tmapv2.LatLng(endLocation.lat, endLocation.lng))
      mapRef.current.fitBounds(bounds)
    } else if (startLocation) {
      mapRef.current.panTo(
        new Tmapv2.LatLng(startLocation.lat, startLocation.lng)
      )
    } else if (endLocation) {
      mapRef.current.panTo(
        new Tmapv2.LatLng(endLocation.lat, endLocation.lng)
      )
    }
  }, [startLocation, endLocation, isLoading])

  // 경로선 표시 - 두 경로를 동시에 렌더 가능 (파랑=최적, 초록=햇빛 회피)
  // sunlightTime 의존성: 일조량 오버레이가 새로 깔린 뒤 경로선을 다시 그려
  // 선이 항상 이미지 위에 보이도록 유지
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading) return

    // 기존 경로선 제거
    polylinesRef.current.forEach((line) => line.setMap(null))
    polylinesRef.current = []

    const visible: Array<{ route: RouteResponse; color: string }> = []
    if (showOptimal && optimalRoute && optimalRoute.path.length > 0) {
      visible.push({ route: optimalRoute, color: '#1D4ED8' })
    }
    if (showShade && shadeRoute && shadeRoute.path.length > 0) {
      visible.push({ route: shadeRoute, color: '#059669' })
    }
    if (visible.length === 0) return

    const bounds = new Tmapv2.LatLngBounds()

    for (const { route, color } of visible) {
      const latLngPath = route.path.map(
        (coord) => new Tmapv2.LatLng(coord[1], coord[0])
      )

      // 아래층: 흰색 굵은 테두리선 (배경 지도와 분리)
      const casing = new Tmapv2.Polyline({
        path: latLngPath,
        strokeColor: '#FFFFFF',
        strokeWeight: 12,
        map: mapRef.current,
      })
      // 위층: 본선
      const mainLine = new Tmapv2.Polyline({
        path: latLngPath,
        strokeColor: color,
        strokeWeight: 7,
        map: mapRef.current,
      })
      polylinesRef.current.push(casing, mainLine)

      latLngPath.forEach((latlng) => bounds.extend(latlng))
    }

    // 표시된 경로 전체가 보이도록 화면 맞춤
    mapRef.current.fitBounds(bounds)
  }, [optimalRoute, shadeRoute, showOptimal, showShade, isLoading, sunlightTime])

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full bg-gray-100"
        data-testid="map-container"
      />

      {/* 위성 지도 토글 (우상단, 줌 컨트롤 왼쪽) */}
      {!isLoading && (
        <button
          onClick={() => setIsSatellite((prev) => !prev)}
          className={`absolute top-5 right-14 z-10 h-[36px] px-4 rounded-full text-[13px] tracking-[-0.2px] border backdrop-blur-xl transition active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.10)] ${
            isSatellite
              ? 'bg-[#1d1d1f] text-white border-white/20 font-semibold'
              : 'bg-white/80 text-[#1d1d1f] border-black/[0.08]'
          }`}
          aria-pressed={isSatellite}
          aria-label="위성 지도 전환"
        >
          {isSatellite ? '일반 지도' : '위성 지도'}
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full"></div>
            <p className="mt-2 text-gray-600">지도 로딩 중...</p>
          </div>
        </div>
      )}
    </div>
  )
}
