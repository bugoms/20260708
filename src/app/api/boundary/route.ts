// 역삼동 행정 경계 API - 지도 표시 및 구역 판정용

import { fetchYeoksamBoundary } from '@/utils/overpass'

export async function GET() {
  try {
    const rings = await fetchYeoksamBoundary()

    if (rings.length === 0) {
      return Response.json({ error: '경계 데이터를 찾을 수 없습니다' }, { status: 404 })
    }

    return Response.json(
      { rings },
      {
        headers: {
          // 행정 경계는 거의 변하지 않음
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      }
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
