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
  LatLngBounds: new () => TmapBounds
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
  const [isLoading, setIsLoading] = useState(true)

  const { startLocation, endLocation, optimalRoute, shadeRoute, selectedRoute } =
    useRouteStore()

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
      mapRef.current.setCenter(
        new Tmapv2.LatLng(startLocation.lat, startLocation.lng)
      )
    } else if (endLocation) {
      mapRef.current.setCenter(
        new Tmapv2.LatLng(endLocation.lat, endLocation.lng)
      )
    }
  }, [startLocation, endLocation, isLoading])

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
