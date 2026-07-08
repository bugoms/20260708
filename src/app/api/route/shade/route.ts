import type { RouteRequest, RouteResponse } from '@/types/route'

interface TmapRouteRequest {
  startX: number
  startY: number
  endX: number
  endY: number
  startName: string
  endName: string
  reqCoordType: 'WGS84GEO'
  resCoordType: 'WGS84GEO'
  searchOption: number
}

async function callTmapApi(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResponse> {
  const apiKey =
    process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY
  if (!apiKey) {
    throw new Error('T-Map API key is not configured')
  }

  const request: TmapRouteRequest = {
    startX: startLng,
    startY: startLat,
    endX: endLng,
    endY: endLat,
    startName: encodeURIComponent('출발'),
    endName: encodeURIComponent('도착'),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption: 4,
  }

  const response = await fetch(
    'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appKey: apiKey,
      },
      body: JSON.stringify(request),
    }
  )

  if (!response.ok) {
    throw new Error(`T-Map API error: ${response.statusText}`)
  }

  const data = await response.json() as Record<string, unknown>
  const features = (data.features as Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> | undefined) || []

  if (features.length === 0) {
    throw new Error('No route found')
  }

  // 전체 거리/시간은 첫 Point feature의 totalDistance/totalTime에 담겨 있음
  const summary = features[0].properties || {}
  const distance = (summary.totalDistance as number) || 0
  const duration = (summary.totalTime as number) || 0

  // 경로선은 여러 LineString feature에 나뉘어 있으므로 모두 합침
  const path: Array<[number, number]> = []
  for (const feature of features) {
    if (feature.geometry?.type === 'LineString') {
      const coords = feature.geometry.coordinates as Array<[number, number]>
      path.push(...coords)
    }
  }

  return {
    path,
    distance,
    duration,
    shadeScore: 75,
  }
}

export async function POST(request: Request) {
  try {
    const body: RouteRequest = await request.json()

    const { startLat, startLng, endLat, endLng } = body

    if (!startLat || !startLng || !endLat || !endLng) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const route = await callTmapApi(startLat, startLng, endLat, endLng)

    return Response.json(route, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json(
      { error: message },
      { status: 500 }
    )
  }
}
