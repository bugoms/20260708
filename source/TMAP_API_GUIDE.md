# T-Map API 활용 가이드

## 출처
https://tmap-skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4

## 보행자 경로 API 엔드포인트

```
POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json
```

## 요청 파라미터

### 필수 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|---------|------|------|------|
| `startX` | Double | 출발지 경도 (WGS84) | 127.027610 |
| `startY` | Double | 출발지 위도 (WGS84) | 37.497923 |
| `endX` | Double | 도착지 경도 (WGS84) | 127.032452 |
| `endY` | Double | 도착지 위도 (WGS84) | 37.500629 |

### 선택 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|---------|------|------|--------|
| `routeType` | Integer | 경로 타입 | 1 |
| `reqCoordType` | String | 요청 좌표 시스템 | WGS84GEO |
| `resCoordType` | String | 응답 좌표 시스템 | WGS84GEO |
| `startName` | String | 출발지 이름 | - |
| `endName` | String | 도착지 이름 | - |

## 경로 타입 (routeType)

| 값 | 설명 | 사용 시점 |
|----|------|---------|
| 1 | 최단거리 | 가장 짧은 거리 |
| 2 | 최빠름 | 가장 빠른 시간 |
| 32 | 보행자 우선 | **그늘길 추천** |

**프로젝트 적용:**
- `최적의 길`: routeType = 1 (최단거리)
- `햇빛 피하는 길`: routeType = 32 (보행자 전용도로 우선, 더 안전한 경로)

## 응답 포맷

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [127.027610, 37.497923],
          [127.028000, 37.498200],
          ...
          [127.032452, 37.500629]
        ]
      },
      "properties": {
        "distance": 582,
        "duration": 413,
        "name": "경로명"
      }
    }
  ]
}
```

## 응답 필드 설명

| 필드 | 타입 | 설명 | 단위 |
|------|------|------|------|
| `distance` | Integer | 경로 거리 | 미터 (m) |
| `duration` | Integer | 소요 시간 | 초 (s) |
| `coordinates` | Array | [경도, 위도] 배열 | WGS84 |

## TypeScript 사용 예제

```typescript
interface TmapRouteRequest {
  startX: number        // 출발지 경도
  startY: number        // 출발지 위도
  endX: number          // 도착지 경도
  endY: number          // 도착지 위도
  routeType: number     // 경로 타입 (1 또는 32)
  reqCoordType: 'WGS84GEO'
  resCoordType: 'WGS84GEO'
}

interface TmapRouteResponse {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
    properties: {
      distance: number
      duration: number
      name: string
    }
  }>
}
```

## 실제 구현 위치

**파일**: `src/utils/tmapService.ts`

```typescript
export async function getTmapRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  routeType: 'optimal' | 'shade'
): Promise<RouteResponse> {
  const tmapRouteType = routeType === 'optimal' ? 1 : 32
  
  const response = await fetch(
    'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appKey': TMAP_API_KEY,
      },
      body: JSON.stringify({
        startX: startLng,
        startY: startLat,
        endX: endLng,
        endY: endLat,
        routeType: tmapRouteType,
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
      }),
    }
  )
  
  const data = await response.json()
  return parseTmapResponse(data, routeType)
}
```

## API 호출 흐름

```
사용자 입력
    ↓
SearchBar.tsx (출발지, 도착지 선택)
    ↓
useRoute.ts (fetchRoute 함수)
    ↓
tmapService.ts (getTmapRoute)
    ↓
T-Map API 서버
    ↓
응답 파싱
    ↓
MapContainer.tsx (지도에 경로 표시)
    ↓
RouteDetails.tsx (거리, 시간 표시)
```

## 에러 처리

T-Map API에서 반환할 수 있는 주요 에러:

| 상태 코드 | 설명 |
|----------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (필수 파라미터 누락) |
| 401 | 인증 실패 (API 키 오류) |
| 403 | 접근 거부 |
| 500 | 서버 오류 |

**처리 코드** (`src/hooks/useRoute.ts`):
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : '경로를 불러오는 중 오류가 발생했습니다.'
  setError(message)
}
```

## 주의사항

1. **API 키 관리**: `.env.local` 파일에 안전하게 보관
2. **좌표 순서**: startX는 경도, startY는 위도 (주의!)
3. **좌표계**: WGS84 (GPS) 좌표계 사용
4. **Rate Limiting**: 무료 요청 한도는 일 500,000건
5. **캐싱**: 동일한 경로는 1시간 캐싱

## 개발 과정 중 테스트

cURL 명령어로 API 테스트:

```bash
curl -X POST 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json' \
  -H 'appKey: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "startX": 127.027610,
    "startY": 37.497923,
    "endX": 127.032452,
    "endY": 37.500629,
    "routeType": 1,
    "reqCoordType": "WGS84GEO",
    "resCoordType": "WGS84GEO"
  }'
```

## 참고 링크

- [T-Map 공식 문서](https://tmap-skopenapi.readme.io/)
- [보행자 경로 API](https://tmap-skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4)
- [T-Map 개발자 센터](https://openapi.sk.com/)
