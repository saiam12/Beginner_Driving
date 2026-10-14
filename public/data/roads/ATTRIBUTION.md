# 도로 데이터 출처

- 지도 차로 수 표시: 국토교통부/ITS 표준노드링크 [2026-09-14]NODELINKDATA의 MOCT_LINK, 총 1,562,356개 방향별 구간. `lanes-its/`에 별도 보관하며 원본 PRJ로 변환한 WGS84 공간 타일을 사용한다. 원본 LANES를 왕복 합계로 바꾸지 않는다. https://www.its.go.kr/nodelink/nodelinkStatus?service=inquiryNodelink
  이 자료는 차로 확인용이며 View-T의 ID별 관측을 ITS ID에 자동 연결하지 않는다. `accidents-2024-daegu-its.json`은 TAAS 대구 2024년 사고 10,222건을 EPSG:5179에서 ITS 도로에 별도로 공간 매핑한 결과다. 15m 이내 최근접 구간 하나에 8,310건을 연결하고 1,912건은 제외했다(기존 사용자 제외 2건 포함). 사고 진행 방향은 확정하지 않으며 2024년 사고와 2026-09-14 도로망의 시점 차이가 있다. 대구 경계 안의 도로에 한해 미연결을 0건으로 표시하고 범위 밖은 자료 없음으로 표시한다. 공식 도로별 사고 통계가 아닌 추정 배정이며 기존 View-T 코스 비용은 변경하지 않는다.

- 사고 집계: TAAS GIS의 대구 2024년 사고 좌표를 2024년 Level 5.5 도로망에 15m 이내 최근접 링크로 공간 매칭. https://taas.koroad.or.kr/gis/mcm/mcl/initMap.do?menuId=GIS_GMP_STS_RSN
  accidents-2024-daegu.json은 6,440건·1,874개 링크의 추정 집계이며 원본 사고번호·개인 정보는 포함하지 않는다. 매칭 없는 링크는 무사고로 단정하지 않는다.

- 도로 형상·방향별 노드·차로·ID: 한국교통연구원 KTDB View-T의 2024년 전국 17개 시도 Level 5.5 네트워크. https://viewt.ktdb.go.kr/cong/map/moveNetworkDownload.do
- 교통량: 같은 서비스의 2024년 도로구간 평일 추정 AADT. https://viewt.ktdb.go.kr/cong/map/TableMove_Zeke.do
- 행정구역 표시: SGIS 원자료 기반 admdongkor 2026-07-01 경계. https://github.com/vuski/admdongkor/tree/master/ver20260701

원본 PRJ의 ITRF2000 UTM_K 좌표를 WGS84로 변환했다. 원본 방향과 노드 연결을 유지하며 역방향 구간을 만들지 않는다. 원본 ZIP 해시와 변환·집계 정보는 provenance.json에 기록한다. 교통량은 실시간 관측값이 아니다. 교통량이 없는 53개 구간은 미확인으로 유지한다. 실제 통행 제한·사고·제한속도는 제공하지 않는다.

- ITS 사고 위치: 위 공간 배정과 동일한 8,310건의 원본 사고 좌표(EPSG:5179)를 EPSG:4326으로 변환하여 구간별 `points`로 제공한다. 도로로 좌표를 스냅하지 않으며 사고 발생 월·시간·유형·심각도만 포함한다. 사고 식별자·당사자 속성·개인 정보는 지도 표시 자료에 포함하지 않는다.
