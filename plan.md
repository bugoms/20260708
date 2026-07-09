# 사용자 편의 길 추천 서비스 웹사이트 - 상세 구현 플랜

## 1. 프로젝트 개요

### 서비스 목표

- **타겟 사용자**: 강남구 역삼동 거주자 (특히 여름철 햇빛 회피 필요)
- **핵심 가치 제안**: 최적의 길뿐만 아니라 햇빛을 피할 수 있는 그늘 길 추천
- **주요 기능**: 경로 최적화 + 햇빛 차단도 (쉐이딩, 건물 음영, 나무그늘 등)

### 차별성

- 기존 지도 앱(네이버맵, 카카오맵)은 최단/최빠른 경로만 제공
- 우리는 **여름철 햇빛 회피** 특화 서비스로 차별화
- 강남구 역삼동의 지형적 특성(고층 건물, 가로수 등) 활용

### 중요한 제약 조건

- **경로 계산 규칙**: 경로는 **실제 보행 가능한 도로**만을 따라야 하며, 건물을 관통해서는 안됨
- **횡단보도 준수**: 차도를 건너야 할 경우 반드시 횡단보도를 통해서만 경로를 설정
- **버튼 구별**: [⚡ 최적의 길]과 [🌳 햇빛 피하는 길]은 UI 상에서 명확하게 구별되어야 함

---

## 2. 핵심 기능 정의

### 2.1 지도 기반 경로 추천

```
[출발지] ─→ [도착지]
            ↓
    ┌─────────────────┐
    │  경로 탐색 엔진  │
    └─────────────────┘
            ↓
    ┌──────────────────────────┐
    │ [최적 경로] [그늘길 경로]  │ ← 두 개의 버튼
    └──────────────────────────┘
            ↓
    ┌──────────────────────────────┐
    │    지도 위에 경로 시각화      │
    │  - 최적 경로: 파란색 선      │
    │  - 그늘길: 녹색 선 (음영표시) │
    └──────────────────────────────┘
```

### 2.2 경로 선택 버튼

- **[⚡ 최적의 길]**: 최단거리 또는 최단시간 기반 경로 (실제 도로만 따라 건물 관통 금지)
- **[🌳 햇빛 피하는 길]**: 그늘 점수(Shade Score)가 높은 경로 (실제 도로만 따라 건물 관통 금지)

#### 경로 계산 엄격한 규칙

- ❌ 건물 내부 또는 건물을 관통하는 경로 금지
- ✅ OpenStreetMap의 도로 네트워크(Way) 데이터만 사용
- ✅ 차도 횡단 시 반드시 횡단보도(Crossing) 노드 경유
- ✅ 보행자 전용 도로 우선 활용

### 2.3 지하 보행 경로 (지하철역 지하보도) ✅ 구현 완료

역삼동 관문 3개 역(신논현역·선정릉역·선릉역)의 지하보도망을 경로 그래프에 통합:

- **데이터**: `src/data/underground.json` — 출입구 26곳은 OSM `railway=subway_entrance` 실측 좌표, 내부 통로·엘리베이터는 역 구내 안내도 기반
- **주입 방식**: `fetchWalkData`가 OSM 보행 그래프에 지하 노드(음수 id)·엣지를 합성 (`src/utils/underground.ts`)
- **비용 모델**:
  - 지하 통로 = 완전 그늘 (엣지 비용 45%, 낮에만) → 한낮 대로 구간에서 A\*가 알아서 지하로 꿰어감
  - 출입구 계단 = 비용 +20m 상당, 소요시간 +25초/회 → 완전 노출 약 73m 이상이면 지하가 이김
  - 출입구는 맞은편 보도 선분 위 투영점(분할 노드)에 연결 - 실제 진입 기하와 일치
  - 출입구 연결은 대로 센터라인을 가로지르지 않는 보도 선분에만 부착 (무단횡단 지름길 방지)
- **구역 제한**: 역삼동 경계(단일 폴리곤) 밖 30m를 넘는 지상 엣지는 그래프에서 제외 → 경로가 구역 밖 블록을 관통하지 않음 (경계 도로의 보도/횡단보도는 완충으로 유지, 지하보도는 예외)
- **채점**: 지하 구간은 그늘 100%로 계산, UI에 "지하보도 %" 및 "OO역 지하보도 통과" 표시
- **검증**: `npx tsx scripts/test-underground.mts` (선릉역 한낮 케이스)

### 2.4 그늘 점수 계산 알고리즘

경로상 각 지점에서:

- **건물 음영**: 태양 방위각 기반으로 주변 건물이 만드는 그늘 계산
- **가로수**: 도로변 수목의 밀도 및 높이
- **포장 재질**: 아스팔트 vs 투수성 포장 (열흡수율)
- **시간대 가중치**: 현재 시간의 태양 고도각 반영 (사용자 제공 일조량 데이터 통합)

```
그늘점수 = (건물음영도 × 0.4) + (가로수밀도 × 0.35) + (포장재질 × 0.15) + (시간가중치 × 0.1)
범위: 0 ~ 100 (높을수록 좋음)
```

#### 데이터 소스 및 수집 방법

| 데이터             | 출처                           | 상세 정보                                                          |
| ------------------ | ------------------------------ | ------------------------------------------------------------------ |
| **건물 높이 정보** | 강남구청 GIS 데이터            | URL: http://www.gangnam.go.kr/ → 정보공개 → GIS 공간정보           |
|                    | OpenStreetMap Building Layer   | URL: https://www.openstreetmap.org (building:height 태그)          |
|                    | 국토부 건축물대장              | URL: https://www.vworld.go.kr (Vworld API 활용)                    |
| **가로수 정보**    | 서울시 공공데이터 포털         | URL: https://data.seoul.go.kr → "가로수" 검색 → CSV 다운로드       |
|                    | 강남구청 가로수 관리현황       | URL: http://www.gangnam.go.kr → 공보실 → 통계자료                  |
| **포장 재질**      | 서울시 도로정보                | URL: https://data.seoul.go.kr → "도로포장" 데이터셋                |
| **태양 위치**      | NOAA Solar Position Calculator | URL: https://gml.noaa.gov/grad/solcalc (실시간 태양 위치)          |
|                    | Pysolar 라이브러리             | Python: `pip install pysolar`                                      |
| **일조량**         | 기상청 기후자료개발포털        | URL: https://www.kma.go.kr/climate → 강남구 역삼동 평균 일조시간   |
|                    | 사용자 제공 데이터 파일        | 📄 역삼동*보도별*일조시간.csv / 역삼동*보도일도\_10m단위*정리.xlsx |
|                    | 사용자 입력 데이터             | 앱 설정에서 지역별 일조량 커스터마이징 가능                        |

**⚡ 중요**: 일조량 데이터는 사용자가 제공한 `역삼동*보도별*일조시간.csv`와 `역삼동*보도일도_10m단위*정리.xlsx` 파일을 우선 활용합니다. 이 파일들은 강남구 역삼동의 보도(도로) 단위 및 10m 단위 격자 기반 실측 일조시간 데이터를 포함하고 있어 매우 정확합니다.

---

## 3. 기술 스택

### 프론트엔드

- **UI 프레임워크**: React 18+
- **지도 라이브러리**: **카카오맵 API vs 티맵(T-Map) API 비교**

#### 카카오맵 API vs 티맵 API 상세 비교

| 항목                 | 카카오맵 API                | 티맵(T-Map) API                 | 추천                      |
| -------------------- | --------------------------- | ------------------------------- | ------------------------- |
| **경로 계산 정확도** | 우수 (SKT 자체 데이터)      | 우수 (KT 지도 기반)             | 동등                      |
| **경로 유형**        | 최단, 최빠름, 걷기 등 3가지 | 최단, 최빠름, 보행자용 등 4가지 | ✅ **티맵** (보행자 특화) |
| **횡단보도 데이터**  | 제한적                      | 포괄적                          | ✅ **티맵**               |
| **보행자 전용도로**  | 기본 지원                   | 전문적 지원                     | ✅ **티맵**               |
| **실시간 교통 정보** | 우수                        | 우수                            | 동등                      |
| **API 문서**         | 매우 상세                   | 상세                            | ✅ **카카오맵**           |
| **개발자 커뮤니티**  | 매우 활발                   | 중간 정도                       | ✅ **카카오맵**           |
| **무료 요청 한도**   | 일 300,000건                | 일 500,000건                    | ✅ **티맵**               |
| **가격 (초과시)**    | 요청당 0.9원                | 요청당 1.2원                    | ✅ **카카오맵**           |
| **보행 경로 전문성** | 중간                        | 높음                            | ✅ **티맵**               |

**권장 선택: 티맵(T-Map) API**

- 이유: 보행자 경로 전문화, 횡단보도 데이터 정확, 보행자 전용도로 지원이 우수하며, 이 프로젝트의 "건물 관통 금지 + 횡단보도 경유" 요구사항에 최적화됨

#### 카카오맵 선택시

```javascript
// 카카오맵 로드
<script
  type="text/javascript"
  src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KEY"
></script>
// 장점: 문서가 더 자세하고 개발자 리소스 많음
```

#### 티맵(T-Map) API - 확정 선택 ✅

```javascript
// 티맵 로드
<script
  type="text/javascript"
  src="https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=YOUR_KEY"
></script>
// 장점: 보행자 경로에 특화, 횡단보도 데이터 정확, 건물 관통 금지 자동 준수
```

**선택 이유:**

- ✅ 보행자 경로 최적화 (보행자 전용도로 우선)
- ✅ 횡단보도 데이터 포괄적 (자동 반영)
- ✅ 건물을 관통하지 않는 경로만 제공 (프로젝트 필수 요구사항)
- ✅ 무료 요청 한도 높음 (일 500,000건)
- ✅ 한국 지도 정확도 우수

- **상태관리**: Zustand 또는 Context API
- **스타일링**: Tailwind CSS + 반응형 디자인
- **경로 표시**: 선택한 지도 API의 경로 레이어 + Custom Canvas (그늘 시각화용)

### 백엔드

- **서버**: Node.js + Express (Vercel 배포에 최적화)
- **배포 플랫폼**: Vercel (https://vercel.com)
  - GitHub 저장소 연동 자동 배포
  - 환경 변수 관리 (API 키, DB 연결 정보 등)
  - Serverless Functions로 경로 계산 API 구현
  - Edge Functions로 전 지역 최소 지연 보장
  - 자동 HTTPS 지원

**Vercel 배포 구조:**

```
GitHub Repository
     ↓ (자동 동기화)
Vercel Project
├── Frontend (React) → Vercel Hosting
├── API Routes (/api/route/*, /api/shade/*) → Serverless Functions
└── Environment Variables (API_KEYS, DB_URL, etc.)
```

- **경로 계산**: OSRM (Open Source Routing Machine) + Custom Shade Engine
  - OSRM을 자체 서버에 배포하거나 OSRM Public API 사용
  - 또는 티맵 API의 경로 계산 엔드포인트 활용
- **데이터베이스**: PostgreSQL + PostGIS (지리정보처리)
  - 외부 호스팅: AWS RDS, Google Cloud SQL, Supabase (PostgreSQL 관리형) 추천
  - Supabase 사용시 장점: Vercel과 통합 용이, PostGIS 지원, 무료 티어 제공
- **캐싱**: Redis (자주 조회하는 경로 캐싱)
  - Upstash Redis (Vercel 호환성 우수)
- **태양 위치 계산**: Python 라이브러리 (pysolar, ephem) 또는 API
  - Vercel Serverless에서 Python 함수 실행 가능 (with Python runtime)

### 데이터 소스 및 출처 명시

| 데이터                     | 소스                   | 출처 URL                          | 형식              | 비고                        |
| -------------------------- | ---------------------- | --------------------------------- | ----------------- | --------------------------- |
| **기본 지도**              | 티맵(T-Map) API        | https://openapi.sk.com/tmap       | API               | 경로 표시용                 |
| **도로 네트워크**          | OpenStreetMap          | https://www.openstreetmap.org     | GeoJSON/OSM XML   | 경로 계산용                 |
| **건물 정보**              | 강남구청 GIS           | http://www.gangnam.go.kr          | Shapefile/GeoJSON | 건물 높이 및 폴리곤         |
| **건물 정보 (보조)**       | OpenStreetMap Building | https://www.openstreetmap.org     | OSM 태그          | building:height 태그 활용   |
| **건물 정보 (고정밀)**     | 국토부 Vworld          | https://www.vworld.go.kr          | API/Shapefile     | 건축물대장 데이터 (유료)    |
| **가로수 정보**            | 서울시 공공데이터      | https://data.seoul.go.kr          | CSV               | "가로수 현황" 데이터셋      |
| **가로수 정보 (강남)**     | 강남구청               | http://www.gangnam.go.kr          | CSV/Excel         | 강남구 가로수 관리현황      |
| **도로 포장재질**          | 서울시 공공데이터      | https://data.seoul.go.kr          | CSV               | "도로포장" 데이터셋         |
| **태양 위치**              | NOAA                   | https://gml.noaa.gov/grad/solcalc | API               | 실시간 태양 방위각/고도각   |
| **태양 위치 (라이브러리)** | Pysolar                | https://pypi.org/project/pysolar  | Python 패키지     | `pip install pysolar`       |
| **일조량 데이터**          | 기상청                 | https://www.kma.go.kr/climate     | 통계 자료         | 강남구 역삼동 평균 일조시간 |
| **횡단보도 데이터**        | 티맵 API               | https://openapi.sk.com/tmap       | API               | 경로 계산에 자동 반영       |

---

## 4. 아키텍처 설계

### 4.1 시스템 아키텍처

```
┌──────────────────────┐
│   클라이언트 (웹)     │
│  (React + Leaflet)   │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────────┐
│ 지도    │   │ 경로 추천   │
│ API    │   │  API       │
└────────┘   └────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼─────┐    ┌─────▼──────┐
    │ 경로계산  │    │ 그늘점수   │
    │ 엔진     │    │ 계산 엔진   │
    │ (OSRM)  │    │(Custom)    │
    └────┬─────┘    └─────┬──────┘
         │                 │
    ┌────┴─────────────────┴──────┐
    │                              │
 ┌──▼──────────┐         ┌────────▼───┐
 │ PostgreSQL  │         │   Redis    │
 │ + PostGIS   │         │ (캐싱)     │
 └─────────────┘         └────────────┘
```

### 4.2 API 엔드포인트 설계

```
POST /api/route/optimal
  입력: { startLat, startLng, endLat, endLng, time? }
  출력: { path, distance, duration, coordinates[] }

POST /api/route/shade
  입력: { startLat, startLng, endLat, endLng, time? }
  출력: { path, distance, duration, shadeScore, coordinates[] }

GET /api/shade-info/{lat}/{lng}
  출력: { shadeScore, buildingShadow, trees, temperature }

GET /api/sun-position/{time}
  출력: { azimuth (방위각), altitude (고도각) }
```

---

## 5. 핵심 컴포넌트 설계

### 5.1 프론트엔드 컴포넌트 구조

```
App
├── MapContainer
│   ├── MapView (Leaflet)
│   ├── RouteLayer (경로 표시)
│   └── MarkerLayer (출발/도착지)
├── SearchBar
│   ├── StartLocationInput
│   └── EndLocationInput
├── RouteOptionButtons
│   ├── OptimalButton
│   └── ShadeButton
├── RouteDetails
│   ├── DistanceInfo
│   ├── TimeInfo
│   └── ShadeScoreBar (그늘길일 때만)
└── Settings
    └── ThemeToggle, UserPreferences
```

### 5.2 상태관리 (Zustand)

```javascript
store = {
  // 입력
  startLocation: { lat, lng, name },
  endLocation: { lat, lng, name },

  // 선택된 경로
  selectedRoute: "optimal" | "shade",

  // 조회된 결과
  optimalRoute: { path, distance, duration },
  shadeRoute: { path, distance, duration, shadeScore },

  // UI 상태
  isLoading: boolean,
  error: string | null,
  currentTime: timestamp,
};
```

---

## 6. 데이터 모델

### 6.1 주요 엔티티

```sql
-- 경로 캐시 테이블
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  start_point GEOMETRY(Point, 4326),
  end_point GEOMETRY(Point, 4326),
  route_type VARCHAR(20), -- 'optimal', 'shade'
  path_coordinates GEOMETRY(LineString, 4326),
  distance_m FLOAT,
  duration_sec INT,
  shade_score FLOAT, -- NULL if optimal
  created_at TIMESTAMP,
  valid_until TIMESTAMP
);

-- 건물 정보 (GIS)
CREATE TABLE buildings (
  id SERIAL PRIMARY KEY,
  geometry GEOMETRY(Polygon, 4326),
  height_m FLOAT,
  building_type VARCHAR(50),
  shadow_coverage FLOAT
);

-- 가로수 정보
CREATE TABLE trees (
  id SERIAL PRIMARY KEY,
  location GEOMETRY(Point, 4326),
  tree_species VARCHAR(100),
  height_m FLOAT,
  canopy_radius_m FLOAT,
  planting_date DATE
);

-- 사용자 경로 기록 (선택사항)
CREATE TABLE user_routes (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  start_point GEOMETRY(Point, 4326),
  end_point GEOMETRY(Point, 4326),
  route_type VARCHAR(20),
  temperature_C FLOAT,
  feedback FLOAT, -- 1~5 별점
  created_at TIMESTAMP
);
```

---

## 7. 그늘 길 알고리즘 상세

### 7.1 건물 음영 계산

```
1. 태양 위치 계산
   - 현재 시간, 위도/경도 → 태양 방위각(azimuth), 고도각(altitude)

2. 경로상 각 지점마다:
   - 주변 건물 탐색 (반경 50m)
   - 태양 방위각 기반으로 건물이 만드는 그늘 영역 계산
   - 사용자가 지나가는 경로가 그늘에 몇% 겹치는지 계산

3. 건물 높이 데이터 활용
   - 높은 건물 → 더 긴 그늘
   - 태양 고도각이 낮을수록 → 더 긴 그늘
```

### 7.2 가로수 밀도 계산

```
1. 경로상 각 지점 (10m 간격) 마다:
   - 반경 15m 내 모든 가로수 탐색
   - 나무 높이, 캐노피 반경 기반 음영도 추정

2. 가중치 적용:
   - 경로 정중앙의 나무 → 100% 영향
   - 거리가 멀어질수록 → 선형 감소
```

### 7.3 경로 최적화 알고리즘

```
기본: Dijkstra 또는 A* 알고리즘 변형

최적의 길:
  cost = distance / walking_speed

그늘길:
  cost = (distance / walking_speed) + (100 - shadeScore) * weight
  # shadeScore가 높을수록 cost 낮음 → 선호도 높음

동적 프로그래밍으로 두 경로를 동시에 계산 가능
```

---

## 8. UI/UX 설계

### 8.1 메인 화면 레이아웃 (좌측 패널 + 우측 지도)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         사용자 편의 길 추천 서비스                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   좌측 패널 (Fixed)   │
│  (w: 350px)          │    ┌────────────────────────────────────────┐
├──────────────────────┤    │                                        │
│ [출발지 검색]        │    │                                        │
│ ━━━━━━━━━━━━━━━━    │    │                                        │
│ [도착지 검색]        │    │         🗺️ 지도 영역 (우측 전체)       │
│ ━━━━━━━━━━━━━━━━    │    │        (Float 컨테이너)               │
│                      │    │                                        │
│ [⚡ 최적의 길]       │    │                                        │
│ [🌳 햇빛 피하는 길]  │    │                                        │
│                      │    │                                        │
│ ─────────────────    │    │                                        │
│ 결과 정보:           │    │                                        │
│                      │    │                                        │
│ 거리: 1.2km          │    │                                        │
│ 시간: 15분           │    │                                        │
│                      │    │                                        │
│ 햇빛 회피도:         │    │                                        │
│ ██████░░░░ 65%      │    │                                        │
│ (그늘길 선택시만)    │    │                                        │
│                      │    │                                        │
│ ─────────────────    │    │                                        │
│ ⚙️ 설정              │    │                                        │
│ 🌙 다크모드 토글      │    │                                        │
└──────────────────────┘    │                                        │
                             │                                        │
                             └────────────────────────────────────────┘
```

**레이아웃 상세 설명:**

- **좌측 패널**: 고정 너비(350px) 패널, 스크롤 가능, 반투명 배경(bg-white/90 다크모드: bg-slate-900/90)
- **우측 지도**: 남은 공간 100% 차지, Responsive (모바일에서는 좌측 패널이 팝업/드로어로 변경)
- **Float 효과**: 좌측 패널이 지도 위에 떠있는 느낌 (z-index: 높음)
- **그림자 효과**: 좌측 패널에 subtle shadow로 depth 표현

#### 반응형 디자인 (Tailwind Grid)

```jsx
// 데스크톱 (1024px 이상)
<div className="grid grid-cols-[350px_1fr] h-screen">
  <Sidebar /> {/* 고정 너비 */}
  <MapView /> {/* 가변 너비 */}
</div>

// 태블릿 & 모바일 (1024px 미만)
<div className="relative h-screen">
  <MapView /> {/* 풀스크린 지도 */}
  <Drawer isOpen={isSidebarOpen}> {/* 토글 가능한 드로어 */}
    <Sidebar />
  </Drawer>
</div>
```

### 8.2 경로 표시 방식

- **최적의 길**: 파란색(#3B82F6) 실선, 굵기 4px
- **그늘길**: 녹색(#10B981) 실선, 굵기 4px
- **음영 영역**: 초록색 반투명 폴리곤으로 표시 (선택사항)
- **출발지**: 초록색 원형 마커
- **도착지**: 빨간색 원형 마커

### 8.3 인터랙션

- 마우스 호버시 경로 상세정보 표시 (거리, 시간, 그늘점수)
- 경로 클릭시 턴바이턴 길 안내 (선택사항)
- 실시간 태양 위치 업데이트 (옵션)

---

## 9. 구현 단계

### Phase 1: 기초 인프라 ✅ 완료

- [x] React 프로젝트 초기 설정 (Next.js 14 + Zustand)
- [x] T-Map API 지도 통합 (Leaflet 대신)
- [x] 검색창 UI (출발지, 도착지 입력)
- [x] TypeScript 타입 정의 완성
- [x] Tailwind CSS 스타일링 설정

### Phase 2: 경로 계산 엔진 ✅ 완료

- [x] T-Map API 경로 계산 API 구현 (/api/route/optimal)
- [x] 보행자 우선 경로 API 구현 (/api/route/shade)
- [x] 경로 선택 버튼 UI (⚡ 최적의 길 / 🌳 햇빛 피하는 길)
- [x] 경로 상세 정보 표시 UI (거리, 시간)

### Phase 3: 그늘 길 알고리즘 ✅ 완료

- [x] 태양 위치 계산 구현 (src/utils/shadeCalculator.ts)
- [x] 그늘 점수 계산 엔진 구현 (calculateShadeScore)
- [x] 건물 음영 계산 로직 (estimateShadeAtPoint)
- [x] 그늘 점수 시각화 UI (햇빛 회피도 프로그레스 바)
- [x] 강남구 역삼동 일조시간 데이터 통합

### Phase 4: UI/UX 개선 ✅ 완료

- [x] 경로 선택 버튼 구현 (RouteOptionButtons)
- [x] 경로 비교 기능 (최적 vs 그늘) - 버튼으로 전환
- [x] 그늘 점수 시각화 (프로그레스 바)
- [x] 반응형 디자인 적용 (데스크톱/모바일/태블릿)
- [x] 다크모드 지원 (토글 버튼)

### Phase 5.5: 지하 보행 경로 ✅ 완료 (2026-07-09)

- [x] 신논현·선정릉·선릉역 지하보도망 데이터 구축 (출입구 = OSM 실측)
- [x] 그늘 라우터에 지하 엣지 주입 (완전 그늘 + 계단 페널티)
- [x] 그늘 점수에 지하 구간 반영 + UI 표시
- [x] 선릉역 케이스 검증 (한낮 지하 27% 통과, 그늘 점수 +12)

### Phase 5: 테스트 및 배포 ✅ 완료

- [x] TypeScript 타입 체크 통과
- [x] 모든 컴포넌트 타입 정의 완성
- [x] GitHub 저장소 커밋 및 푸시
- [x] Vercel 배포 준비 완료
- [x] source 폴더에 T-Map API 가이드 저장

---

## 10. 기술적 주요 고려사항

### 10.1 성능 최적화

- **경로 계산 시간**: 5초 이내 (사용자 경험)
- **그늘 점수 계산**: 병렬 처리로 최적화
- **캐싱 전략**:
  - 인기 경로(역삼동 내 주요 목적지) 미리 계산
  - Redis TTL 설정 (1시간 ~ 1일)
- **지도 렌더링**: Vector tiles 사용 (가벼운 렌더링)

### 10.2 정확성

- **건물 높이**: 위성 LiDAR 데이터 또는 추정값 (±2m)
- **태양 위치**: 천문학 정확도 (오차 ±0.1도)
- **가로수 데이터**: 정기적 업데이트 필요 (계절성)

### 10.3 확장성

- **다른 지역 확대**: 데이터만 교체 가능한 구조
- **여름 → 겨울**: 햇빛 회피 → 햇빛 우선 로직 추가
- **모바일 앱**: 웹 기반이므로 React Native 포팅 가능

### 10.4 데이터 정확성 관리

```
초기 데이터:
- 건물정보: 강남구청 GIS (신뢰도 높음)
- 가로수: 서울시 공공데이터 (정기 업데이트)

운영 중:
- 사용자 피드백 수집 (경로 만족도)
- 계절별 가로수 높이 변화 반영
- 계절 태양 위치 자동 업데이트
```

---

## 11. 추가 기능 (Optional)

### 11.1 Phase 2에서 추가 가능

- [ ] 온도 정보 표시 (최적경로 vs 그늘길 온도 비교)
- [ ] 습도 정보 통합
- [ ] 자외선 지수(UV Index) 표시
- [ ] 경로 저장 / 즐겨찾기
- [ ] 친구와 경로 공유

### 11.2 Phase 3에서 추가 가능

- [ ] 실시간 햇빛 강도 데이터 (IoT 센서)
- [ ] 사용자 피드백 기반 머신러닝
- [ ] 계절별 최적화 (여름: 그늘, 겨울: 햇빛)
- [ ] 배리어프리 (휠체어 접근성 고려)

### 11.3 장기 비전

- [ ] 모바일 네이티브 앱 (iOS/Android)
- [ ] 실시간 혼잡도 데이터 통합
- [ ] AR 네비게이션 (스마트폰 카메라)
- [ ] 커뮤니티 피드백 시스템

---

## 12. 프로젝트 구조 예상

```
project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapContainer.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── RouteOptionButtons.jsx
│   │   │   ├── RouteDetails.jsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useRoute.js
│   │   │   ├── useLocation.js
│   │   │   └── ...
│   │   ├── store/
│   │   │   └── routeStore.js (Zustand)
│   │   ├── styles/
│   │   │   └── tailwind.css
│   │   └── App.jsx
│   ├── package.json
│   └── ...
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── optimalRoute.js
│   │   │   ├── shadeRoute.js
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── osrmService.js
│   │   │   ├── shadeCalculator.js
│   │   │   ├── sunPositionService.js
│   │   │   └── ...
│   │   ├── models/
│   │   │   └── database.js
│   │   ├── middlewares/
│   │   │   └── cache.js (Redis)
│   │   └── server.js
│   ├── docker-compose.yml (PostgreSQL, Redis, OSRM)
│   ├── package.json
│   └── ...
├── data/
│   ├── buildings/ (GIS shapefiles)
│   ├── trees/ (CSV)
│   └── config/
└── README.md
```

---

## 13. 예상 개발 기간

### 🚀 목표: 오늘(2026-07-08) 안에 완성 ✅ 달성

**실제 완성 시간**: 약 4시간 (오늘 20:20 기준)

아그레시브 일정 달성 전략:

| Phase               | 예정 기간 | 주요 산출물          | 비고                    |
| ------------------- | --------- | -------------------- | ----------------------- |
| 1. 기초 인프라      | 당일 오전 | 기본 지도, 검색창 UI | React + Vercel 스켈레톤 |
| 2. 경로 계산        | 당일 오후 | 최적 경로 추천 기능  | 티맵 API 통합           |
| 3. 그늘 길 알고리즘 | 당일 저녁 | 그늘길 추천 기능     | 단순화된 버전           |
| 4. UI/UX 개선       | 야간      | 최종 디자인, 반응형  | Tailwind 스타일링       |
| 5. 배포             | 자정 전   | 라이브 배포          | Vercel 자동 배포        |
| **총 기간**         | **1일**   | **완성된 웹서비스**  | **라이브 URL 획득**     |

### 🎯 Fast-Track 전략 (1일 완성을 위한 최적화)

**도구 및 라이브러리 선정:**

- Next.js + Vercel: 프론트 + 백엔드 통합, 배포 자동화
- 티맵 API: 경로 계산 아웃소싱 (OSRM 대신)
- Supabase: PostgreSQL + PostGIS 클라우드 호스팅 (DB 설정 최소화)
- Upstash Redis: Serverless 캐싱 (인프라 최소화)
- Shadcn/ui 또는 Headless UI: 사전 구성 컴포넌트로 개발 속도 업

**구현 순서 (병렬 처리 권장):**

1. GitHub 저장소 생성 + Vercel 프로젝트 연동
2. Next.js 프로젝트 초기화
3. 좌측 패널 UI 컴포넌트 (출발/도착지 입력, 버튼)
4. 우측 지도 통합 (티맵 API)
5. API 라우트 작성 (/api/route/optimal, /api/route/shade)
6. 그늘 점수 계산 로직 (단순화)
7. 경로 표시 및 결과 UI
8. 스타일링 및 반응형 적용
9. Vercel 배포 (자동 GitHub 연동)
10. 라이브 테스트

**시간 절감 팁:**

- ✅ 처음부터 완벽하지 않아도 됨 (MVP)
- ✅ 단순화된 그늘 점수 (건물 높이만 사용 가능)
- ✅ 데이터베이스 없이 시작 가능 (API 응답 캐싱)
- ✅ 모바일 반응형은 후속 업데이트로

---

## 14. 리스크 및 완화 전략

| 리스크                    | 영향             | 완화 전략                          |
| ------------------------- | ---------------- | ---------------------------------- |
| 건물/가로수 데이터 부정확 | 그늘 점수 신뢰도 | 초기 수동 검증, 사용자 피드백 수집 |
| OSRM 경로 계산 시간 초과  | 사용자 경험 악화 | 캐싱, 병렬 처리, API 타임아웃 설정 |
| PostGIS 쿼리 성능 저하    | 응답 시간 증가   | 공간 인덱싱, 쿼리 최적화           |
| 태양 위치 계산 오류       | 그늘길 추천 오류 | 라이브러리 검증, 테스트 케이스     |
| 강남 외 지역 확대 어려움  | 확장성 제한      | 모듈화된 데이터 구조 설계          |

---

## 결론

이 프로젝트는 **강남구 역삼동의 여름철 햇빛 회피**라는 특화된 페르소나를 타겟으로, 기존 지도 앱과 차별화된 서비스를 제공합니다. 핵심은 **그늘 점수 계산 알고리즘**과 **경로 최적화 엔진**의 정확성입니다. 단계별 구현으로 리스크를 최소화하고, 점진적인 기능 확대를 지향합니다.
