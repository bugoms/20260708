'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouteStore } from '@/store/routeStore'
import type { RouteResponse } from '@/types/route'

interface TmapPoint {
  lat: number
  lng: number
}

interface TmapMarker {
  lat: number
  lng: number
}

interface TmapPolyline {
  path: Array<TmapPoint>
  strokeColor: string
  strokeWeight: number
}

interface TmapMap {
  addMarker: (marker: TmapMarker & { iconHTML?: string }) => void
  addPolyline: (polyline: TmapPolyline) => void
  fitBounds: (bounds: { min: TmapPoint; max: TmapPoint }) => void
  setZoom: (zoom: number) => void
}

declare global {
  interface Window {
    Tmap: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => TmapMap
    }
  }
}

export interface MapContainerProps {
  onMapReady?: (map: TmapMap) => void
}

export function MapContainer({ onMapReady }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<TmapMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { startLocation, endLocation, optimalRoute, shadeRoute, selectedRoute } =
    useRouteStore()

  useEffect(() => {
    const initializeMap = () => {
      if (
        !mapContainer.current ||
        typeof window === 'undefined' ||
        !window.Tmap
      ) {
        setTimeout(initializeMap, 100)
        return
      }

      try {
        const map = new window.Tmap.Map(mapContainer.current, {
          center: { lat: 37.4979, lng: 127.0276 },
          zoom: 16,
          backgroundColor: 'white',
        })

        mapRef.current = map
        setIsLoading(false)
        onMapReady?.(map)
      } catch (error) {
        console.error('Failed to initialize map:', error)
        setTimeout(initializeMap, 100)
      }
    }

    const loadTmapSdk = () => {
      const appKey = process.env.NEXT_PUBLIC_TMAP_API_KEY

      if (!appKey) {
        console.error(
          'TMAP_API_KEY가 없습니다. 환경변수 NEXT_PUBLIC_TMAP_API_KEY를 설정하세요.'
        )
        setIsLoading(false)
        return
      }

      console.log('T-Map SDK 로딩 중...')

      const existingScript = document.getElementById('tmap-script')
      if (existingScript) {
        initializeMap()
        return
      }

      const script = document.createElement('script')
      script.id = 'tmap-script'
      script.src = `https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${appKey}`
      script.async = false
      script.onload = () => {
        console.log('T-Map SDK 로드 완료')
        initializeMap()
      }
      script.onerror = () => {
        console.error('T-Map SDK 로드 실패. 앱 키를 확인하세요.')
        setIsLoading(false)
      }

      document.head.appendChild(script)
    }

    loadTmapSdk()

    return () => {
      const script = document.getElementById('tmap-script')
      if (script && document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [onMapReady])

  useEffect(() => {
    if (!mapRef.current || isLoading) return

    mapRef.current.addMarker({
      lat: startLocation?.lat ?? 37.4979,
      lng: startLocation?.lng ?? 127.0276,
      iconHTML: '📍',
    })

    if (endLocation) {
      mapRef.current.addMarker({
        lat: endLocation.lat,
        lng: endLocation.lng,
        iconHTML: '🚩',
      })
    }
  }, [startLocation, endLocation, isLoading])

  useEffect(() => {
    if (!mapRef.current || isLoading) return

    const route: RouteResponse | null =
      selectedRoute === 'optimal' ? optimalRoute : shadeRoute

    if (!route) return

    const polylineColor = selectedRoute === 'optimal' ? '#3B82F6' : '#10B981'

    mapRef.current.addPolyline({
      path: route.path.map((coord) => ({
        lat: coord[1],
        lng: coord[0],
      })),
      strokeColor: polylineColor,
      strokeWeight: 4,
    })

    if (route.path.length > 0) {
      const minLat = Math.min(...route.path.map((c) => c[1]))
      const maxLat = Math.max(...route.path.map((c) => c[1]))
      const minLng = Math.min(...route.path.map((c) => c[0]))
      const maxLng = Math.max(...route.path.map((c) => c[0]))

      mapRef.current.fitBounds({
        min: { lat: minLat, lng: minLng },
        max: { lat: maxLat, lng: maxLng },
      })
    }
  }, [optimalRoute, shadeRoute, selectedRoute, isLoading])

  return (
    <div
      ref={mapContainer}
      className="w-full h-full bg-gray-100"
      data-testid="map-container"
    >
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
