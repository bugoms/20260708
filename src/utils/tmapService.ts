import type { RouteResponse } from '@/types/route'

const TMAP_API_KEY = process.env.NEXT_PUBLIC_TMAP_API_KEY || ''

export interface TmapRouteRequest {
  startX: number
  startY: number
  endX: number
  endY: number
  reqCoordType: 'WGS84GEO'
  resCoordType: 'WGS84GEO'
  routeType: number
}

export async function getTmapRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  routeType: 'optimal' | 'shade'
): Promise<RouteResponse> {
  const tmapRouteType = routeType === 'optimal' ? 1 : 32

  const request: TmapRouteRequest = {
    startX: startLng,
    startY: startLat,
    endX: endLng,
    endY: endLat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    routeType: tmapRouteType,
  }

  const response = await fetch(
    'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appKey: TMAP_API_KEY,
      },
      body: JSON.stringify(request),
    }
  )

  if (!response.ok) {
    throw new Error(`T-map API error: ${response.statusText}`)
  }

  const data = await response.json()

  return parseTmapResponse(data, routeType)
}

function parseTmapResponse(
  data: Record<string, unknown>,
  routeType: 'optimal' | 'shade'
): RouteResponse {
  const features = (data.features as Array<{ geometry?: { coordinates?: Array<[number, number]> }; properties?: Record<string, unknown> }> | undefined) || []

  if (features.length === 0) {
    throw new Error('No route found')
  }

  const route = features[0]
  const coordinates = route.geometry?.coordinates || []
  const properties = route.properties || {}

  const distance = (properties.distance as number) || 0
  const duration = (properties.duration as number) || 0

  return {
    path: coordinates,
    distance,
    duration,
    shadeScore: routeType === 'shade' ? 75 : undefined,
  }
}
