# Safe Zone `proceed_data` 변환기

Safe Zone 안에서 받은 CSV의 파일명이 달라도 열 이름으로 AADT 파일을 찾고, `lev5_5_link_id`별 차선당 통행량을 각 `sido_code` 안에서 0.0~100.0 점수로 변환합니다. 결과는 `output/proceed_data.csv`에 저장됩니다. 전국 자료가 있으면 시도별로 각각 정규화하고, 대구 예시 자료만 있으면 대구 그룹만 계산합니다.

## 폴더 사용

1. 반입 승인받은 변환기 폴더를 데이터 안심구역 작업 환경으로 옮깁니다.
2. 원본 CSV를 `input/`에 둡니다. 파일명은 자유지만 필수 열을 포함해야 합니다.
3. 차선 수가 원본에 없다면, 같은 연도·방향·도로 정의를 쓰고 `lev5_5_link_id`로 연결되는 차선 CSV도 `input/`에 둡니다.
4. 변환을 실행합니다.

```powershell
python convert_safezone_csv.py --region-code 27
```

`27`은 대구 시도 코드 예시입니다. 실제 파일의 `sido_code` 값을 확인해 사용하세요. 이 옵션을 생략하면 입력 자료의 모든 시도를 각각 점수화합니다. 특정 지역만 예시로 처리하려면 `--region-code`로 선택할 수 있습니다.

파일명이 자동으로 판별되지 않거나 같은 형식의 CSV가 여러 개 있으면 이름을 직접 지정합니다.

```powershell
python convert_safezone_csv.py --traffic-file traffic_example.csv --lane-file lanes_example.csv --region-code 27
```

기본 입력·출력 폴더 대신 다른 위치를 쓸 수도 있습니다.

```powershell
python convert_safezone_csv.py --input-dir .\input --output-dir .\output --region-code 27
```

Python 표준 라이브러리만 사용합니다.

## 입력 열

AADT CSV에는 다음 열이 필요합니다.

| 의미 | 인식하는 열 이름 예시 |
|---|---|
| Level 5.5 링크 키 | `LEVEL5_5_LINKID` (`lev5_5_link_id` 형식도 인식) |
| 시도 코드 | `SIDO_CODE` |
| 모든 차량 AADT | `ALL_AADT` |
| 차선 수(원본에 있을 때) | `lane`, `lane_cnt`, `차선수`, `차로수` |

공유된 차량통행지표 명세서에는 `LEVEL5_5_LINKID`, `SIDO_CODE`, `ALL_AADT`, `ROAD_LENGTH`, 속도·혼잡·차종별 교통량 등의 열이 보이지만 차선 수는 포함되어 있지 않습니다. 따라서 차선 수가 AADT CSV에 없다면 별도 CSV에 `LEVEL5_5_LINKID`, `lane` 열을 두어야 합니다. `SIGUNGU_CODE`, `EMD_CODE`는 시도별 점수 계산에는 필요하지 않습니다. 헤더가 위 별칭과 다르면 원본 열 이름을 확인해 변환기의 `ALIASES`를 조정해야 합니다. 파일 이름은 자동 탐색 기준이 아닙니다.

## 계산 방식

```text
차선당 통행량 = ALL_aadt / lane
traffic_score = 차선당 통행량 / 같은 sido_code 안의 최고 차선당 통행량 × 100
```

결과는 소수점 첫째 자리에서 반올림합니다. `100.0`은 선택된 시도 안에서 차선당 통행량이 가장 높은 링크라는 상대 비교값입니다. 사고 가능성이나 안전도 점수로 해석하면 안 됩니다. 도로별 점수는 동일한 기간·방향·집계 범위를 가진 AADT와 차선 수를 사용해야 합니다.

중복 링크 행이나 서로 다른 차선 수가 발견되면 임의로 합치지 않고 중단합니다. 행의 방향·시간대 등 단위를 먼저 확인해야 합니다. 차선이 없는 링크가 있으면 기본값으로 중단하며, `--allow-unmatched`는 누락 링크를 제외한 진단용 부분 결과가 필요할 때만 사용합니다.

## 출력 및 반출 검토

`output/proceed_data.csv`에는 다음 두 열만 기록됩니다. `sido_code`는 시도별 정규화 계산에 사용하고 결과에는 남기지 않습니다.

```csv
LEVEL5_5_LINKID,traffic_score
```

원본 `ALL_aadt`, 차선당 통행량, `sido_code`, 시군구·읍면동 코드는 출력하지 않습니다. 전국 데이터에서 같은 `lev5_5_link_id`가 여러 시도에 나타나면 두 열만으로 결과를 구분할 수 없으므로 변환을 중단하고 링크 ID의 전국 고유성을 확인하도록 했습니다. 링크 ID와 점수 조합도 반출 가능한 데이터라고 미리 단정할 수 없습니다. 실제 결과 파일에 대해 데이터 안심구역의 반출 심사와 대회 규정을 확인한 뒤 신청하세요.

현재 프로그램은 앱의 표준 `LINK_ID`와 Level 5.5 ID를 자동으로 바꾸지 않습니다. 기존 `LINK_ID` 도로망에 점수를 붙이려면 해당 데이터 연도에 맞는 `lev5_5_link_id`↔상세도로 링크 교차표를 검증하고, 분할·병합·방향 및 미매칭 비율을 확인해야 합니다. 이 변환기는 교차표를 확인하기 전까지 `lev5_5_link_id`를 그대로 보존합니다.

## View-T 자료 신청 참고

View-T의 도로망 다운로드 목록에서 대구 2021 자료는 `daegu_level5_5_link_2021.zip`(표시명: `2021년_대구광역시_주요도로망Level5.5`)으로 확인됩니다. 같은 기준연도의 매칭표는 `level5.5_level6_matchingtable_2021_.csv`로 표시됩니다. AADT의 실제 기준연도가 다르면 그 연도와 맞는 자료를 신청하세요. [View-T 도로망 다운로드](https://viewt.ktdb.go.kr/cong/map/moveNetworkDownload.do)

신청 창의 필수 과업/연구명 예시: `차근차근: 대구광역시 초보운전자 연습경로 추천 서비스 개발`. 이는 신청용 제목 제안이며 공식 과업명이 아닙니다. 발주처, 소속기관명, 과업기간은 실제 소속과 진행 계획에 맞춰 작성하세요. View-T FAQ에 따르면 Level 5.5와 Level 6은 서로 다른 ID 체계이며, 링크 매칭표는 요청할 수 있지만 일부 링크는 다대일 또는 미매칭일 수 있습니다. [View-T 네트워크 FAQ](https://viewt.ktdb.go.kr/cong/map/faq_Board.do)

## 데이터 보관

실제 원본과 생성 결과는 입력·출력 폴더의 `.gitignore` 규칙으로 Git에서 제외합니다. 승인된 Safe Zone 안에서만 작업하고, 원본 CSV를 GitHub나 개인 저장소에 올리지 마세요.
