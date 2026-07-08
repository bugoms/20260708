import type { RouteRequest, RouteResponse } from '@/types/route'

interface TmapRouteRequest {
  startX: number
  startY: number
  endX: number
  endY: number
  reqCoordType: 'WGS84GEO'
  resCoordType: 'WGS84GEO'
  routeType: number
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
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    routeType: 1,
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
