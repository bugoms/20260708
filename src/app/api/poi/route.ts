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

/** T-Map POI 검색 1회 호출 */
async function searchPois(
  apiKey: string,
  keyword: string,
  mode: 'accuracy' | 'distance'
): Promise<PoiResult[]> {
  const params = new URLSearchParams({
    version: '1',
    searchKeyword: keyword,
    searchType: 'all',
    page: '1',
    count: '10',
    resCoordType: 'WGS84GEO',
    reqCoordType: 'WGS84GEO',
    multiPoint: 'N',
    poiGroupYn: 'N',
  })

  if (mode === 'accuracy') {
    // 전국 정확도순 - '강남역' 같은 지명/역 검색에 강함
    params.set('searchtypCd', 'A')
  } else {
    // 역삼동 중심 거리순 - '스타벅스' 같은 브랜드 검색에 강함
    params.set('searchtypCd', 'R')
    params.set('centerLat', '37.4996')
    params.set('centerLon', '127.0333')
    params.set('radius', '3')
  }

  const response = await fetch(
    `https://apis.openapi.sk.com/tmap/pois?${params.toString()}`,
    {
      headers: { Accept: 'application/json', appKey: apiKey },
    }
  )

  // T-Map은 검색 결과가 없으면 204 No Content를 반환
  if (response.status === 204) return []
  if (!response.ok) {
    throw new Error(`T-Map POI API error: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    searchPoiInfo?: { pois?: { poi?: TmapPoi[] } }
  }
  const pois = data.searchPoiInfo?.pois?.poi || []

  return pois
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

  try {
    // 정확도순(지명에 강함) + 거리순(주변 브랜드에 강함) 병합
    const [accuracy, distance] = await Promise.allSettled([
      searchPois(apiKey, keyword, 'accuracy'),
      searchPois(apiKey, keyword, 'distance'),
    ])

    const merged: PoiResult[] = []
    const seen = new Set<string>()
    for (const result of [accuracy, distance]) {
      if (result.status !== 'fulfilled') continue
      for (const poi of result.value) {
        const key = `${poi.name}|${poi.lat.toFixed(5)}|${poi.lng.toFixed(5)}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(poi)
      }
    }

    // 서비스 구역(역삼동) 결과 우선. 역삼동 결과가 있으면 그것만,
    // 없으면 전체 반환 (선택 시 클라이언트의 경계 검증이 안내함)
    const inYeoksam = merged.filter((poi) => poi.address.includes('역삼동'))
    const results = (inYeoksam.length > 0 ? inYeoksam : merged).slice(0, 8)

    // 검색어와 이름이 일치하는 항목을 앞으로 (안정 정렬 - 기존 순서 유지)
    const normalized = keyword.replace(/\s/g, '')
    results.sort((a, b) => {
      const aMatch = a.name.replace(/\s/g, '').includes(normalized) ? 0 : 1
      const bMatch = b.name.replace(/\s/g, '').includes(normalized) ? 0 : 1
      return aMatch - bMatch
    })

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
