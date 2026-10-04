# 차근차근 — 초보 운전 코스 추천

한국의 초보 운전자가 지역·주행 거리·난이도를 선택하고 연습 코스를 비교하는 React + Vite 프론트엔드 프로토타입입니다.

## 실행

Node.js 20.19+ 또는 22.12+ 환경에서 실행합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

이미 `.env.local`이 있다면 복사 단계를 생략해 기존 설정을 보존합니다. 터미널에 표시된 주소(기본 `http://127.0.0.1:5173/`)로 접속합니다.

```powershell
npm run build
npm run preview
```

## 네이버 지도 설정

1. 네이버 클라우드 Maps 애플리케이션에서 Web Dynamic Map을 활성화합니다.
2. Web 서비스 URL에 개발 주소 `http://127.0.0.1:5173`을 등록합니다. localhost나 배포 도메인으로 접속한다면 해당 주소도 등록합니다.
3. `.env.local`에 발급한 Maps JavaScript API Client ID를 설정합니다.

```dotenv
VITE_NAVER_MAP_CLIENT_ID=발급받은_Client_ID
```

4. 개발 서버를 재시작합니다.

Client ID를 설정하면 네이버 지도를 사용하고, 비어 있으면 Leaflet + OpenStreetMap 지도를 사용합니다. 네이버 인증 실패 시에는 오류와 다시 연결 버튼을 표시합니다.

`VITE_`로 시작하는 환경 변수는 브라우저에 공개됩니다. Client ID는 브라우저용 식별자이며, Client Secret·개인 API 키·비밀번호는 이 변수에 넣지 않습니다. 실제 Client ID 값은 저장소에 포함하지 않고 `.env.example`에는 변수명만 유지합니다.

## 주요 기능

- 전국 17개 시·도의 대표 예시 지역 21곳과 등록된 장소·별칭 검색
- 지역별 추천 순위 및 목록·지도 핀 클릭으로 코스 추천
- 최소·최대 주행 거리 3~20km와 난이도 선택
- 코스 3개 비교, 선택 경로·출발/도착·방향 표시, 상세 보기 및 재추천
- 지도 확대·축소 한 번에 0.5단계, 줌 범위 6~17
- 네이버 중심점 범위: 위도 32.5~39, 경도 124~130.5
- 네이버 일반/위성 지도 전환, Leaflet 기본/차분한 스타일 전환
- 데스크톱 사이드바 크기 조절 및 모바일 목록/지도 전환
- 검색 오류 안내, 검색어 지우기, 이용 안내 모달과 키보드 포커스 관리

## 프로젝트 구조

```text
src/
├── components/
│   ├── courses/       # 거리·난이도, 추천 코스, 상세, 지역 순위, 안내 그림
│   ├── layout/        # Header, ResizableSidebar
│   ├── map/           # 지도 제공자, 경로 표시, 줌·경계·지역 핀 배치
│   └── ui/            # 공통 Modal
├── data/              # 예시 지역·경로 데이터와 검색·추천 함수
├── lib/               # 네이버 SDK 로더
├── pages/             # MainPage: 화면 상태와 전체 흐름
├── main.jsx           # 앱 진입점
└── styles.css         # 공통 디자인 토큰과 화면 스타일

docs/
├── DESIGN.md          # 시각 기준과 런타임 토큰 소유자
└── UX-CONTRACT.md     # 공통 UI 동작 기준

.local/                # Git 제외: screenshots/, reports/
.env.example           # 공유 가능한 환경 변수 양식
vite.config.js         # 개발·빌드 설정
package.json
package-lock.json      # 재현 가능한 의존성 설치를 위해 커밋
```

지도 제공자 선택은 `src/components/map/MapView.jsx`, 네이버 지도 로딩은 `src/lib/naverMaps.js`가 담당합니다. 제공자별 구현과 지도 보조 함수는 `components/map/`에 함께 둡니다.

문서는 `docs/`, 앱에서 사용하는 JSON은 `src/data/`, 로컬 보고서 JSON은 `.local/reports/`에 둡니다. `package.json`과 `package-lock.json`은 npm이 프로젝트 루트에서 사용하는 파일이므로 루트에 유지합니다. 디자인과 UI 동작의 정식 문서는 `docs/DESIGN.md`와 `docs/UX-CONTRACT.md`입니다.

## 저장소에 포함하지 않는 파일

| 경로 | 용도 |
| --- | --- |
| `.env*` (`.env.example` 제외) | 개발·배포 환경별 실제 설정 |
| `node_modules/` | 설치된 의존성 |
| `dist/` | 빌드 산출물 |
| `.npm-cache/` | 로컬 설치 캐시 |
| `*.log` | 개발 서버 등 실행 로그 |
| `.local/screenshots/` | 작업 중 화면 캡처 |
| `.local/reports/` | 로컬 감사·점검 보고서 |

위 파일은 `.gitignore`로 제외합니다. 작업 캡처와 보고서는 로컬에서 보존하며, 제품에 사용하는 이미지가 생기면 `src/assets/` 또는 `public/`에 두고 명시적으로 커밋합니다.

이미 커밋된 파일은 ignore 규칙만 추가해도 기록에서 제거되지 않습니다. 이번 구조 정리는 기존 루트 캡처·보고서를 로컬 보관 폴더로 옮겼으며, 다음 커밋에서 루트 파일 삭제가 반영됩니다. 과거 커밋 기록은 별도 이력 정리가 없으면 남습니다.

## 데이터 범위와 실제 서비스 연결

추천 수치·순위·경로는 예시 데이터입니다. 경로는 실제 도로망 탐색, 일방통행, 진입 제한, 실제 주행 가능성을 반영하지 않습니다. 전국 모든 장소 검색에는 지오코딩/장소 검색 API 연결이 필요합니다.

- `src/data/regions.json`: 대표 지역, 중심좌표, 검색 별칭
- `src/data/routes.json`: 코스 템플릿과 점수·도로 지표
- `src/data/index.js`: 지역 검색 및 템플릿의 좌표·거리·난이도 변환

실제 연결 시 `findRegion`을 장소 검색 API로, `getRoutes(region, batch, distanceRange, difficulty)`를 추천 API로 교체합니다. 거리 범위 형식은 `{min:5,max:10}`입니다. 지역 변경·재추천 시 거리와 난이도 조건은 유지합니다.

추천 응답에는 `id`, `rank`, `name`, `score`, `difficulty`, `distance`, `duration`, `startLocation`, `coordinates`([위도, 경도]), `metrics`, `sections`, `reason`을 제공합니다.

## 관련 문서

- [디자인 기준](docs/DESIGN.md)
- [UI 동작 기준](docs/UX-CONTRACT.md)
- [네이버 Maps JavaScript API](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.Map.html)
- [Leaflet](https://leafletjs.com/reference)
- [OpenStreetMap 타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)
