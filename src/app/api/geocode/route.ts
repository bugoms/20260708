// 역지오코딩 API - 좌표 -> 주소 (마커 드래그 시 입력값 자동 채움용)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return Response.json(
      { error: 'lat, lng 파라미터가 필요합니다.' },
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
    const params = new URLSearchParams({
      version: '1',
      lat,
      lon: lng,
      coordType: 'WGS84GEO',
      addressType: 'A10',
    })

    const response = await fetch(
      `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?${params.toString()}`,
      {
        headers: { Accept: 'application/json', appKey: apiKey },
      }
    )

    if (!response.ok) {
      throw new Error(`T-Map geocoding error: ${response.statusText}`)
    }

    const data = (await response.json()) as {
      addressInfo?: { fullAddress?: string }
    }
    const fullAddress = data.addressInfo?.fullAddress || ''

    // fullAddress는 "행정동주소,지번주소,도로명주소" 형태 - 도로명(마지막)이 가장 읽기 좋음
    const parts = fullAddress.split(',')
    const best = (parts[parts.length - 1] || fullAddress)
      .replace('서울특별시 강남구 ', '')
      .trim()

    return Response.json(
      { name: best || '지도에서 지정한 위치', fullAddress },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      }
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
