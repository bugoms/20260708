import type { RouteResponse, RouteRequest } from '@/types/route'

export async function getTmapRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  routeType: 'optimal' | 'shade'
): Promise<RouteResponse> {
  const request: RouteRequest = {
    startLat,
    startLng,
    endLat,
    endLng,
    routeType,
  }

  const endpoint = routeType === 'optimal' ? '/api/route/optimal' : '/api/route/shade'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorData = await response.json() as { error?: string }
    throw new Error(`경로 조회 실패: ${errorData.error || response.statusText}`)
  }

  const data = await response.json() as RouteResponse
  return data
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
