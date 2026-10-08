"""Normalize road maximum AADT per lane to 0–100 within each SIDO_CODE."""
from pathlib import Path

import pandas as pd


COLUMNS = ["sido_code", "sigungu_code", "emd_code", "lev5_5_link_id", "all_aadt"]


def load_data(path, encoding="utf-8-sig"):
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, dtype="string", encoding=encoding)
    if suffix == ".xlsx":
        return pd.read_excel(path, dtype="string")
    if suffix == ".parquet":
        return pd.read_parquet(path)
    raise ValueError("지원 형식: .csv, .xlsx, .parquet")


def score_aadt(data, lane_data=None):
    """Score road maximum AADT per lane within each province, retaining input rows."""
    data = data.copy()
    data.columns = [str(column).strip().lower() for column in data.columns]
    if data.columns.duplicated().any():
        raise ValueError("컬럼 이름이 중복됩니다. 중복 컬럼을 제거한 뒤 실행하세요.")
    missing = [column for column in COLUMNS if column not in data.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {', '.join(missing)}")
    result = data[COLUMNS].copy().reset_index(drop=True)
    for column in COLUMNS[:-1]:
        result[column] = result[column].astype("string").str.strip().replace("", pd.NA)

    if lane_data is None:
        if "lane" not in data.columns:
            raise ValueError("차로 수가 필요합니다. lev5_5_link_id, lane 컬럼이 있는 차로 파일을 넣으세요.")
        lanes = data[["lev5_5_link_id", "lane"]].copy()
    else:
        lanes = lane_data.copy()
        lanes.columns = [str(column).strip().lower() for column in lanes.columns]
        if lanes.columns.duplicated().any():
            raise ValueError("차로 파일의 컬럼 이름이 중복됩니다.")
        if not {"lev5_5_link_id", "lane"}.issubset(lanes.columns):
            raise ValueError("차로 파일에는 lev5_5_link_id, lane 컬럼이 필요합니다.")
        lanes = lanes[["lev5_5_link_id", "lane"]]
    lanes["lev5_5_link_id"] = lanes["lev5_5_link_id"].astype("string").str.strip().replace("", pd.NA)
    lanes["lane"] = pd.to_numeric(lanes["lane"], errors="coerce")
    valid_lane = lanes["lane"].notna() & lanes["lane"].gt(0) & ~lanes["lane"].isin([float("inf"), -float("inf")])
    valid_lane &= lanes["lane"].mod(1).eq(0)
    lanes["lane"] = lanes["lane"].where(valid_lane)
    conflicts = lanes.groupby("lev5_5_link_id")["lane"].nunique().gt(1)
    if conflicts.any():
        raise ValueError("같은 링크에 서로 다른 차로 수가 있습니다. 기준연도와 방향별 차로 수를 확인하세요: " + ", ".join(conflicts[conflicts].index[:5]))
    lane_map = lanes.dropna(subset=["lev5_5_link_id"]).groupby("lev5_5_link_id")["lane"].max()
    result["lane"] = result["lev5_5_link_id"].map(lane_map)

    raw = result["all_aadt"].astype("string").str.strip()
    volume = pd.to_numeric(raw.str.replace(",", "", regex=False), errors="coerce")
    valid = volume.notna() & volume.ge(0) & ~volume.isin([float("inf"), -float("inf")])
    result["all_aadt"] = volume.where(valid)
    result["road_max_aadt"] = result.groupby(["sido_code", "lev5_5_link_id"])["all_aadt"].transform("max")
    result["score_status"] = "ok"
    result.loc[result["road_max_aadt"].isna(), "score_status"] = "invalid_road_aadt"
    result.loc[result["lane"].isna(), "score_status"] = "missing_or_invalid_lane"
    result.loc[result["lev5_5_link_id"].isna(), "score_status"] = "missing_link_id"
    result.loc[result["sido_code"].isna(), "score_status"] = "missing_sido_code"
    eligible = result["score_status"].eq("ok")
    result["per_lane_aadt"] = (result["road_max_aadt"] / result["lane"]).where(eligible)
    maximum = result.groupby("sido_code")["per_lane_aadt"].transform("max")
    result["sido_max_per_lane_aadt"] = maximum
    result["traffic_score"] = (result["per_lane_aadt"] / maximum.where(maximum.gt(0)) * 100).round(1)
    zero = eligible & maximum.eq(0)
    result.loc[zero, "traffic_score"] = 0.0
    result.loc[zero, "score_status"] = "zero_sido_max"

    summary = result.groupby("sido_code", dropna=False).agg(
        row_count=("lev5_5_link_id", "size"),
        road_count=("lev5_5_link_id", "nunique"),
        scored_row_count=("traffic_score", "count"),
        sido_max_per_lane_aadt=("sido_max_per_lane_aadt", "max"),
        max_score=("traffic_score", "max"),
    ).reset_index()
    summary["unscored_row_count"] = summary["row_count"] - summary["scored_row_count"]
    return result, summary


def save_results(result, output_dir):
    """Export only one scored row per Level 5.5 link, with no raw metrics."""
    export = result[["lev5_5_link_id", "traffic_score"]].dropna().copy()
    conflicts = export.groupby("lev5_5_link_id")["traffic_score"].nunique().gt(1)
    if conflicts.any():
        raise ValueError("같은 링크에 서로 다른 시도별 점수가 있어 반출할 수 없습니다. 링크의 시도 소속을 확인하세요: " + ", ".join(conflicts[conflicts].index[:5]))
    export = export.drop_duplicates(subset="lev5_5_link_id")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    result_path = output_dir / "aadt_scored.csv"
    export.to_csv(result_path, index=False, encoding="utf-8-sig", float_format="%.1f")
    return result_path
