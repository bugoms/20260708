import { getTmapRoute } from '@/utils/tmapService'
import type { RouteRequest } from '@/types/route'

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

    const route = await getTmapRoute(startLat, startLng, endLat, endLng, 'optimal')

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
