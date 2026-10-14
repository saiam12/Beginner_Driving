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

도로 검색·지도·차로·코스 생성은 View-T 2024년 전국 Level 5.5 도로망을 사용합니다. ITS 도로망과 ID 대응 로더는 사용하지 않습니다. 도로명 정확/부분 일치와 시·군·구 검색을 지원하고, 같은 이름의 도로는 실제 위치와 노드 연결로 구분합니다.

- 전국 119,466개 방향별 도로 구간, 9,249개 검색 그룹, 1,778개 공간 타일
- 같은 해의 교통량 119,413개 직접 연결, 교통량 없는 53개 구간은 미확인
- `linkId`와 `lev5_5_link_id` 값은 동일한 Level 5.5 ID 문자열이며 `identifierSystem`은 `level5.5`
- `public/data/roads/provenance.json`: 원본 해시, CRS, 집계 및 교통량 기준
- `public/data/roads/target-link.json`: 검증용 올림픽대로 ID `1014051`
- `public/data/roads/search`, `geometry`, `lanes`: 필요할 때만 읽는 압축 검색·형상·차로 데이터

### 전처리 재생성

공식 네트워크 다운로드 페이지에서 2024년 17개 시도의 `*_link_lev5.5_2024.zip`을 `.local/viewt/`에 준비합니다. 도로구간 표는 `.local/viewt/2024-regional/traffic.csv`, 기존 행정 경계는 `.local/roads/admin-boundaries.geojson`에 보관합니다. 원본 ZIP은 수정하지 않습니다. 새 출력 경로에 생성한 후 검증하고 배포 데이터를 교체합니다.

```powershell
python -m pip install -r scripts/requirements-roads.txt
python scripts/preprocess-level55-roads.py --output .local/level55-rebuild
python scripts/verify-level55-data.py --root .local/level55-rebuild
npm run test:level55
npm run test:lanes
npm run build
```

기존 ITS 전처리 명령은 실행을 차단했습니다. 이전 도로 데이터는 `.local/roads-its-backup-20261010`에 보존했습니다. 브라우저의 기존 저장 코스는 그대로 두고, 새 코스는 `beginner-driving.saved-courses.level55.v2`에 저장하여 서로 다른 도로망의 ID가 섞이지 않게 합니다.

차로 버튼은 선호 차로를 복수 선택합니다. 선택하지 않은 차로도 후보에 포함하되 길이 × 3의 선호 비용을 추가합니다. 이름 없는 구간도 코스 탐색에 포함합니다. 도로 그룹은 지도 표시용이며 실제 통행 허용 여부를 판정하지 않습니다.

출처는 [ATTRIBUTION.md](public/data/roads/ATTRIBUTION.md), 데이터 적용 과정은 [VIEWT-TRAFFIC-INTEGRATION.md](docs/VIEWT-TRAFFIC-INTEGRATION.md)를 참고하세요.

### 희망 거리로 실제 도로 연결

희망 주행 거리를 정한 뒤, 배율 13 이상에서 도로 로딩이 끝나면 `순환` 또는 `편도`와 `5~10km 후보 찾기` 버튼을 선택한다. 차로 선택은 필수가 아니다. 희망 거리 전체 범위에서 다익스트라 기반으로 후보를 탐색하고 총 cost 순 상위 3~5개를 채택하며, 후보 번호 버튼으로 보여주고 선택한 경로만 빨간색으로 표시한다. 실제 후보 표시 중에는 기존 예시/검색 경로와 예시 선택 카드를 숨긴다. 개발용 전체 후보 목록에서 거리와 비용을 확인할 수 있다. 자동 모드는 화면 전역의 분산 시작점들을 비교하고, 사용자는 지도에서 출발 위치를 직접 지정할 수 있으며 거리·선호 차로·연습 조건·경로 형태를 바꾸면 이전 경로를 지운다. 최소는 5km, 최대는 30km, 최소·최대 차이는 최대 10km다. 범위를 넘기면 반대 조절점이 함께 이동한다. 탐색 중 발견된 유효 후보만 표시하며 특정 개수를 강제하지 않는다.

현재 화면에 불러온 LINK의 노드와 방향만 이용하며, 거리는 지도 형상으로 계산한 근삿값이다. 회전 제한·현장 통제·차량 진입 제한은 검증하지 않는다. 현재 화면 범위로 연결할 수 없으면 거리나 지도 위치·배율을 바꾼다. `npm run test:connected`로 연결과 거리 조건을 검증한다.

경로 탐색 비용은 실제 구간 길이에 차로 배수(3~5차로 1 / 2·6차로 1.5 / 7차로 2 / 8 이상 2.5 / 1차로 3)를 적용하고 회전 비용(직진 0 / 우회전 50 / 좌회전 150 / 유턴 500)을 더한다. 실제 거리는 별도로 관리하며 전체 차로와 제한된 후보 안에서 낮은 비용을 우선한다. 회전은 도로 형상으로 추정하며 통행 허용 여부를 확인하는 기능은 아니다.

2024년 평일 추정교통량을 코스 비용과 순위에 반영합니다. 동일 연도의 Level 5.5 ID·도로명·차로·등급·시도·원본 길이를 확인해 직접 연결했습니다. 교통량 비용은 `구간 길이 × 2 × min(1, 차로당 교통량 / 같은 시도의 차로당 기준)`입니다. 기준은 같은 시도 전체 유효 자료의 차로당 교통량 최댓값입니다. 사고와 실시간 교통은 반영하지 않았습니다. [입력 계약](docs/ROAD-COST-DATA.md)을 참고하세요.

### Gemini 맞춤 추천

왼쪽에서 연습 목표(주행 목표·피하기)을 고르고 실제 후보 생성 후 `AI 맞춤 추천`을 누른다. 서버가 Gemini에 조건과 후보 요약을 전달해 순위를 정하고, 검증된 거리·회전·차로 비율을 근거로 표시한다. 없는 교통량·사고 정보는 추측하지 않는다. 키는 `.env.local` 또는 Vercel 서버 환경변수의 `GEMINI_API_KEY`에 설정하며 브라우저용 `VITE_` 변수에는 넣지 않는다. 키 미설정/오류 시 기본 후보를 유지한다. 설정, API 계약, 한계와 검증 명령은 [GEMINI-COURSE-RECOMMENDATION.md](docs/GEMINI-COURSE-RECOMMENDATION.md)를 참고한다.

현재 개발 화면은 거리 전체 범위의 발견 후보를 총 cost 순으로 정렬해 상위 3·4·5개를 채택합니다. 개발용 전체 후보 목록에서 미채택 후보도 선택하고 총 cost, km당 cost, 항목별 비용을 확인할 수 있습니다. Gemini에는 채택한 최대 5개 후보 요약만 전달합니다. 탐색 한도와 비교 기준은 docs/GEMINI-COURSE-RECOMMENDATION.md를 참고하세요.

채택 시 같은 방향의 공통 LINK 길이 기준 경로 일치율이 90% 이상이면 총 cost가 낮은 하나만 남기고 다음 후보로 채웁니다. 유사 제외 개수는 전체 후보 제목 옆에 표시하며, 제외 후보는 목록과 AI 입력에서 숨깁니다.

공유 `key_pool` 시트도 연동할 수 있습니다. `GEMINI_POOL_MODE=sheets`와 서버 전용 URL·토큰·사용자·키 별칭·모델 설정을 사용합니다. 기존 Apps Script의 예약과 사용량 집계를 공유하며 설정은 [Gemini 추천 문서](docs/GEMINI-COURSE-RECOMMENDATION.md#기존-key_pool-공유-시트-연결)를 참고하세요. 검증은 `npm run test:pool`입니다.
