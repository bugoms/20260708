'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { pointInPolygon } from '@/utils/geo'
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
  getPosition: () => TmapLatLng
  setPosition: (latlng: TmapLatLng) => void
}

interface TmapPolyline {
  setMap: (map: TmapMap | null) => void
}

interface TmapPolygon {
  setMap: (map: TmapMap | null) => void
}

interface TmapBounds {
  extend: (latlng: TmapLatLng) => void
}

interface TmapMap {
  fitBounds: (bounds: TmapBounds) => void
  setZoom: (zoom: number) => void
  setCenter: (latlng: TmapLatLng) => void
}

interface Tmapv2Static {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => TmapMap
  LatLng: new (lat: number, lng: number) => TmapLatLng
  Size: new (width: number, height: number) => TmapSize
  Marker: new (options: Record<string, unknown>) => TmapMarker
  Polyline: new (options: Record<string, unknown>) => TmapPolyline
  Polygon: new (options: Record<string, unknown>) => TmapPolygon
  LatLngBounds: new () => TmapBounds
  event: {
    addListener: (
      target: unknown,
      eventType: string,
      handler: () => void
    ) => void
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

export interface MapContainerProps {
  onMapReady?: (map: TmapMap) => void
}

export function MapContainer({ onMapReady }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<TmapMap | null>(null)
  const markersRef = useRef<TmapMarker[]>([])
  const polylinesRef = useRef<TmapPolyline[]>([])
  const boundaryPolygonsRef = useRef<TmapPolygon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const {
    startLocation,
    endLocation,
    optimalRoute,
    shadeRoute,
    selectedRoute,
    boundary,
    setBoundary,
    setStartLocation,
    setEndLocation,
    setAreaAlert,
  } = useRouteStore()

  /** 좌표가 서비스 구역 안인지 (경계 미로드 시 통과) */
  const isInArea = (lat: number, lng: number): boolean => {
    if (!boundary || boundary.length === 0) return true
    return boundary.some((ring) =>
      pointInPolygon(
        { lat, lng },
        ring.map((c) => ({ lat: c[1], lng: c[0] }))
      )
    )
  }

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

  // 역삼동 행정 경계 로드 (최초 1회)
  useEffect(() => {
    if (boundary) return
    let cancelled = false

    fetch('/api/boundary')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rings?: Array<Array<[number, number]>> } | null) => {
        if (!cancelled && data?.rings && data.rings.length > 0) {
          setBoundary(data.rings)
        }
      })
      .catch(() => {
        // 경계 로드 실패 시 표시/검증만 생략 (서비스는 정상 동작)
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

  // 출발/도착 마커 표시 + 지도 자동 이동
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading) return

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    // 마커 드래그 종료 처리: 경계 검증 -> 역지오코딩 주소를 입력값에 자동 반영
    // (위치 setter가 기존 경로선을 자동 제거함 - 선은 버튼 클릭 시에만 생성)
    const handleDragEnd = async (
      marker: TmapMarker,
      kind: 'start' | 'end',
      original: { lat: number; lng: number }
    ) => {
      const pos = marker.getPosition()
      const lat = pos.lat()
      const lng = pos.lng()

      if (!isInArea(lat, lng)) {
        setAreaAlert(
          '이동한 위치가 역삼동을 벗어났어요. 마커를 원래 위치로 되돌립니다.'
        )
        marker.setPosition(new Tmapv2.LatLng(original.lat, original.lng))
        return
      }

      // 역지오코딩으로 실제 주소를 가져와 입력값으로 사용
      let name =
        kind === 'start' ? '지도에서 지정한 출발지' : '지도에서 지정한 도착지'
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
        if (res.ok) {
          const data = (await res.json()) as { name?: string }
          if (data.name) name = data.name
        }
      } catch {
        // 주소 조회 실패 시 기본 이름 사용
      }

      if (kind === 'start') {
        setStartLocation({ name, lat, lng })
      } else {
        setEndLocation({ name, lat, lng })
      }
    }

    if (startLocation) {
      const startMarker = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(startLocation.lat, startLocation.lng),
        icon: START_ICON,
        iconSize: new Tmapv2.Size(24, 38),
        title: `출발: ${startLocation.name} (드래그로 이동 가능)`,
        label: '출발',
        draggable: true,
        map: mapRef.current,
      })
      Tmapv2.event.addListener(startMarker, 'dragend', () =>
        handleDragEnd(startMarker, 'start', {
          lat: startLocation.lat,
          lng: startLocation.lng,
        })
      )
      markersRef.current.push(startMarker)
    }

    if (endLocation) {
      const endMarker = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(endLocation.lat, endLocation.lng),
        icon: END_ICON,
        iconSize: new Tmapv2.Size(24, 38),
        title: `도착: ${endLocation.name} (드래그로 이동 가능)`,
        label: '도착',
        draggable: true,
        map: mapRef.current,
      })
      Tmapv2.event.addListener(endMarker, 'dragend', () =>
        handleDragEnd(endMarker, 'end', {
          lat: endLocation.lat,
          lng: endLocation.lng,
        })
      )
      markersRef.current.push(endMarker)
    }

    // 지도 이동: 둘 다 선택되면 두 지점이 모두 보이게, 하나면 그 지점으로 이동
    if (startLocation && endLocation) {
      const bounds = new Tmapv2.LatLngBounds()
      bounds.extend(new Tmapv2.LatLng(startLocation.lat, startLocation.lng))
      bounds.extend(new Tmapv2.LatLng(endLocation.lat, endLocation.lng))
      mapRef.current.fitBounds(bounds)
    } else if (startLocation) {
      mapRef.current.setCenter(
        new Tmapv2.LatLng(startLocation.lat, startLocation.lng)
      )
    } else if (endLocation) {
      mapRef.current.setCenter(
        new Tmapv2.LatLng(endLocation.lat, endLocation.lng)
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocation, endLocation, isLoading, boundary])

  // 경로선 표시 (흰색 테두리 + 본선 이중 구조로 가시성 확보)
  useEffect(() => {
    const Tmapv2 = window.Tmapv2
    if (!mapRef.current || !Tmapv2 || isLoading) return

    const route: RouteResponse | null =
      selectedRoute === 'optimal' ? optimalRoute : shadeRoute

    // 기존 경로선 제거
    polylinesRef.current.forEach((line) => line.setMap(null))
    polylinesRef.current = []

    if (!route || route.path.length === 0) return

    const latLngPath = route.path.map(
      (coord) => new Tmapv2.LatLng(coord[1], coord[0])
    )

    const mainColor = selectedRoute === 'optimal' ? '#1D4ED8' : '#059669'

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
      strokeColor: mainColor,
      strokeWeight: 7,
      map: mapRef.current,
    })

    polylinesRef.current = [casing, mainLine]

    // 경로 전체가 보이도록 화면 맞춤
    const bounds = new Tmapv2.LatLngBounds()
    latLngPath.forEach((latlng) => bounds.extend(latlng))
    mapRef.current.fitBounds(bounds)
  }, [optimalRoute, shadeRoute, selectedRoute, isLoading])

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full bg-gray-100"
        data-testid="map-container"
      />
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
