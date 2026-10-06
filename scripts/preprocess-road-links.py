"""Build static, compressed road search/geometry shards without altering SHP inputs.

Requires pyproj and shapely. Reads the declared PRJ WKT, never assigns an EPSG
code to an unknown source. Intermediate SQLite and boundary files stay local.
"""
import argparse
import gzip
import hashlib
import json
import sqlite3
import struct
from collections import defaultdict
from pathlib import Path

from pyproj import CRS, Geod, Transformer
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree


def dbf_rows(path):
    with path.open('rb') as stream:
        header = stream.read(32)
        count, header_size, record_size = struct.unpack_from('<IHH', header, 4)
        fields, offset = [], 1
        while True:
            first = stream.read(1)
            if first == b'\r':
                break
            field = first + stream.read(31)
            name = field[:11].split(b'\0')[0].decode('ascii')
            size = field[16]
            fields.append((name, offset, size))
            offset += size
        stream.seek(header_size)
        for _ in range(count):
            record = stream.read(record_size)
            if len(record) != record_size:
                raise ValueError('Truncated DBF')
            yield None if record[:1] == b'*' else {
                name: record[start:start + size].decode('cp949').strip()
                for name, start, size in fields
            }


def shp_records(path):
    with path.open('rb') as stream:
        stream.seek(100)
        while header := stream.read(8):
            _, words = struct.unpack('>ii', header)
            body = stream.read(words * 2)
            if len(body) != words * 2:
                raise ValueError('Truncated SHP')
            yield body


def projected_parts(body):
    kind = struct.unpack_from('<i', body)[0]
    if kind == 0:
        return []
    if kind not in (3, 13, 23):
        raise ValueError(f'Expected PolyLine, got SHP type {kind}')
    part_count, point_count = struct.unpack_from('<ii', body, 36)
    starts = list(struct.unpack_from(f'<{part_count}i', body, 44)) + [point_count]
    coords = list(struct.iter_unpack('<dd', body[44 + part_count * 4:44 + part_count * 4 + point_count * 16]))
    return [coords[a:b] for a, b in zip(starts, starts[1:]) if b - a >= 2]


def nullable(value):
    return None if value in ('', '-', '미정') else value


def shard(value, count):
    return int(hashlib.sha256(value.encode()).hexdigest()[:8], 16) % count


def components(rows):
    """Shared nodes or endpoints within 15m, including separated carriageways.

    The caller partitions by exact ROAD_NAME first. This is a display grouping,
    not proof of a legal driving connection between opposite carriageways.
    """
    parent = list(range(len(rows)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    owners = {}
    for i, (props, parts) in enumerate(rows):
        keys = [('node', node) for node in (props['F_NODE'], props['T_NODE']) if nullable(node)]
        keys += [('xy', round(x * 10), round(y * 10)) for line in parts for x, y in (line[0], line[-1])]
        for key in keys:
            if key in owners:
                parent[root(i)] = root(owners[key])
            else:
                owners[key] = i
    # Divided roads use distinct node IDs and offset geometries in this dataset.
    # Compare endpoints only; a crossing in the middle does not connect groups.
    endpoints, endpoint_owners = [], []
    for i, (_, parts) in enumerate(rows):
        for line in parts:
            for xy in (line[0], line[-1]):
                endpoints.append(Point(xy))
                endpoint_owners.append(i)
    if endpoints:
        tree = STRtree(endpoints)
        for a, b in tree.query(endpoints, predicate='dwithin', distance=15).T:
            i, j = endpoint_owners[a], endpoint_owners[b]
            if i != j:
                parent[root(i)] = root(j)
    result = defaultdict(list)
    for i, row in enumerate(rows):
        result[root(i)].append(row)
    return result.values()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--links', type=Path, required=True)
    parser.add_argument('--nodes', type=Path)
    parser.add_argument('--boundaries', type=Path)
    parser.add_argument('--output', type=Path, default=Path('public/data/roads'))
    parser.add_argument('--work', type=Path, default=Path('.local/roads'))
    args = parser.parse_args()
    crs = CRS.from_wkt(args.links.with_suffix('.prj').read_text())
    transform = Transformer.from_crs(crs, CRS.from_epsg(4326), always_xy=True)
    if not crs.is_projected or crs.axis_info[0].unit_name != 'metre':
        raise ValueError('Endpoint tolerance requires a declared projected metre CRS')
    args.work.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    for folder in ['search', 'geometry']:
        (args.output / folder).mkdir(exist_ok=True)
    db = sqlite3.connect(args.work / 'source.sqlite')
    db.execute('PRAGMA journal_mode=OFF')
    db.execute('CREATE TABLE IF NOT EXISTS links (name TEXT, properties TEXT, geometry BLOB)')
    db.execute('DELETE FROM links')
    count, unnamed, fields, target_source = 0, 0, [], None
    pending = []
    for props, geometry in zip(dbf_rows(args.links.with_suffix('.dbf')), shp_records(args.links), strict=True):
        count += 1
        if not props:
            continue
        if not fields:
            fields = list(props)
        if props['LINK_ID'] == '1160059701':
            target_source = props
        if not nullable(props['ROAD_NAME']) or not projected_parts(geometry):
            unnamed += 1
            continue
        pending.append((props['ROAD_NAME'], json.dumps(props, ensure_ascii=False), geometry))
        if len(pending) == 10000:
            db.executemany('INSERT INTO links VALUES (?,?,?)', pending)
            pending.clear()
        if count % 250000 == 0:
            print(f'Read {count:,} source links', flush=True)
    db.executemany('INSERT INTO links VALUES (?,?,?)', pending)
    db.execute('CREATE INDEX IF NOT EXISTS road_name ON links(name)')
    db.commit()
    node_names = {}
    if args.nodes:
        for node in dbf_rows(args.nodes.with_suffix('.dbf')):
            if node and nullable(node['NODE_NAME']):
                node_names[node['NODE_ID']] = node['NODE_NAME']
    region_names, polygons = [], []
    if args.boundaries:
        boundary = json.loads(args.boundaries.read_text(encoding='utf8'))
        grouped = defaultdict(list)
        for feature in boundary['features']:
            props = feature['properties']
            grouped[f"{props['sidonm']} {props['sggnm']}"].append(shape(feature['geometry']))
        for name, geometries in grouped.items():
            region_names.append(name)
            polygons.append(unary_union(geometries))
    tree = STRtree(polygons) if polygons else None
    geod = Geod(ellps='WGS84')
    search_buckets, road_names = defaultdict(list), []
    writers = {}
    group_count, link_count, target = 0, 0, None
    # Open only shards that actually contain groups; gzip streams keep memory bounded.
    def write_geometry(bucket, value):
        if bucket not in writers:
            path = args.output / 'geometry' / f'{bucket:04d}.jsonl.gz'
            writers[bucket] = gzip.GzipFile(filename=str(path), mode='wb', mtime=0)
        writers[bucket].write((json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode())
    names = [r[0] for r in db.execute('SELECT DISTINCT name FROM links ORDER BY name')]
    for name_index, name in enumerate(names):
        rows = [(json.loads(p), projected_parts(b)) for p, b in db.execute('SELECT properties,geometry FROM links WHERE name=?', (name,))]
        name_groups = 0
        for component in components(rows):
            group_id = 'road-' + min(p['LINK_ID'] for p, _ in component)
            bucket = shard(group_id, 1024)
            features, regions, unique_lines, lane_values = [], set(), [], set()
            for props, parts in component:
                lines = []
                for line in parts:
                    xs, ys = zip(*line)
                    lngs, lats = transform.transform(xs, ys)
                    coords = [[round(lng, 7), round(lat, 7)] for lng, lat in zip(lngs, lats)]
                    if any(not (-180 <= lng <= 180 and -90 <= lat <= 90) for lng, lat in coords):
                        raise ValueError('Invalid transformed coordinates')
                    lines.append(coords)
                    unique_lines.append(LineString(coords))
                line_geometry = MultiLineString(lines)
                point = line_geometry.interpolate(0.5, normalized=True)
                link_regions = sorted({region_names[int(i)] for i in tree.query(point, predicate='covered_by')}) if tree else []
                regions.update(link_regions)
                lanes = int(float(props['LANES'])) if nullable(props['LANES']) else None
                if lanes is not None:
                    lane_values.add(lanes)
                link = {
                    'linkId': props['LINK_ID'], 'roadName': name, 'lanes': lanes,
                    'roadRank': nullable(props['ROAD_RANK']), 'roadType': nullable(props['ROAD_TYPE']),
                    'roadNo': nullable(props['ROAD_NO']), 'fNode': nullable(props['F_NODE']), 'tNode': nullable(props['T_NODE']),
                    'fNodeName': node_names.get(props['F_NODE']), 'tNodeName': node_names.get(props['T_NODE']),
                    'centerLat': round(point.y, 7), 'centerLng': round(point.x, 7),
                    'regions': link_regions, 'lengthMeters': round(geod.geometry_length(line_geometry), 2),
                    'speedLimit': int(float(props['MAX_SPD'])) if nullable(props['MAX_SPD']) and float(props['MAX_SPD']) > 0 else None,
                    'trafficVolume': None, 'accidentCount': None, 'floatingPopulation': None, 'difficultyScore': None,
                }
                features.append({'type': 'Feature', 'id': link['linkId'], 'properties': link,
                                 'geometry': {'type': 'LineString', 'coordinates': lines[0]} if len(lines) == 1 else {'type': 'MultiLineString', 'coordinates': lines}})
                if link['linkId'] == '1160059701':
                    target = {'roadGroupId': group_id, 'feature': features[-1]}
            whole = unary_union(unique_lines)
            west, south, east, north = whole.bounds
            center = whole.interpolate(0.5, normalized=True)
            meta = {'roadGroupId': group_id, 'roadName': name, 'regions': sorted(regions),
                    'centerLat': round(center.y, 7), 'centerLng': round(center.x, 7),
                    'bounds': [west, south, east, north], 'laneMin': min(lane_values) if lane_values else None,
                    'laneMax': max(lane_values) if lane_values else None, 'linkCount': len(features),
                    'lengthMeters': round(geod.geometry_length(whole), 2), 'geometryShard': f'{bucket:04d}'}
            search_buckets[shard(name, 256)].append(meta)
            write_geometry(bucket, {'roadGroupId': group_id, 'features': features})
            group_count += 1
            link_count += len(features)
            name_groups += 1
        road_names.append({'roadName': name, 'searchShard': f'{shard(name, 256):03d}', 'groupCount': name_groups})
        if name_index % 2000 == 0:
            print(f'Grouped {name_index:,}/{len(names):,} road names ({group_count:,} groups)', flush=True)
    for writer in writers.values():
        writer.close()
    for bucket, metadata in search_buckets.items():
        path = args.output / 'search' / f'{bucket:03d}.json.gz'
        with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as stream:
            stream.write(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')).encode())
    areas = []
    for name, polygon in zip(region_names, polygons):
        center = polygon.representative_point()
        areas.append({'name': name, 'centerLat': round(center.y, 7), 'centerLng': round(center.x, 7),
                      'bounds': list(polygon.bounds)})
    dump(args.output / 'manifest.json', {'schemaVersion': 1, 'targetCrs': 'EPSG:4326', 'roads': road_names, 'areas': areas})
    with gzip.GzipFile(filename=str(args.output / 'manifest.json.gz'), mode='wb', mtime=0) as stream:
        stream.write((args.output / 'manifest.json').read_bytes())
    dump(args.output / 'target-link.json', target)
    report = {'sourceFile': str(args.links.resolve()), 'sourceCrsWkt': crs.to_wkt(), 'sourceCrsName': crs.name,
              'sourceEpsg': crs.to_epsg(), 'columns': fields, 'sourceLinkCount': count, 'searchableLinkCount': link_count,
              'excludedUnnamedOrEmptyLinks': unnamed, 'roadNameCount': len(names), 'roadGroupCount': group_count,
              'targetSource': target_source, 'target': target,
              'regionMethod': 'LINK geometry midpoint covered by dissolved SGIS-derived sigungu boundaries; unmatched remains empty',
              'boundarySource': 'https://github.com/vuski/admdongkor/tree/master/ver20260701' if tree else None,
              'boundaryDate': '2026-07-01' if tree else None,
              'groupMethod': 'same ROAD_NAME + shared F_NODE/T_NODE or endpoint proximity within 15m; display grouping, not legal routing',
              'lengthMethod': 'WGS84 geodesic length after geometry union (opposite directions counted once)',
              'outputBytes': sum(p.stat().st_size for p in args.output.rglob('*') if p.is_file())}
    source_hashes = {}
    for source in [args.links, args.nodes]:
        if source is None:
            continue
        for suffix in ['.shp', '.dbf', '.prj']:
            path = source.with_suffix(suffix)
            if path.exists():
                with path.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                source_hashes[path.name] = {'bytes': path.stat().st_size, 'sha256': digest}
    report['sourceHashes'] = source_hashes
    if args.boundaries:
        with args.boundaries.open('rb') as stream:
            report['boundarySha256'] = hashlib.file_digest(stream, 'sha256').hexdigest()
    for _ in range(2):
        dump(args.output / 'provenance.json', report)
        report['outputBytes'] = sum(p.stat().st_size for p in args.output.rglob('*') if p.is_file())
    dump(args.output / 'provenance.json', report)
    db.close()
    print(json.dumps({k: report[k] for k in ['sourceLinkCount', 'searchableLinkCount', 'roadGroupCount', 'outputBytes']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
