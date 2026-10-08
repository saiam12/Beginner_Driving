"""Create a minimized, per-province traffic score CSV from Safe Zone exports.

The input filename is discovered from its column headers. Raw AADT and the
calculated per-lane volume are never written to the output file.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Iterator


ALIASES = {
    "link": ("level55linkid", "lev55linkid", "lev55link"),
    "sido": ("sidocode", "sido"),
    "aadt": ("allaadt", "allvehicleaadt", "전체차량통행량"),
    "lane": ("lane", "lanes", "lanecnt", "lanecount", "laneno", "lanenum", "차선수", "차로수"),
}


def normalized_header(value: str) -> str:
    value = value.lstrip("\ufeff").strip().casefold()
    return re.sub(r"[^0-9a-z가-힣]+", "", value)


def find_column(headers: list[str] | None, kind: str) -> str | None:
    if not headers:
        return None
    normalized = {normalized_header(header): header for header in headers}
    for alias in ALIASES[kind]:
        if alias in normalized:
            return normalized[alias]
    return None


def choose_encoding(path: Path) -> str:
    sample = path.read_bytes()[:128_000]
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            sample.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    raise ValueError(f"문자 인코딩을 판별할 수 없습니다: {path.name}")


def read_headers(path: Path) -> list[str] | None:
    encoding = choose_encoding(path)
    with path.open("r", encoding=encoding, newline="") as stream:
        return csv.DictReader(stream).fieldnames


def iter_rows(path: Path) -> Iterator[dict[str, str | None]]:
    encoding = choose_encoding(path)
    try:
        with path.open("r", encoding=encoding, newline="") as stream:
            yield from csv.DictReader(stream)
    except UnicodeDecodeError as exc:
        raise ValueError(f"파일 중간에 {encoding}으로 읽을 수 없는 문자가 있습니다: {path.name}") from exc


def csv_files(folder: Path) -> list[Path]:
    if not folder.is_dir():
        raise ValueError(f"입력 폴더가 없습니다: {folder}")
    return sorted((path for path in folder.iterdir() if path.is_file() and path.suffix.casefold() == ".csv"), key=lambda p: p.name.casefold())


def select_file(
    files: list[Path],
    explicit_name: str | None,
    input_dir: Path,
    purpose: str,
) -> Path | None:
    if explicit_name:
        candidate = Path(explicit_name)
        if not candidate.is_absolute():
            candidate = input_dir / candidate
        candidate = candidate.resolve()
        if candidate.parent != input_dir.resolve() or not candidate.is_file():
            raise ValueError(f"{purpose} CSV는 입력 폴더 바로 안에 있는 파일이어야 합니다: {explicit_name}")
        return candidate
    return None


def parse_number(value: str | None, label: str, link_id: str) -> Decimal:
    if value is None or not value.strip():
        raise ValueError(f"{label} 값이 비어 있습니다. lev5_5_link_id={link_id}")
    try:
        number = Decimal(value.strip().replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError(f"{label} 숫자를 읽을 수 없습니다: {value!r}, lev5_5_link_id={link_id}") from exc
    if not number.is_finite():
        raise ValueError(f"{label} 값이 유한한 숫자가 아닙니다: {value!r}, lev5_5_link_id={link_id}")
    return number


def load_lane_lookup(
    path: Path, link_column: str, lane_column: str, sido_column: str | None
) -> dict[tuple[str | None, str], Decimal]:
    lanes: dict[tuple[str | None, str], Decimal] = {}
    for row_number, row in enumerate(iter_rows(path), start=2):
        link_id = (row.get(link_column) or "").strip()
        if not link_id:
            raise ValueError(f"차선 자료 {path.name} {row_number}행의 lev5_5_link_id가 비어 있습니다.")
        sido_code = (row.get(sido_column) or "").strip() if sido_column else None
        key = (sido_code or None, link_id)
        lane = parse_number(row.get(lane_column), "lane", link_id)
        if lane <= 0 or lane != lane.to_integral_value():
            raise ValueError(f"차선 수는 1 이상의 정수여야 합니다: {lane}, lev5_5_link_id={link_id}")
        if key in lanes and lanes[key] != lane:
            raise ValueError(f"같은 lev5_5_link_id에 서로 다른 차선 수가 있습니다: {link_id}")
        lanes[key] = lane
    return lanes


def main() -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Safe Zone AADT CSV를 시도별 0.0~100.0 상대 통행량 점수 CSV로 변환합니다."
    )
    parser.add_argument("--input-dir", type=Path, default=here / "input", help="원본 CSV를 둘 폴더")
    parser.add_argument("--output-dir", type=Path, default=here / "output", help="proceed_data.csv 저장 폴더")
    parser.add_argument("--traffic-file", help="자동 탐색이 모호할 때 AADT CSV 파일명 지정")
    parser.add_argument("--lane-file", help="AADT CSV에 차선 열이 없을 때 차선 CSV 파일명 지정")
    parser.add_argument("--region-code", help="한 시도만 처리할 때 해당 CSV의 sido_code 지정")
    parser.add_argument(
        "--allow-unmatched",
        action="store_true",
        help="차선 수를 찾지 못한 도로를 제외하고 진단용 부분 결과 생성",
    )
    args = parser.parse_args()

    try:
        input_dir = args.input_dir.resolve()
        files = csv_files(input_dir)
        if not files:
            raise ValueError(f"입력 폴더에 CSV 파일이 없습니다: {input_dir}")

        explicit_traffic = select_file(files, args.traffic_file, input_dir, "AADT")
        headers_by_file = {path: read_headers(path) for path in files}
        traffic_candidates = [
            path
            for path, headers in headers_by_file.items()
            if find_column(headers, "link") and find_column(headers, "sido") and find_column(headers, "aadt")
        ]
        if explicit_traffic:
            traffic_path = explicit_traffic
            if traffic_path not in traffic_candidates:
                raise ValueError("지정한 AADT CSV에서 lev5_5_link_id, sido_code, ALL_aadt 열을 모두 찾지 못했습니다.")
        elif len(traffic_candidates) == 1:
            traffic_path = traffic_candidates[0]
        elif not traffic_candidates:
            raise ValueError(
                "AADT CSV를 찾지 못했습니다. CSV 헤더에 LEVEL5_5_LINKID, SIDO_CODE, ALL_AADT가 있어야 합니다. "
                "실제 헤더가 다르면 파일 형식을 먼저 확인하세요."
            )
        else:
            names = ", ".join(path.name for path in traffic_candidates)
            raise ValueError(f"AADT CSV 후보가 여러 개입니다: {names}. --traffic-file로 하나를 지정하세요.")

        traffic_headers = headers_by_file[traffic_path]
        link_column = find_column(traffic_headers, "link")
        sido_column = find_column(traffic_headers, "sido")
        aadt_column = find_column(traffic_headers, "aadt")
        traffic_lane_column = find_column(traffic_headers, "lane")

        lane_lookup: dict[str, Decimal] = {}
        if not traffic_lane_column:
            explicit_lane = select_file(files, args.lane_file, input_dir, "차선")
            lane_candidates = [
                path
                for path, headers in headers_by_file.items()
                if path != traffic_path and find_column(headers, "link") and find_column(headers, "lane")
            ]
            if explicit_lane:
                if explicit_lane not in lane_candidates:
                    raise ValueError("지정한 차선 CSV에서 lev5_5_link_id와 lane 열을 모두 찾지 못했습니다.")
                lane_path = explicit_lane
            elif len(lane_candidates) == 1:
                lane_path = lane_candidates[0]
            elif not lane_candidates:
                raise ValueError(
                    "차선 수를 찾지 못했습니다. AADT CSV에 lane 열을 넣거나, 같은 lev5_5_link_id를 키로 가진 "
                    "차선 CSV를 입력 폴더에 추가하세요. LINK_ID 자료는 검증된 매칭표 없이는 사용할 수 없습니다."
                )
            else:
                names = ", ".join(path.name for path in lane_candidates)
                raise ValueError(f"차선 CSV 후보가 여러 개입니다: {names}. --lane-file로 하나를 지정하세요.")
            lane_link_column = find_column(headers_by_file[lane_path], "link")
            lane_column = find_column(headers_by_file[lane_path], "lane")
            lane_sido_column = find_column(headers_by_file[lane_path], "sido")
            lane_lookup = load_lane_lookup(lane_path, lane_link_column, lane_column, lane_sido_column)

        records: list[tuple[str, str, Decimal, Decimal]] = []
        seen_links: set[tuple[str, str]] = set()
        unmatched: list[str] = []
        input_count = 0
        for row_number, row in enumerate(iter_rows(traffic_path), start=2):
            input_count += 1
            link_id = (row.get(link_column) or "").strip()
            sido_code = (row.get(sido_column) or "").strip()
            if not link_id or not sido_code:
                raise ValueError(f"AADT CSV {row_number}행의 lev5_5_link_id 또는 sido_code가 비어 있습니다.")
            if args.region_code and sido_code != args.region_code.strip():
                continue
            identity = (sido_code, link_id)
            if identity in seen_links:
                raise ValueError(
                    f"같은 시도와 링크 ID가 여러 번 나옵니다: sido_code={sido_code}, lev5_5_link_id={link_id}. "
                    "방향·시간대 등 행 단위를 확인한 뒤 공식 기준에 맞게 집계해야 합니다."
                )
            seen_links.add(identity)

            if traffic_lane_column:
                lane = parse_number(row.get(traffic_lane_column), "lane", link_id)
                if lane <= 0 or lane != lane.to_integral_value():
                    raise ValueError(f"차선 수는 1 이상의 정수여야 합니다: {lane}, lev5_5_link_id={link_id}")
            else:
                lane = lane_lookup.get((sido_code, link_id), lane_lookup.get((None, link_id)))
                if lane is None:
                    unmatched.append(link_id)
                    continue

            aadt = parse_number(row.get(aadt_column), "ALL_aadt", link_id)
            if aadt < 0:
                raise ValueError(f"ALL_aadt는 음수일 수 없습니다: {aadt}, lev5_5_link_id={link_id}")
            records.append((sido_code, link_id, aadt, lane))

        if args.region_code and not seen_links:
            raise ValueError(f"sido_code={args.region_code}에 해당하는 도로가 없습니다.")
        if unmatched and not args.allow_unmatched:
            examples = ", ".join(unmatched[:5])
            raise ValueError(
                f"차선 수가 없는 링크가 {len(unmatched)}개 있습니다(예: {examples}). "
                "링크 매칭과 차선 자료의 연도·방향·범위를 확인하세요. 진단 목적일 때만 --allow-unmatched를 사용하세요."
            )
        if not records:
            raise ValueError("점수화할 수 있는 도로가 없습니다.")

        per_sido: dict[str, list[tuple[str, Decimal]]] = defaultdict(list)
        for sido_code, link_id, aadt, lane in records:
            per_sido[sido_code].append((link_id, aadt / lane))

        scores_by_link: dict[str, tuple[str, str]] = {}
        for sido_code, values in per_sido.items():
            maximum = max(value for _, value in values)
            if maximum <= 0:
                raise ValueError(f"sido_code={sido_code}의 ALL_aadt가 모두 0이어서 점수를 계산할 수 없습니다.")
            for link_id, per_lane_aadt in values:
                score = (per_lane_aadt / maximum * Decimal("100")).quantize(
                    Decimal("0.1"), rounding=ROUND_HALF_UP
                )
                if link_id in scores_by_link:
                    previous_sido = scores_by_link[link_id][0]
                    raise ValueError(
                        f"lev5_5_link_id={link_id}가 여러 sido_code에서 발견되어 결과 키가 모호합니다 "
                        f"({previous_sido}, {sido_code}). 전국 고유 링크 ID인지 확인하세요."
                    )
                scores_by_link[link_id] = (sido_code, f"{score:.1f}")

        output_rows = sorted((link_id, score) for link_id, (_, score) in scores_by_link.items())
        output_dir = args.output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "proceed_data.csv"
        temp_path = output_dir / ".proceed_data.csv.tmp"
        with temp_path.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(("LEVEL5_5_LINKID", "traffic_score"))
            writer.writerows(output_rows)
        temp_path.replace(output_path)

        print(f"AADT CSV: {traffic_path.name}")
        print(f"처리 대상 행: {input_count if not args.region_code else len(seen_links)}")
        print(f"점수 결과 행: {len(output_rows)}")
        print(f"미매칭 행: {len(unmatched)}")
        print(f"시도별 점수화 건수: {', '.join(f'{code}={len(items)}' for code, items in sorted(per_sido.items()))}")
        print(f"출력: {output_path}")
        print("출력 열은 LEVEL5_5_LINKID, traffic_score이며 SIDO_CODE는 시도별 계산에만 사용합니다.")
        print("원본 ALL_aadt와 차선당 통행량은 출력하지 않습니다.")
        return 0
    except (OSError, ValueError) as exc:
        print(f"변환 실패: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
