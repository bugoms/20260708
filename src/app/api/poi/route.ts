import type { PoiResult } from '@/types/route'

interface TmapPoi {
  name: string
  frontLat?: string
  frontLon?: string
  noorLat?: string
  noorLon?: string
  upperAddrName?: string
  middleAddrName?: string
  lowerAddrName?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')?.trim()

  if (!keyword) {
    return Response.json(
      { error: 'keyword 파라미터가 필요합니다.' },
      { status: 400 }
    )
  }

  const apiKey =
    process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'T-Map API key is not configured' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    version: '1',
    searchKeyword: keyword,
    searchType: 'all',
    searchtypCd: 'A',
    page: '1',
    count: '5',
    resCoordType: 'WGS84GEO',
    reqCoordType: 'WGS84GEO',
    multiPoint: 'N',
    poiGroupYn: 'N',
  })

  try {
    const response = await fetch(
      `https://apis.openapi.sk.com/tmap/pois?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          appKey: apiKey,
        },
      }
    )

    // T-Map은 검색 결과가 없으면 204 No Content를 반환
    if (response.status === 204) {
      return Response.json({ results: [] })
    }

    if (!response.ok) {
      throw new Error(`T-Map POI API error: ${response.statusText}`)
    }

    const data = (await response.json()) as {
      searchPoiInfo?: { pois?: { poi?: TmapPoi[] } }
    }
    const pois = data.searchPoiInfo?.pois?.poi || []

    const results: PoiResult[] = pois
      .map((poi) => {
        // frontLat/frontLon(정문 좌표) 우선, 없으면 noorLat/noorLon(중심 좌표)
        const lat = parseFloat(poi.frontLat || poi.noorLat || '0')
        const lng = parseFloat(poi.frontLon || poi.noorLon || '0')
        const address = [
          poi.upperAddrName,
          poi.middleAddrName,
          poi.lowerAddrName,
        ]
          .filter(Boolean)
          .join(' ')

        return { name: poi.name, lat, lng, address }
      })
      .filter((poi) => poi.lat !== 0 && poi.lng !== 0)

    return Response.json(
      { results },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
