# 시도별 차로당 통행량 점수화

이 폴더 전체를 JupyterLab 환경에 복사하고 `aadt_scoring.ipynb`를 엽니다.
아래 두 파일을 `input` 폴더에 넣고 **Run → Run All Cells**를 실행하세요.
파일명이 다르면 노트북의 `INPUT_PATH`, `LANE_PATH`를 변경합니다.

- `traffic.csv`: sido_code, sigungu_code, emd_code, lev5_5_link_id, all_aadt
- `lanes.csv`: lev5_5_link_id, lane

통행량 파일에 `lane` 컬럼도 있으면 `LANE_PATH = None`으로 설정합니다.
차로 수 자료 없이 통행량만으로 계산하지 않습니다.
CSV, XLSX, Parquet를 지원합니다. CSV 기본 인코딩은 utf-8-sig이며 한글 인코딩 오류 시 cp949로 바꿉니다.
필요 패키지는 requirements.txt에 있으며 노트북의 설치 셀은 필요한 경우에만 주석을 해제합니다.

## 계산

1. 같은 sido_code와 lev5_5_link_id의 유효 all_aadt 최댓값 → road_max_aadt
2. road_max_aadt / lane → per_lane_aadt
3. 같은 sido_code의 per_lane_aadt 최댓값 → sido_max_per_lane_aadt
4. per_lane_aadt / sido_max_per_lane_aadt × 100 → traffic_score (소수점 한 자리)

예: 같은 시도에서 A 도로 30,000대 / 3차로 = 10,000대, B 도로 20,000대 / 1차로 = 20,000대라면 A는 50.0점, B는 100.0점입니다.
분모는 AADT 최댓값을 가진 도로가 아니라 **차로당 통행량이 가장 큰 도로의 값**입니다.
계산 중간값은 반올림하지 않고 최종 점수만 반올림합니다. 반출 CSV 점수는 소수점 한 자리로 저장합니다.
높을수록 차로당 통행량이 높으며 안전 점수나 시도 간 절대 비교 점수는 아닙니다.

## 차로 자료의 기준

차로 파일에는 통행량과 같은 기준연도의 Level 5.5 링크 ID 및 해당 통행량의 방향·범위와 일치하는 양의 정수 차로 수가 필요합니다.
방향별 통행량에는 같은 방향 차로 수, 양방향 합산 통행량에는 합산 차로 수를 사용하세요.
현재 프로젝트의 MOCT_LINK LINK_ID와 Level 5.5 ID는 직접 동일시하지 않습니다.
표준노드링크 LANES를 사용하려면 별도의 검증된 ID 대응표가 필요합니다.
Level 5.5 대표 차로 수는 세부 구간의 차로 변화를 모두 반영하지 않을 수 있습니다.

## 출력과 예외

`output/aadt_scored.csv`만 저장하며 반출 컬럼은 **lev5_5_link_id, traffic_score** 두 개입니다.
통행량, 차로 수, 지역 코드, 검증용 중간값과 시도별 요약은 노트북 안에서만 확인하며 파일로 저장하지 않습니다.
계산할 때 입력 행 순서와 중복을 유지하고 같은 도로의 행에는 같은 점수를 부여합니다. 합산하지 않습니다.
반출할 때 점수 미계산 링크는 제외하고 같은 링크는 한 번만 저장합니다. 같은 링크에 서로 다른 시도별 점수가 있으면 반출을 중단합니다.
입력에는 비교하려는 동일 기준연도·집계 조건의 자료를 넣으세요. 연도가 섞이면 입력 전체 기간의 도로별 최대값이 됩니다.

결측·음수·무한대·숫자가 아닌 AADT는 최대값 계산에서 제외합니다. 같은 도로에 유효 AADT가 하나도 없으면 invalid_road_aadt입니다.
차로 수가 없거나 0·음수·소수·무한대이면 missing_or_invalid_lane이며 점수와 시도 최대값 계산에서 제외합니다.
시도·링크 코드 누락은 missing_sido_code 또는 missing_link_id입니다.
시도의 계산 가능한 차로당 통행량이 전부 0이면 0.0점, zero_sido_max입니다.
차로 누락 도로가 있으면 최대값은 차로 수를 연결한 도로만의 최대이므로 시도 전체를 대표한다고 단정하지 마세요.
같은 링크에 서로 다른 유효 차로 수가 있으면 실행을 중단합니다. 임의로 평균내지 않습니다.

컬럼명 앞뒤 공백과 대소문자를 정리하며 나머지 컬럼은 결과에서 제외합니다. sigungu_code는 한 번만 사용합니다.
코드·링크 ID는 문자열로 읽어 앞자리 0을 보존합니다. 원본 Excel에서 이미 사라진 0은 복구하지 않습니다.
쉼표가 있는 AADT도 변환합니다. 노트북의 all_aadt는 숫자로 정리되며 잘못된 값은 공란입니다. 반출에는 포함하지 않습니다.
원본 파일은 수정하지 않습니다. 재실행은 기존 결과 파일을 갱신합니다.
input과 output의 데이터는 이 저장소의 Git 추적에서 제외합니다.

## 차로 파일 확보 경로 (2026-10-07 확인)

View-T 도로망 다운로드: https://viewt.ktdb.go.kr/cong/map/moveNetworkDownload.do
상세구분을 주요도로망으로 선택하면 시도별 `*_link_lev5.5_2024.zip`과
`level5.5_level6_matchingtable_2024.csv`가 목록에 있습니다. 기준연도는 통행량 자료와 맞추세요.
다운로드에는 성별·연령·소속·연구 정보 신청서 작성이 필요합니다. 현재 파일 내부 컬럼은 확인하지 못했습니다.

공식 보고서는 Level 5.5의 `k_link_id`, `lane`, Level 5.5↔6 관계표의 `k_link_id`, `seq`, `link_id`,
Level 6의 방향별 표준노드링크 ID를 정의합니다.
https://www.ktdb.go.kr/DATA/pblcte/20250805093928585.pdf

Level 5.5 파일에 해당 방향의 차로 수가 있다면 `k_link_id`를 `lev5_5_link_id`로 정리하고
`lane`과 함께 CSV로 저장해 lanes.csv로 사용합니다. 내려받은 실제 속성명과 방향 정의부터 확인하세요.
기존 LANES 재사용은 Level 5.5→Level 6 가상링크→방향별 표준노드링크 ID→MOCT_LINK로 연결해야 합니다.
한 Level 5.5 링크의 세부 구간마다 차로 수가 다르면 대표 차로 수 결정이 필요합니다.
현재 코드에는 이 검증되지 않은 대응이나 차로 수 집계 규칙을 자동 추정하는 기능을 넣지 않았습니다.
