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

추천 수치·순위·경로는 예시 데이터입니다. 경로는 실제 도로망 탐색, 일방통행, 진입 제한, 실제 주행 가능성을 반영하지 않습니다. 실제 도로명과 시·군·구 검색은 아래 도로 데이터 기능으로 지원합니다. 그 외 모든 장소 검색에는 지오코딩/장소 검색 API 연결이 필요합니다.

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

## 실제 도로 검색

기존 검색창은 표준노드링크 ROAD_NAME의 정확/부분 일치와 시·군·구 검색을 지원합니다. `공원`, `공원로`, `테헤란로`, `구로구`를 입력하고 결과를 선택하세요. 동명 도로는 노드·끝점 연결로 구분하며, 선택한 그룹의 실제 도로선만 불러옵니다. 기존 예시 지역의 코스·필터·순위는 유지합니다.

- `public/data/roads/manifest.json` / `.json.gz`: 도로명과 검색 shard 목록, 행정구역 위치
- `public/data/roads/search/*.json.gz`: geometry 없는 도로 그룹 검색 정보
- `public/data/roads/geometry/*.jsonl.gz`: 선택 시 요청하는 LINK 속성/GeoJSON
- `public/data/roads/provenance.json`: 실제 원본 CRS·컬럼·개수·변환 방식
- `public/data/roads/target-link.json`: 검증용 LINK_ID 1160059701
- `scripts/preprocess-road-links.py`: 원본을 읽기 전용으로 처리하는 전처리
- `src/lib/road-search.js`: 검색·페이지 조회·압축 해제·선택 geometry 로딩
- `src/types/road.d.ts`: LINK 및 향후 route의 ID 계약

전처리 데이터는 `public/`의 정적 파일로 배포합니다. 전국 geometry를 JS bundle에 넣거나 초기 화면에서 읽지 않습니다. gzip 파일은 최신 브라우저의 `DecompressionStream`으로 읽으며, 실패한 검색/선택은 다시 시도할 수 있습니다.

### 전처리 재생성

Python 3.12, pyproj, shapely를 사용합니다. 경계 파일은 통계청 SGIS 원자료 기반 [admdongkor 2026-07-01](https://github.com/vuski/admdongkor/tree/master/ver20260701)의 `HangJeongDong_ver20260701.geojson`을 `.local/roads/admin-boundaries.geojson`에 보관합니다. 외부 경계가 없으면 지역명을 추측하지 않고 좌표와 지역 미확인을 표시합니다.

```powershell
python -m pip install -r scripts/requirements-roads.txt
python scripts/preprocess-road-links.py --links "C:\Users\CHOI\Downloads\[2026-09-14]NODELINKDATA\MOCT_LINK.shp" --nodes "C:\Users\CHOI\Downloads\[2026-09-14]NODELINKDATA\MOCT_NODE.shp" --boundaries .local/roads/admin-boundaries.geojson
python scripts/test-preprocess-road-links.py
python scripts/verify-road-data.py
npm run build
```

원본 SHP/DBF/PRJ는 읽기만 합니다. 중간 SQLite와 행정경계는 `.local/`에 유지하고 배포하지 않습니다. ROAD_NAME이 없거나 geometry가 비어 있는 LINK는 이름 검색에서 제외합니다. 이름이 변경된 원본으로 재생성할 때는 새 `--output` 경로에 생성하고 검증 후 교체하세요.

지역은 LINK geometry 중간점과 시군구 경계를 공간 대조한 결과입니다. 경계를 가로지르는 LINK의 모든 관할을 판정하는 용도가 아닙니다. 같은 이름의 끝점이 15m 이내인 구간은 분리 차도를 포함한 표시용 그룹으로 묶습니다. 이 그룹은 일방통행이나 진입 제한을 반영한 경로가 아닙니다. 거리에는 분리된 양방향 도로선이 각각 포함될 수 있습니다.

출처·처리 조건은 [ATTRIBUTION.md](public/data/roads/ATTRIBUTION.md), 상세 구현·검증 기록은 [ROAD-DATA-INTEGRATION.md](docs/ROAD-DATA-INTEGRATION.md)를 참고하세요.

### 차로 수별 지도 표시

상단의 1~6, 7+ 버튼으로 복수 선택한다. 파란색은 현재 지도 범위의 실제 LINK이며 원본 LANES를 사용한다. 이름 없는 도로도 포함한다. 전국 화면에서는 확대 안내하며 줌 13 이상에서 현재 구역만 표시한다. 지도 객체는 프레임마다 나눠 생성하고 화면 범위가 바뀌면 남은 작업을 취소한다. 범위가 너무 넓거나 12,000 LINK를 넘으면 더 확대해야 한다. 기존 도로명 검색과 예시 코스는 유지한다.

```powershell
python scripts/preprocess-lane-tiles.py --links "C:\Users\CHOI\Downloads\[2026-09-14]NODELINKDATA\MOCT_LINK.shp"
npm run test:lanes
```

생성한 `public/data/roads/lanes`를 정적 데이터와 함께 배포한다. `.local/roads/lane-tiles`는 중간 파일이며 배포하지 않는다.

### 희망 거리로 실제 도로 연결

희망 주행 거리를 정하고 차로를 선택한 뒤, 배율 13 이상에서 도로 로딩이 끝나면 `순환` 또는 `편도`와 `5~10km 도로 연결` 버튼을 선택한다. 희망 거리를 최대 3개 거리대로 나누어 다익스트라로 거리대별 1개를 추천하며, 사용자에게는 후보 1·2·3 버튼으로 보여주고 선택한 경로를 빨간색으로 표시한다. 내부 거리대는 화면에 노출하지 않으며 선택 후보의 실제 거리를 따로 표시한다. 현재 지도 중심 근처에서 출발하며 거리·차로·경로 형태를 바꾸면 이전 경로를 지운다. 최소는 5km, 최대는 30km, 최소·최대 차이는 최대 10km다. 범위를 넘기면 반대 조절점이 함께 이동한다. 5~10km는 5~6/7~8/9~10km, 10~20km는 10~13/13~16/16~20km로 나누며 못 찾은 거리대는 생략한다.

현재 화면에 불러온 LINK의 노드와 방향만 이용하며, 거리는 지도 형상으로 계산한 근삿값이다. 회전 제한·현장 통제·차량 진입 제한은 검증하지 않는다. 선택한 차로나 화면 범위로 연결할 수 없으면 조건을 바꾸거나 지도 범위를 이동해야 한다. `npm run test:connected`로 연결과 거리 조건을 검증한다.

경로 탐색 비용은 실제 구간 길이에 차로 배수(3~5차로 1 / 2·6차로 1.5 / 7차로 2 / 8 이상 2.5 / 1차로 3)를 적용하고 회전 비용(직진 0 / 우회전 50 / 좌회전 150 / 유턴 500)을 더한다. 실제 거리는 별도로 관리하며 현재 화면·선택 차로와 제한된 후보 안에서 낮은 비용을 우선한다. 회전은 도로 형상으로 추정하며 통행 허용 여부를 확인하는 기능은 아니다.

교통량·사고 자료의 향후 비용 반영 기능도 준비되어 있다. 데이터가 없는 현재는 추가 비용을 적용하지 않는다. 차로당 교통량과 km당 사고를 같은 관측 기간의 비교 기준으로 정규화하며 입력 계약·미확인 처리·관측 비율은 [ROAD-COST-DATA.md](docs/ROAD-COST-DATA.md)를 참고한다. 실제 자료의 수집과 LINK_ID 병합은 추후 작업이다.
