"""Build the app's road graph directly from official 2024 Level 5.5 SHP files.

No ITS correspondence or inferred ID replacement is used. Build into an empty
staging directory and validate before replacing the published dataset.
"""
import argparse
import csv
import gzip
import hashlib
import importlib.util
import json
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

from pyproj import CRS, Geod, Transformer
from shapely.geometry import LineString, MultiLineString, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

spec = importlib.util.spec_from_file_location('roads', Path(__file__).with_name('preprocess-road-links.py'))
roads = importlib.util.module_from_spec(spec)
spec.loader.exec_module(roads)


def write(path, value, lines=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = '\n'.join(json.dumps(v, ensure_ascii=False, separators=(',', ':'), allow_nan=False) for v in value) if lines else json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    data = text.encode('utf-8')
    path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == '.gz' else data)


def tile(lng, lat):
    return math.floor((lng + 180) / 360 * 4096), math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 4096)


def traffic_values(props, row, references):
    if not row:
        return {'trafficVolume': None, 'trafficMatchStatus': 'missing_observation'}
    same = (props['lane'] == row['lanes'] and props['road_rank'] == row['road_rank']
            and props['road_name'].strip() == row['road_name'].strip()
            and props['sido_id'][:2] == row['sido_code'][:2]
            and abs(float(props['k_length']) - float(row['length_km'])) <= .001)
    try:
        aadt, lanes = float(row['all_weekday_aadt']), int(row['lanes'])
    except (ValueError, TypeError):
        same = False
        aadt, lanes = -1, 0
    ref = references.get(row['sido_code'][:2], 0)
    if not same or not math.isfinite(aadt) or aadt < 0 or lanes <= 0 or ref <= 0:
        return {'trafficVolume': None, 'trafficMatchStatus': 'attribute_mismatch_or_missing'}
    period = '2024:weekday:estimated-aadt-hourly-mean'
    return {'trafficVolume': aadt / 24, 'trafficAadt': aadt,
            'trafficPerLaneReference': ref / 24, 'trafficPeriod': period,
            'trafficReferencePeriod': period, 'trafficSource': 'View-T',
            'trafficObservationYear': 2024, 'trafficBasis': 'estimated-aadt-hourly-mean',
            'trafficMatchStatus': 'same_year_level55'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('.local/viewt'))
    parser.add_argument('--traffic', type=Path, default=Path('.local/viewt/2024-regional/traffic.csv'))
    parser.add_argument('--output', type=Path, default=Path('.local/level55-build'))
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Use a new empty output directory; preserve earlier builds')
    source_files = sorted(args.source.glob('*_link_lev5.5_2024.zip'))
    if len(source_files) != 17:
        raise ValueError('All 17 official province files are required')
    observations = list(csv.DictReader(args.traffic.open(encoding='utf-8-sig')))
    traffic = {r['lev5_5_link_id']: r for r in observations}
    assert len(traffic) == len(observations) == 119413
    references = defaultdict(float)
    for r in observations:
        try:
            aadt, lane = float(r['all_weekday_aadt']), int(r['lanes'])
            if math.isfinite(aadt) and aadt >= 0 and lane > 0:
                key = r['sido_code'][:2]
                references[key] = max(references[key], aadt / lane)
        except ValueError:
            pass
    boundary = json.loads(Path('.local/roads/admin-boundaries.geojson').read_text(encoding='utf-8'))
    dissolved = defaultdict(list)
    for f in boundary['features']:
        dissolved[f"{f['properties']['sidonm']} {f['properties']['sggnm']}"].append(shape(f['geometry']))
    region_names = list(dissolved)
    polygons = [unary_union(dissolved[n]) for n in region_names]
    tree, geod = STRtree(polygons), Geod(ellps='WGS84')
    features, projected, hashes, source_crs = {}, {}, {}, {}
    counts = Counter()
    for archive in source_files:
        hashes[archive.name] = hashlib.sha256(archive.read_bytes()).hexdigest()
        folder = args.source / 'level55-2024' / archive.name.split('_link')[0]
        folder.mkdir(parents=True, exist_ok=True)
        with ZipFile(archive) as z:
            for name in z.namelist():
                if Path(name).suffix.lower() in {'.shp', '.dbf', '.prj', '.shx'}:
                    if Path(name).name != name:
                        raise ValueError('Unexpected archive path')
                    (folder / name).write_bytes(z.read(name))
        shp = next(folder.glob('*.shp'))
        crs = CRS.from_wkt(shp.with_suffix('.prj').read_text())
        assert crs.is_projected and crs.axis_info[0].unit_name.lower() in {'metre', 'meter'}
        source_crs[archive.name] = crs.to_wkt()
        transform = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
        for p, body in zip(roads.dbf_rows(shp.with_suffix('.dbf')), roads.shp_records(shp), strict=True):
            counts['source'] += 1
            if not p:
                counts['deleted'] += 1
                continue
            parts = roads.projected_parts(body)
            identifier = p['k_link_id']
            if identifier in features:
                raise ValueError(f'Duplicate Level 5.5 ID {identifier}')
            if not parts:
                counts['emptyGeometry'] += 1
                continue
            lines = []
            for part in parts:
                lngs, lats = transform.transform(*zip(*part))
                coords = [[round(x, 7), round(y, 7)] for x, y in zip(lngs, lats)]
                assert all(120 < x < 135 and 30 < y < 42 for x, y in coords)
                lines.append(coords)
            geom = MultiLineString(lines)
            point = geom.interpolate(.5, normalized=True)
            regions = sorted(region_names[int(i)] for i in tree.query(point, predicate='covered_by'))
            lane = int(p['lane']) if p['lane'].isdigit() and int(p['lane']) > 0 else None
            name = roads.nullable(p['road_name'])
            props = {'linkId': identifier, 'lev5_5_link_id': identifier, 'identifierSystem': 'level5.5',
                     'roadName': name, 'lanes': lane, 'roadRank': p['road_rank'], 'roadType': None,
                     'roadNo': p['road_no'], 'linkType': p['link_type'],
                     'fNode': p['fnode_id'], 'tNode': p['tnode_id'], 'fNodeName': None, 'tNodeName': None,
                     'centerLat': round(point.y, 7), 'centerLng': round(point.x, 7),
                     'bounds': list(geom.bounds), 'regions': regions,
                     'lengthMeters': round(geod.geometry_length(geom), 2), 'sourceLengthMeters': float(p['k_length']) * 1000,
                     'speedLimit': None, 'accidentCount': None, 'floatingPopulation': None, 'difficultyScore': None,
                     **traffic_values(p, traffic.get(identifier), references)}
            counts[props['trafficMatchStatus']] += 1
            counts[str(min(lane, 7)) if lane else 'unknownLanes'] += 1
            if not name:
                counts['unnamed'] += 1
            features[identifier] = {'type': 'Feature', 'id': identifier, 'properties': props,
                                    'geometry': {'type': 'LineString' if len(lines) == 1 else 'MultiLineString',
                                                 'coordinates': lines[0] if len(lines) == 1 else lines}}
            projected[identifier] = ({'LINK_ID': identifier, 'F_NODE': p['fnode_id'], 'T_NODE': p['tnode_id']}, parts)
        print(f'Read {archive.name}: {len(features):,} Level 5.5 links', flush=True)
    by_name = defaultdict(list)
    tiles, geometry_buckets, search_buckets = defaultdict(list), defaultdict(list), defaultdict(list)
    lane_counts, tile_counts = Counter(), {}
    for identifier, f in features.items():
        p = f['properties']
        if p['roadName']:
            by_name[p['roadName']].append(projected[identifier])
        b = p['bounds']; x0, y0 = tile(b[0], b[3]); x1, y1 = tile(b[2], b[1])
        # All road geometries, including unknown lanes, are available for routing.
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                key = f'{x}/{y}'
                tiles[key].append(f)
                tile_counts.setdefault(key, Counter())[str(min(p['lanes'], 7)) if p['lanes'] else 'unknown'] += 1
        lane_counts[str(min(p['lanes'], 7)) if p['lanes'] else 'unknown'] += 1
        if not p['roadName']:
            lane_counts['unnamed'] += 1
    roads_meta, target, group_count, searchable_count = [], None, 0, 0
    for name, source_rows in sorted(by_name.items()):
        name_count = 0
        for component in roads.components(source_rows):
            ids = sorted(p['LINK_ID'] for p, _ in component)
            group_id = 'road-' + ids[0]
            fs = [features[i] for i in ids]
            all_lines = [LineString(line) for f in fs for line in ([f['geometry']['coordinates']] if f['geometry']['type'] == 'LineString' else f['geometry']['coordinates'])]
            whole = unary_union(all_lines)
            center = whole.interpolate(.5, normalized=True)
            lanes = [f['properties']['lanes'] for f in fs if f['properties']['lanes']]
            bucket = f'{roads.shard(group_id, 1024):04d}'
            meta = {'roadGroupId': group_id, 'roadName': name, 'regions': sorted({r for f in fs for r in f['properties']['regions']}),
                    'centerLat': center.y, 'centerLng': center.x, 'bounds': list(whole.bounds),
                    'laneMin': min(lanes) if lanes else None, 'laneMax': max(lanes) if lanes else None,
                    'linkCount': len(fs), 'lengthMeters': round(geod.geometry_length(whole), 2), 'geometryShard': bucket}
            search_buckets[f'{roads.shard(name, 256):03d}'].append(meta)
            geometry_buckets[bucket].append({'roadGroupId': group_id, 'features': fs})
            if '1014051' in ids:
                target = {'roadGroupId': group_id, 'feature': features['1014051']}
            name_count += 1; group_count += 1; searchable_count += len(fs)
        roads_meta.append({'roadName': name, 'searchShard': f'{roads.shard(name, 256):03d}', 'groupCount': name_count})
    areas = [{'name': name, 'centerLat': polygon.representative_point().y, 'centerLng': polygon.representative_point().x,
              'bounds': list(polygon.bounds)} for name, polygon in zip(region_names, polygons)]
    manifest = {'schemaVersion': 2, 'identifierSystem': 'level5.5', 'observationYear': 2024,
                'targetCrs': 'EPSG:4326', 'roads': roads_meta, 'areas': areas}
    write(args.output / 'manifest.json', manifest)
    write(args.output / 'manifest.json.gz', manifest)
    for bucket, data in search_buckets.items(): write(args.output / 'search' / f'{bucket}.json.gz', data)
    for bucket, data in geometry_buckets.items(): write(args.output / 'geometry' / f'{bucket}.jsonl.gz', data, True)
    for key, data in tiles.items(): write(args.output / 'lanes' / f'{key}.jsonl.gz', data, True)
    write(args.output / 'lanes/manifest.json', {'schemaVersion': 2, 'identifierSystem': 'level5.5', 'sourceDate': '2024',
          'tileZoom': 12, 'targetCrs': 'EPSG:4326', 'laneMeaning': 'Official Level 5.5 lane per directed link',
          'counts': lane_counts, 'sourceLinkCount': counts['source'], 'tiles': tile_counts})
    write(args.output / 'target-link.json', target)
    write(args.output / 'provenance.json', {'identifierSystem': 'level5.5', 'observationYear': 2024,
          'source': 'https://viewt.ktdb.go.kr/cong/map/moveNetworkDownload.do',
          'trafficSource': 'https://viewt.ktdb.go.kr/cong/map/TableMove_Zeke.do',
          'sourceLinkCount': counts['source'], 'searchableLinkCount': searchable_count,
          'roadGroupCount': group_count, 'counts': counts, 'trafficRows': len(traffic),
          'trafficRowsWithoutGeometry': len(set(traffic) - set(features)), 'sourceHashes': hashes,
          'sourceCrsWkt': source_crs, 'trafficReferencesPerDayPerLane': dict(references),
          'regionMethod': 'geometry midpoint covered by existing dissolved administrative boundaries',
          'routingMeaning': 'Source fnode_id to tnode_id; no invented reverse links',
          'limitations': '2024 major roads; no live traffic, current closures, accident observations or speed limits'})
    shutil.copytree('public/data/roads/areas', args.output / 'areas')
    shutil.copyfile('public/data/roads/ATTRIBUTION.md', args.output / 'ATTRIBUTION.md')
    print(json.dumps({'links': len(features), 'tiles': len(tiles), 'groups': group_count, 'counts': counts}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
