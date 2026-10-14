"""Match each retained TAAS point to one ITS segment, in a metric CRS."""
import csv
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, box, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]


def accident_points(accidents, rows):
    """Retain original coordinates and non-personal accident categories only."""
    source = {item['acdnt_no']: item for item in accidents}
    project = Transformer.from_crs(5179, 4326, always_xy=True)
    groups = {}
    for row in rows:
        if row['status'] != 'mapped':
            continue
        item = source[row['accident_id']]
        lng, lat = project.transform(float(item['x_crdnt']), float(item['y_crdnt']))
        groups.setdefault(row['its_link_id'], []).append(dict(coordinates=[lng, lat],
            month=item['acdnt_dd_dc'].strip(), time=item['occrrnc_time_dc'].strip(),
            type=item['acdnt_dc'].strip(), severity=item['acdnt_gae_dc'].strip()))
    return groups


def enrich_existing_points():
    raw = ROOT / '.local/daegu-accidents-2024/response.json'
    report = json.loads((ROOT / 'outputs/daegu-accident-its-2024/report.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == report['sourceHashes']['accidents']
    accidents = json.loads(raw.read_text(encoding='utf-8-sig'))['resultValue']['accidentInfoList']
    with (ROOT / 'outputs/daegu-accident-its-2024/전체_판정결과.csv').open(encoding='utf-8-sig') as stream:
        rows = list(csv.DictReader(stream))
    path = ROOT / 'public/data/roads/accidents-2024-daegu-its.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    groups = accident_points(accidents, rows)
    assert len(rows) == len(accidents) == data['sourceAccidents'] == 10222
    assert set(groups) == set(data['links'])
    for key, values in data['links'].items():
        assert len(groups[key]) == values['count']
        values['points'] = groups[key]
    assert sum(len(items) for items in groups.values()) == data['mappedAccidents'] == 8310
    data['pointCoordinates'] = 'EPSG:4326-original-accident-location'
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('PASS: 8,310 original accident positions attached to existing 5,450 ITS assignments; mapping unchanged')


def nearest_assignment(point, tree, geometries, ids, radius=15):
    candidates = []
    for index in tree.query(point.buffer(radius)):
        index = int(index)
        distance = point.distance(geometries[index])
        if distance <= radius:
            candidates.append((distance, int(ids[index]), index))
    if not candidates:
        return None, None, False
    candidates.sort()
    distance, _, index = candidates[0]
    tied = sum(abs(item[0] - distance) < 1e-8 for item in candidates) > 1
    return index, distance, tied


def main():
    raw = ROOT / '.local/daegu-accidents-2024/response.json'
    data = json.loads(raw.read_text(encoding='utf-8-sig'))['resultValue']
    accidents = data['accidentInfoList']
    assert len(accidents) == data['paginationInfo']['totalRecordCount'] == 10222
    assert len({a['acdnt_no'] for a in accidents}) == 10222
    assert all(a['acdnt_year'] == '2024' and a['legaldong_code'].startswith('27') for a in accidents)
    boundaries_path = ROOT / '.local/roads/admin-boundaries.geojson'
    boundaries = json.loads(boundaries_path.read_text(encoding='utf-8'))
    daegu = unary_union([shape(f['geometry']) for f in boundaries['features'] if f['properties']['sidonm'] == '대구광역시'])
    assert not daegu.is_empty and daegu.is_valid
    to_wgs = Transformer.from_crs(5179, 4326, always_xy=True)
    to_meters = Transformer.from_crs(4326, 5179, always_xy=True)
    points = [Point(float(a['x_crdnt']), float(a['y_crdnt'])) for a in accidents]
    coords = [to_wgs.transform(p.x, p.y) for p in points]
    plausible = [math.isfinite(x) and math.isfinite(y) and 127 < x < 130 and 34 < y < 38 for x, y in coords]
    valid_coords = [xy for xy, valid in zip(coords, plausible) if valid]
    extent = box(min(x for x, y in valid_coords), min(y for x, y in valid_coords), max(x for x, y in valid_coords), max(y for x, y in valid_coords)).union(daegu.envelope).envelope.buffer(.005)
    folder = ROOT / 'public/data/roads/lanes-its'
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['identifierSystem'] == 'its' and manifest['targetCrs'] == 'EPSG:4326'
    features = {}
    for key in manifest['tiles']:
        x, y = map(int, key.split('/'))
        n = 2 ** manifest['tileZoom']
        west, east = x / n * 360 - 180, (x + 1) / n * 360 - 180
        north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
        south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
        if not box(west, south, east, north).intersects(extent):
            continue
        with gzip.open(folder / (key + '.jsonl.gz'), 'rt', encoding='utf-8') as stream:
            for line in stream:
                feature = json.loads(line)
                if box(*feature['properties']['bounds']).intersects(extent):
                    features.setdefault(feature['properties']['linkId'], feature)
    ids = sorted(features, key=int)
    wgs_geometries = [shape(features[key]['geometry']) for key in ids]
    geometries = [transform(to_meters.transform, geometry) for geometry in wgs_geometries]
    tree = STRtree(geometries)
    decisions = json.loads((ROOT / 'outputs/daegu-accident-matching-2024-v2/user-decisions.json').read_text(encoding='utf-8'))
    excluded = {aid for aid, decision in decisions.items() if decision['decision'] == '제외'}
    counts, statuses, reasons = Counter(), Counter(), Counter()
    rows = []
    for accident, point, valid in zip(accidents, points, plausible, strict=True):
        aid = accident['acdnt_no']
        index, distance, tied = nearest_assignment(point, tree, geometries, ids) if valid else (None, None, False)
        reason = 'explicit_user_exclusion' if aid in excluded else 'coordinate_outside_daegu_region' if not valid else 'no_its_link_within_15m' if index is None else 'nearest_within_15m'
        status = 'mapped' if reason == 'nearest_within_15m' else 'excluded'
        link_id = ids[index] if status == 'mapped' else ''
        if link_id:
            counts[link_id] += 1
        statuses[status] += 1
        reasons[reason] += 1
        rows.append(dict(accident_id=aid, year=2024, status=status, its_link_id=link_id, distance_m=round(distance, 8) if distance is not None else '', equal_distance_tie=tied, reason=reason))
    assert sum(counts.values()) == statuses['mapped']
    assert statuses['mapped'] + statuses['excluded'] == 10222
    covered = [key for key, geometry in zip(ids, wgs_geometries) if daegu.covers(geometry)]
    links = {key: dict(count=count, lengthMeters=round(geometries[ids.index(key)].length, 4)) for key, count in counts.items()}
    public = dict(identifierSystem='its', year=2024, roadSourceDate=manifest['sourceDate'], period='2024:taas:its-nearest-15m', source='TAAS',
                  method='nearest-its-link-within-15m', maxDistanceMeters=15, sourceAccidents=10222, mappedAccidents=statuses['mapped'], excludedAccidents=statuses['excluded'],
                  coveredLinkIds=covered, links=links, directionConfirmed=False, temporalMismatch=True)
    output = ROOT / 'outputs/daegu-accident-its-2024'
    output.mkdir(parents=True, exist_ok=True)
    with (output / '전체_판정결과.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    with (output / 'ITS_구간별_사고건수.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['its_link_id', 'count', 'lengthMeters'])
        writer.writeheader()
        writer.writerows(dict(its_link_id=key, **values) for key, values in links.items())
    report = dict(sourceAccidents=10222, statuses=dict(statuses), reasons=dict(reasons), matchedLinks=len(links), coveredLinks=len(covered), candidateLinks=len(ids),
                  mappingDistanceMeters=15, equalDistanceTies=sum(r['equal_distance_tie'] for r in rows if r['status'] == 'mapped'),
                  sourceYear=2024, roadSourceDate=manifest['sourceDate'], method=public['method'], metricCrs='EPSG:5179',
                  sourceHashes={'accidents':hashlib.sha256(raw.read_bytes()).hexdigest(), 'itsManifest':hashlib.sha256((folder/'manifest.json').read_bytes()).hexdigest(), 'boundaries':hashlib.sha256(boundaries_path.read_bytes()).hexdigest()},
                  directionConfirmed=False, officialLinkStatistics=False, retainedExplicitExclusions=sorted(excluded))
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'public/data/roads/accidents-2024-daegu-its.json').write_text(json.dumps(public, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    enrich_existing_points()
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    enrich_existing_points() if '--points-only' in sys.argv else main()
