"""Build viewport tiles from all source LINKs, including unnamed roads."""
import argparse
import gzip
import importlib.util
import json
import math
from collections import Counter, OrderedDict
from pathlib import Path

from pyproj import Transformer

spec = importlib.util.spec_from_file_location('roads', Path(__file__).with_name('preprocess-road-links.py'))
roads = importlib.util.module_from_spec(spec)
spec.loader.exec_module(roads)
TILE_ZOOM = 12


def tile(lng, lat):
    n = 2 ** TILE_ZOOM
    lat = max(-85.05112878, min(85.05112878, lat))
    return (int((lng + 180) / 360 * n),
            int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--links', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/data/roads/lanes'))
    parser.add_argument('--work', type=Path, default=Path('.local/roads/lane-tiles'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    transform = Transformer.from_crs(args.links.with_suffix('.prj').read_text(), 'EPSG:4326', always_xy=True)
    streams, tiles, counts = OrderedDict(), {}, Counter()
    for i, (props, body) in enumerate(zip(roads.dbf_rows(args.links.with_suffix('.dbf')), roads.shp_records(args.links))):
        if i and i % 200000 == 0:
            print(f'Read {i:,} LINKs', flush=True)
        if props is None:
            counts['deleted'] += 1
            continue
        raw = props.get('LANES', '')
        lanes = int(raw) if raw.isdigit() else 0
        parts = roads.projected_parts(body)
        if lanes < 1 or not parts:
            counts['unknownLanesOrEmpty'] += 1
            continue
        lines = []
        for part in parts:
            lngs, lats = transform.transform(*zip(*part))
            lines.append([[round(lng, 6), round(lat, 6)] for lng, lat in zip(lngs, lats)])
        points = [p for line in lines for p in line]
        bounds = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
        name = roads.nullable(props['ROAD_NAME'])
        feature = {'type': 'Feature', 'id': props['LINK_ID'], 'properties': {
            'linkId': props['LINK_ID'], 'roadName': name, 'lanes': lanes,
            'fNode': props['F_NODE'], 'tNode': props['T_NODE'],
            'centerLng': round((bounds[0] + bounds[2]) / 2, 6),
            'centerLat': round((bounds[1] + bounds[3]) / 2, 6),
            'bounds': bounds}, 'geometry': {
            'type': 'LineString' if len(lines) == 1 else 'MultiLineString',
            'coordinates': lines[0] if len(lines) == 1 else lines}}
        payload = json.dumps(feature, ensure_ascii=False, separators=(',', ':')) + '\n'
        west, north = tile(bounds[0], bounds[3])
        east, south = tile(bounds[2], bounds[1])
        for x in range(west, east + 1):
            for y in range(north, south + 1):
                key = f'{x}/{y}'
                if key not in tiles:
                    tiles[key] = Counter()
                    path = args.work / f'{x}-{y}.jsonl'
                    path.write_text('', encoding='utf8')
                stream = streams.pop(key, None)
                if stream is None:
                    stream = (args.work / f'{x}-{y}.jsonl').open('a', encoding='utf8')
                streams[key] = stream
                stream.write(payload)
                tiles[key][str(min(lanes, 7))] += 1
                if len(streams) > 64:
                    streams.popitem(last=False)[1].close()
        counts[str(min(lanes, 7))] += 1
        if name is None:
            counts['unnamed'] += 1
    for stream in streams.values():
        stream.close()
    for key in tiles:
        x, y = key.split('/')
        directory = args.output / x
        directory.mkdir(exist_ok=True)
        with (args.work / f'{x}-{y}.jsonl').open('rb') as source, gzip.open(directory / f'{y}.jsonl.gz', 'wb', compresslevel=6) as output:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                output.write(chunk)
    manifest = {'schemaVersion': 1, 'tileZoom': TILE_ZOOM, 'targetCrs': 'EPSG:4326',
                'source': args.links.name, 'sourceDate': '2026-09-14',
                'laneMeaning': 'Source LANES per directed LINK, not both directions combined',
                'counts': counts, 'tiles': tiles}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(json.dumps({'tiles': len(tiles), 'counts': counts}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
