# 표준노드링크 지도 연동 결과

## 1. 기존 프로젝트와 보존한 기능

React 19 + Vite의 JavaScript 프로젝트다. Next.js나 서버 API 구조는 없었다. 기존 검색은 `Header.jsx`에서 명시적으로 제출하고 `MainPage.jsx`의 `findRegion`으로 등록된 예시 지역만 찾았다. 검색 드롭다운은 없었으므로 기존 검색 입력 아래에 같은 토큰을 사용하는 결과 패널을 추가했다.

`MapView.jsx`는 브라우저용 네이버 Client ID가 있으면 `NaverMapView.jsx`, 없으면 `LeafletMapView.jsx`를 선택한다. 네이버는 기존 raster 지도 하나와 `naverZoomController`의 화면 배율을 사용한다. Leaflet은 OpenStreetMap 타일을 사용한다. 기존 코스 좌표는 `[위도, 경도]`, 실제 도로 GeoJSON은 `[경도, 위도]`이므로 지도 제공자에서 순서를 명시적으로 변환한다.

예시 데이터는 `src/data/regions.json`, `routes.json`, `index.js`다. 코스 카드·상세·순위·거리·난이도·재추천·모바일 목록/지도 전환과 기존 디자인은 유지했다. 실제 도로를 선택할 때만 mock 코스 대신 도로 정보와 실제 도로선을 표시한다. 실제 도로에 예시 추천 점수를 붙이지 않는다.

## 2. 사용한 원본

- LINK: `C:\Users\CHOI\Downloads\[2026-09-14]NODELINKDATA\MOCT_LINK.shp`
- 함께 읽은 파일: 동일 경로의 `MOCT_LINK.dbf`, `.prj`, `.cpg`
- NODE: 동일 경로의 `MOCT_NODE.dbf`에서 NODE_ID/NODE_NAME 연결
- 원본은 읽기 전용으로 처리했다. 원본 SHP를 브라우저에서 읽거나 배포 파일에 포함하지 않는다.

LINK 원본은 1,562,356개다. SHP 276,191,336 bytes, DBF 335,907,246 bytes다. 실제 컬럼은 `LINK_ID`, `F_NODE`, `T_NODE`, `LANES`, `ROAD_RANK`, `ROAD_TYPE`, `ROAD_NO`, `ROAD_NAME`, `ROAD_USE`, `MULTI_LINK`, `CONNECT`, `MAX_SPD`, `REST_VEH`, `REST_W`, `REST_H`, `C-ITS`, `LENGTH`, `UPDATEDATE`, `REMARK`, `HIST_TYPE`, `HISTREMARK`다. SHP의 좌표를 별도로 읽는다. DBF 인코딩은 CPG의 `949`와 일치하는 CP949다.

## 3. 좌표계

원본 PRJ가 선언한 **ITRF2000_Central_Belt_60** WKT를 직접 읽었다. 임의의 EPSG 코드를 붙이지 않았으며, 이 WKT에 대해 pyproj가 반환하는 EPSG 식별자는 `null`이다.

- 기준 타원체: GRS 1980
- 투영: Transverse Mercator, 중앙경선 127°, 원점 위도 38°
- False Easting 200,000m, False Northing 600,000m, Scale Factor 1
- `Transformer.from_crs(sourceWkt, EPSG:4326, always_xy=True)`로 변환

원본 전체 WKT는 `public/data/roads/provenance.json`에 남겼다.

## 4. LINK_ID 1160059701 검증

| 항목 | 실제 값 |
|---|---|
| ROAD_NAME | 공원로 |
| LANES | 2 |
| F_NODE | 1160032302 |
| T_NODE | 1160032301 |
| 시작 노드명 | 구로동 50-12 |
| 끝 노드명 | 구로동 50-9 |
| ROAD_RANK / ROAD_TYPE | 104 / 000 |
| ROAD_NO | null (원본 `-`) |
| 제한속도 | 30 km/h |
| 구간 길이 | 약 12m |
| 실제 지역 | 서울특별시 구로구 |
| 중간점 | 위도 37.5005637, 경도 126.8924021 |
| 첫 좌표 `[lng, lat]` | `[126.8923756, 37.5005139]` |
| 끝 좌표 `[lng, lat]` | `[126.8924287, 37.5006134]` |

이 LINK는 `road-1160012901` 공원로 그룹에 포함된다. 해당 그룹은 실제 LINK 50개, 차로 범위 1~4, geometry 길이 약 3.64km이며 구로구와 영등포구에 걸친다. 그룹 전체 차로 수를 대상 LINK 하나의 2차로로 표시하지 않는다. 양방향 좌표가 분리된 차도는 길이에 각각 포함되므로 주행 거리와 다를 수 있다.

## 5. 동명 도로와 행정구역 판별

정확히 동일한 ROAD_NAME끼리 먼저 나누고, F_NODE/T_NODE를 공유하거나 projected geometry 끝점이 15m 이내인 LINK를 연결요소로 묶었다. ID 접두어를 행정구역명으로 매핑하지 않는다. 멀리 떨어진 동명 도로는 별도 그룹이고, 분리된 양방향 차도는 함께 보여준다. 이 허용 오차는 지도 표시를 위한 기준이며 실제 주행 연결·일방통행·진입 제한의 증명이 아니다.

프로젝트에 행정경계가 없어서 통계청 SGIS 원자료 기반 [vuski/admdongkor의 2026-07-01 경계](https://github.com/vuski/admdongkor/tree/master/ver20260701)를 로컬 전처리용으로 확보했다. 실제 `sidonm`/`sggnm`으로 시군구 경계를 dissolve하고, LINK geometry 중간점을 spatial join했다. 여러 LINK가 서로 다른 관할에 속하면 그룹에는 확인된 지역을 모두 표시한다. 중간점이 경계와 일치하지 않으면 빈 지역 목록을 유지하고 UI에 좌표와 ‘지역 미확인’을 표시한다. 관할 전체를 판정하는 정밀한 line/polygon overlay는 아직 아니다.

출처·라이선스는 `public/data/roads/ATTRIBUTION.md`와 UI에 표시했다. 도로명이 없는 69,247개 LINK는 이름 검색 대상에서 제외한다.

## 6. 전처리 산출물과 성능

`public/data/roads/`에 생성한 데이터는 JS bundle에 import하지 않는다.

| 파일 | 역할 |
|---|---|
| `manifest.json`, `manifest.json.gz` | 42,795개 도로명, metadata shard, 그룹 개수, 256개 시군구 위치 |
| `search/*.json.gz` | 256개 압축 metadata shard: 지역, 차로 범위, 구간 수, 길이, bounds, geometry shard |
| `geometry/*.jsonl.gz` | 1,024개 압축 geometry shard: 그룹별 LINK_ID·속성·GeoJSON |
| `target-link.json` | 대상 LINK의 검증용 GeoJSON과 그룹 ID |
| `provenance.json` | 원본 CRS·컬럼·개수·대상 정보·변환/그룹 방식 |
| `ATTRIBUTION.md` | 원자료와 경계 출처, 거리·그룹 해석 조건 |

첫 검색에만 압축 manifest를 읽고, 한 번에 일치하는 도로명 8개의 metadata shard를 읽는다. 결과는 20개씩 더 보기로 제공하여 모든 그룹에 접근할 수 있다. geometry는 도로를 선택한 뒤 해당 shard 하나만 읽는다. 검색 metadata 캐시는 16개, geometry 캐시는 2개로 제한한다. LINK 상세도 펼친 뒤 40개씩 추가한다.

현대 브라우저의 DecompressionStream으로 gzip을 해제한다. 호스팅이 이미 gzip을 해제해 전달하는 경우도 파일 magic bytes로 구분한다. 별도 DB·서버·벡터 타일 인프라는 추가하지 않았다. 압축 파일을 포함한 전체 산출물 크기·최종 그룹 개수는 아래 검증 수치에 기록한다.

## 7. 생성/수정한 구현 파일

추가: `scripts/preprocess-road-links.py`, `requirements-roads.txt`, `test-preprocess-road-links.py`, `verify-road-data.py`, `test-road-search.mjs`, `src/lib/road-search.js`, `src/types/road.d.ts`, `src/components/map/RoadInfo.jsx`, `public/data/roads/**`, 이 문서.

수정: `Header.jsx`, `MainPage.jsx`, `NaverMapView.jsx`, `LeafletMapView.jsx`, `naverCourseViewport.js`, `src/styles.css`, `package.json`, `README.md`, `docs/DESIGN.md`, `docs/UX-CONTRACT.md`.

`.env.local`, 기존 mock 데이터, 원본 SHP/NODE, 기존 줌·확대 렌더링 동작은 보존했다. bounds 계산 함수에는 실제 도로를 최대 17까지 맞출 수 있는 옵션을 추가했으며, 예시 코스의 기존 최대 14는 기본값으로 유지했다.

## 8. 검색·선택·지도 흐름

입력 300ms 후 검색 제안을 표시하며 명시적 검색은 즉시 실행한다. IME 조합 중에는 검색/제출을 막는다. 정확한 도로명 우선으로 부분 일치 결과를 제공한다. ‘공원’은 공원로와 관련 도로명을, ‘구로구’는 행정경계 위치를, ‘판교’는 기존 등록 별칭 및 일치하는 도로명을 검색한다. 기존 등록 지역의 명시적 제출은 원래 mock 추천 흐름으로 이어진다.

선택 시 이전 geometry 요청을 취소하고 해당 그룹을 불러온다. 네이버는 기존 `getNaverCourseViewport`로 실제 보이는 화면에 bounds를 맞춰 이동하고, Leaflet은 flyToBounds/fitBounds를 사용한다. 모든 LINK geometry를 빨간색으로 표시하고, click/hover에서 도로명·지역·차로·LINK_ID를 제공한다. tooltip은 DOM textContent로 만들어 데이터 문자열을 HTML로 실행하지 않는다.

실패·빈 결과·재시도·더 보기·지우기·Escape와 키보드 이동을 제공한다. 늦게 끝난 요청은 현재 검색/선택을 덮어쓰지 않는다. 모바일 도로 선택은 지도 보기로 이동하며, 목록에서 도로 상세를 볼 수 있다.

## 9. 실행과 검증

```powershell
npm run dev
npm run test:roads
npm run build
```

전처리는 README의 원본 경로와 옵션으로 실행한다. 앱 실행에는 Python이나 SHP가 필요하지 않다. 재전처리/데이터 검사에는 Python과 `scripts/requirements-roads.txt`가 필요하다.

## 10. 향후 코스 추천 연결

LINK_ID는 문자열 Primary Key로 유지한다. 각 feature에 도로 속성, 노드 ID/이름, geometry, 실제 제한속도와 `trafficVolume`, `accidentCount`, `floatingPopulation`, `difficultyScore`를 포함한다. 아직 수집하지 않은 네 값은 모두 null이다.

선택한 그룹은 `linkIds`, MainPage는 `selectedLinkIds`를 유지하고, `RoadRoute` 타입은 `routeId`와 순서 있는 `linkIds`를 정의한다. 따라서 외부 지표를 LINK_ID로 조인하고 계산한 링크 점수와 실제 연결·통행 방향을 검증하여 순환 코스를 구성할 수 있다. 표시용 roadGroup과 추천 route는 별도 개념이다. 현재는 추천 알고리즘을 추가하지 않았다.

## 11. 배포 상태

로컬 소스와 정적 데이터 연동 작업이다. Git push나 Vercel 배포를 실행하지 않았으므로 기존 배포 사이트가 변경되었다고 주장하지 않는다. 검증 후 현재 프로젝트의 Vercel 빌드/배포 흐름으로 정적 파일을 함께 배포할 수 있다.

## 12. 최종 검증 수치

- 검색 가능한 LINK_ID 1,493,109개: 전체 geometry shard를 순회하여 ID 중복·누락, 그룹 metadata와 실제 구간 수, 좌표 순서·범위·bounds, 미수집 지표 null을 검증했다.
- 도로 그룹 53,233개, 도로명 42,795개, 시군구 256개. 정확한 공원로는 서로 다른 10개 그룹, 공원로 부분 일치 검색 결과는 175개다.
- 전체 정적 데이터 약 149.67MB. 첫 검색 manifest gzip 298,467 bytes, 가장 큰 검색 shard 20,266 bytes, 가장 큰 geometry shard 575,199 bytes다.
- 그룹화 회귀 테스트 6개 통과: 노드 연결, 멀리 떨어진 동명 구간, 12m 분리 차도, 중간 교차의 비연결, 빈 노드, null 처리.
- 실제 검색 모듈의 압축 해제·175개 전체 페이지 조회·대상 LINK geometry·부분 일치·지역 검색·빈 검색·AbortError·파일 요청 실패 처리 검증 통과.
- 네이버와 Leaflet에서 구로구 공원로의 SVG 도로선 50개와 구간 정보가 실제로 표시되는 것을 브라우저에서 확인했다.
- 네이버에서 구로구 경계 bounds 이동, 13.5→14의 기존 0.5단계 줌, 모바일 390px의 전체 폭 검색·지도 선택·목록 전환을 확인했다.
- 기존 지역 추천·코스 상세·쉬움 필터·재추천·지역 순위·안내 모달·검색 지우기를 확인했다. OS 수준의 실제 IME 입력 및 모든 모바일 기기 테스트까지 수행한 것은 아니다.
- 생산용 빌드 통과. UI 정적 감사 경고/위반 0, git diff 공백 검사 통과. 정적 감사만으로 접근성 전체 준수를 보증하지 않는다.
- 원본 LINK/NODE SHP·DBF·PRJ 여섯 파일의 SHA-256이 재전처리 전후 동일함을 확인했다. 원본과 경계의 checksum은 provenance에 보존했다.
- 화면 캡처는 배포하지 않는 `.local/screenshots/road-navermap-mobile.jpg`, `road-navermap-desktop.jpg`, `road-leaflet-desktop.jpg`에 보관했다.
