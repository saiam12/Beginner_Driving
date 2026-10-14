# Level 5.5 도로망과 교통량 적용

2026-10-10 기준, 애플리케이션의 ITS 도로망을 View-T 2024년 전국 Level 5.5 원본으로 교체했다. 검색, 차로 타일, 후보 탐색, 예시 코스, 저장 코스가 동일한 식별체계를 사용한다. 원본 형상·방향별 노드·차로까지 교체했다.

## 원본과 변환

- [공식 네트워크 다운로드](https://viewt.ktdb.go.kr/cong/map/moveNetworkDownload.do): 2024년 17개 시도 Level 5.5 ZIP.
- [공식 도로구간 표](https://viewt.ktdb.go.kr/cong/map/TableMove_Zeke.do): 2024년 평일 추정 AADT 119,413행.
- DBF 인코딩은 CP949, 원본 PRJ는 ITRF2000 UTM_K다. 선언된 좌표계로 WGS84 변환을 수행했다.
- k_link_id를 linkId와 lev5_5_link_id로, fnode_id/tnode_id를 fNode/tNode로, lane을 lanes로 보존한다. 역방향 구간을 만들지 않는다.
- 원본 ZIP별 SHA-256, CRS, 전국 집계를 public/data/roads/provenance.json에 기록한다.

## 교통량과 비용

전국 도로망은 119,466개 구간이다. 교통량 119,413행은 모두 동일 연도의 동일 Level 5.5 ID에 직접 연결된다. 도로명·차로·도로 등급·시도·원본 길이를 대조했다. 53개 미관측 구간은 trafficVolume: null로 유지한다. ITS ID 매칭과 별도 교통량 보정 로더는 제거했다.

trafficVolume은 평일 AADT/24의 시간당 평균 대리값이다. trafficPerLaneReference는 같은 시도 전체 유효 자료 중 차로당 AADT 최댓값/24다. 두 값의 기간은 2024:weekday:estimated-aadt-hourly-mean으로 일치한다.

```text
교통량 점수 = min(1, (trafficVolume / lanes) / trafficPerLaneReference)
교통량 비용 = 실제 구간 길이(m) × 2 × 교통량 점수
총 비용 = 차로 비용 + 차로 선호 비용 + 교통량 비용 + 사고 비용 + 회전 비용
```

올림픽대로 1014051은 4차로, 평일 AADT 90,682다. 서울 기준 58,071대/일/차로와 비교하면 교통량 점수 약 0.390393, 1km당 교통량 추가 비용 약 780.786이다. 실제 주행 거리와 별개이며 화폐 단위가 아니다. 사고 자료와 실시간 교통은 연결하지 않았다.

후보와 저장 코스에 costBreakdown 및 dataCoverage를 보존한다. 서울 예시 순환 코스 6개를 새 도로망과 교통량으로 다시 생성했다. 새 저장 공간은 beginner-driving.saved-courses.level55.v2다. 기존 브라우저 저장 데이터는 수정하지 않으며 새 목록과 섞지 않는다.

## 원본 연결의 한계

동일 노드의 원본 도로선 끝점에 좌표 차이가 있을 수 있다. 원본을 임의로 스냅하지 않고 노드와 방향을 유지한다. 후보 탐색은 연속 도로의 끝점 간격이 60m를 넘는 연결을 거부한다. 전국 감사에서 기준을 넘는 원본 연결 5개를 발견했고 최대 간격은 약 84.05m였다. 서울 예시 코스는 모두 허용 간격 이내이며 방향별 노드가 순환한다. 거리는 각 원본 도로선 길이의 합계이며 끝점 간 표시 간격을 더하지 않는다.

2024년 주요 도로망이므로 전국 모든 골목, 현재 진입·회전 제한·공사·제한속도를 검증한 내비게이션 자료는 아니다.

## 검증과 복구

- scripts/verify-level55-data.py: 전국 ID·중복 타일·교통량·검색 형상·노드 간격 감사.
- scripts/test-level55-traffic.py: 단위·조건, 유효 0/미관측, 속성 불일치 배제.
- scripts/test-level55-data.mjs: 실제 앱 로더, 후보 비용 합계·적용 비율·저장 데이터 검증.
- scripts/test-seoul-courses.mjs: 예시 6개 원본 형상·방향·노드 순환·거리 합계 검증.
- 기존 데이터: .local/roads-its-backup-20261010. 이전 매칭 코드와 문서: .local/level55-obsolete-code.

재생성은 README를 참고한다. ITS 전처리 명령은 실행을 차단했다. 과거 ROAD-DATA-INTEGRATION.md와 이전 기획서는 이번 교체 전의 기록이다.
