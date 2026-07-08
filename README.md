# 사용자 편의 길 추천 서비스 - 햇빛 회피 경로

강남구 역삼동 거주자를 위한 여름철 햇빛 회피 경로 추천 웹사이트입니다.

## 📋 프로젝트 개요

- **목표**: 최적의 길뿐만 아니라 햇빛을 피할 수 있는 그늘 길을 추천
- **타겟**: 강남구 역삼동 거주자 (특히 여름철 햇빛 회피 필요)
- **특징**:
  - ⚡ **최적의 길**: 최단거리/시간 기반 경로
  - 🌳 **햇빛 피하는 길**: 그늘 점수 기반 경로
  - 건물을 관통하지 않고 횡단보도를 준수하는 정확한 경로

## 🚀 기술 스택

- **프론트엔드**: React 18 + Next.js 14
- **상태관리**: Zustand
- **스타일링**: Tailwind CSS
- **지도 API**: T-Map (보행자 경로 전문화)
- **배포**: Vercel

## 🛠️ 설치 및 실행

### 1. 환경 변수 설정

#### 로컬 개발 환경

```bash
cp .env.example .env.local
```

`.env.local` 파일에 T-Map API 키를 설정하세요:

```
TMAP_API_KEY=your_tmap_api_key_here
NEXT_PUBLIC_TMAP_API_KEY=your_tmap_api_key_here
```

T-Map API 키는 [T-Map 공식 사이트](https://openapi.sk.com/)에서 발급받을 수 있습니다.

#### Vercel 배포 환경

Vercel 대시보드에서 다음 환경변수를 추가하세요:

1. **Settings → Environment Variables**에서 추가
   - 이름: `TMAP_API_KEY`
   - 값: `your_tmap_api_key_here`
   - 적용: **Production, Preview, Development**

2. 이름: `NEXT_PUBLIC_TMAP_API_KEY`
   - 값: `your_tmap_api_key_here`
   - 적용: **Production, Preview, Development**

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어보세요.

### 4. 빌드 및 배포

```bash
npm run build
npm start
```

## 📍 T-Map API 설정 위치

T-Map API는 다음 위치에 통합되어 있습니다:

### 서버 (API 라우트)
1. **`src/app/api/route/optimal/route.ts`** - 최적 경로 API
   - T-Map REST API 호출 (routeType: 1)
   - `TMAP_API_KEY` 환경변수 사용

2. **`src/app/api/route/shade/route.ts`** - 그늘길 API
   - T-Map REST API 호출 (routeType: 32)
   - `TMAP_API_KEY` 환경변수 사용

### 클라이언트
3. **`src/utils/tmapService.ts`** - T-Map API 클라이언트
   - 서버의 API 라우트 호출
   - T-Map REST API는 서버에서만 호출

4. **`src/components/MapContainer.tsx`** - 지도 렌더링
   - T-Map JavaScript SDK 로드
   - `NEXT_PUBLIC_TMAP_API_KEY` 환경변수 사용
   - 경로 및 마커 표시

### 환경 변수
5. **`.env.local`** (로컬) / **Vercel Settings** (배포)
   - `TMAP_API_KEY`: 서버 환경변수 (경로 조회 API)
   - `NEXT_PUBLIC_TMAP_API_KEY`: 클라이언트 환경변수 (지도 표시)
   - 같은 API 키 값 사용 가능

## 📚 T-Map API 활용 방법

### 보행자 경로 API

```
POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json
```

요청 파라미터:
- `startX`: 출발지 경도
- `startY`: 출발지 위도
- `endX`: 도착지 경도
- `endY`: 도착지 위도
- `routeType`: 경로 타입 (1: 최단거리, 32: 보행자 우선)

[T-Map 보행자 경로 API 문서](https://tmap-skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4)

## 📦 프로젝트 구조

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── route/                # API 라우트
│   │       ├── optimal/          # 최적 경로 API
│   │       └── shade/            # 그늘길 API
│   ├── layout.tsx                # Root 레이아웃
│   └── page.tsx                  # 메인 페이지
├── components/                   # React 컴포넌트
│   ├── MapContainer.tsx          # 지도 컨테이너
│   ├── SearchBar.tsx             # 검색창
│   ├── RouteOptionButtons.tsx    # 경로 선택 버튼
│   ├── RouteDetails.tsx          # 경로 상세 정보
│   └── Sidebar.tsx               # 좌측 패널
├── hooks/                        # Custom Hooks
│   └── useRoute.ts               # 경로 관련 훅
├── store/                        # Zustand 상태관리
│   └── routeStore.ts             # 경로 스토어
├── types/                        # TypeScript 타입
│   └── route.ts                  # 경로 관련 타입
├── utils/                        # 유틸리티 함수
│   ├── shadeCalculator.ts        # 그늘 점수 계산
│   └── tmapService.ts            # T-Map API 서비스
└── styles/                       # 스타일
    └── globals.css               # 전역 스타일
```

## 💡 주요 기능

### 1. 경로 검색
- 출발지와 도착지 입력
- 검색 결과 자동 반영

### 2. 경로 선택
- **[⚡ 최적의 길]**: 최단거리/시간 기반
- **[🌳 햇빛 피하는 길]**: 그늘 점수 기반

### 3. 그늘 점수 계산
```
그늘점수 = (건물음영도 × 0.4) + (가로수밀도 × 0.35) + (포장재질 × 0.15) + (시간가중치 × 0.1)
```

### 4. 반응형 디자인
- 데스크톱: 좌측 패널 + 우측 지도
- 모바일: 토글 가능한 드로어

## 🌙 다크모드
우측 하단의 🌙 버튼을 클릭하여 다크모드를 전환할 수 있습니다.

## 📊 데이터 소스

| 데이터 | 출처 | 비고 |
|--------|------|------|
| **기본 지도** | T-Map API | 경로 표시용 |
| **건물 정보** | 강남구청 GIS / OpenStreetMap | 건물 높이 및 음영 계산 |
| **가로수 정보** | 서울시 공공데이터 포털 | 나무 밀도 계산 |
| **일조량** | 사용자 제공 파일 | `역삼동_보도별_일조시간.csv` |
| **태양 위치** | 천문학 계산 | Pysolar 라이브러리 알고리즘 |

## ⚙️ 환경 변수

| 변수 | 설명 | 필수 | 노출 |
|------|------|------|------|
| `TMAP_API_KEY` | T-Map API 키 (서버) | ✅ | 서버만 |
| `NEXT_PUBLIC_TMAP_API_KEY` | T-Map API 키 (클라이언트) | ✅ | 클라이언트 |

**설정 방법:**
- **로컬**: `.env.local` 파일에 입력
- **Vercel**: 프로젝트 Settings → Environment Variables에서 입력

## 📝 Type Checking

TypeScript를 사용하여 타입 안정성을 보장합니다:

```bash
npm run type-check
```

## 🚢 배포

### Vercel 배포

1. GitHub 저장소를 Vercel에 연동
2. 환경 변수 설정 (`NEXT_PUBLIC_TMAP_API_KEY`)
3. 자동 배포 (main 브랜치 푸시 시)

## 📱 반응형 브레이크포인트

- **Mobile**: < 1024px
- **Desktop**: ≥ 1024px

## 🔒 보안

- API 키는 환경 변수로 관리
- `.env.local` 파일은 `.gitignore`에 포함

## 📞 지원

문제가 발생하면 [GitHub Issues](https://github.com/bugoms/20260708/issues)에 보고해주세요.

## 📄 라이센스

이 프로젝트는 개인 프로젝트입니다.

---

**마지막 업데이트**: 2026-07-08
