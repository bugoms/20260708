// T-Map 위성 타일 버전 프록시
//
// SDK의 setMapType(위성/하이브리드)은 topopentile1.tmap.co.kr/tms/version.json을
// XHR로 조회하는데 해당 서버에 CORS 헤더가 없어 브라우저에서 차단된다.
// -> 서버에서 대신 받아 same-origin으로 전달 (MapContainer가 SDK의
//    getMapVersion을 이 경로로 오버라이드함)

export const dynamic = 'force-dynamic' // 빌드 시점 고정 방지 (타일 버전 갱신 대응)

export async function GET() {
  try {
    const response = await fetch(
      'https://topopentile1.tmap.co.kr/tms/version.json',
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) {
      throw new Error(`version.json HTTP ${response.status}`)
    }
    const data = (await response.json()) as { version?: string }

    return Response.json(data, {
      headers: {
        // 타일 버전은 자주 안 바뀜
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
