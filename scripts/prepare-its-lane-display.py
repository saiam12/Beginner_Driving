"""Publish verified local ITS lane tiles separately from Level 5.5 routing data."""
import argparse
import gzip
import hashlib
import json
import shutil
from collections import Counter
from pathlib import Path


def prepare(source, original, output, report_path):
    manifest = json.loads((source / 'lanes/manifest.json').read_text(encoding='utf-8'))
    provenance = json.loads((source / 'provenance.json').read_text(encoding='utf-8'))
    if manifest['targetCrs'] != 'EPSG:4326' or manifest['sourceDate'] != '2026-09-14':
        raise ValueError('Unexpected ITS release or display CRS')
    hashes = {}
    for suffix in ('.shp', '.dbf', '.prj'):
        file = original / ('MOCT_LINK' + suffix)
        with file.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != provenance['sourceHashes'][file.name]['sha256']:
            raise ValueError(f'Original source differs: {file.name}')
        hashes[file.name] = provenance['sourceHashes'][file.name]
    ids, counts, tile_counts = set(), Counter(), {}
    for key in manifest['tiles']:
        count = Counter()
        with gzip.open(source / 'lanes' / (key + '.jsonl.gz'), 'rt', encoding='utf-8') as stream:
            for line in stream:
                feature = json.loads(line)
                props, geometry = feature['properties'], feature['geometry']
                lanes = props['lanes']
                if not isinstance(lanes, int) or lanes < 1 or geometry['type'] not in ('LineString', 'MultiLineString'):
                    raise ValueError(f'Invalid lane feature: {props["linkId"]}')
                if not (124 <= props['centerLng'] <= 132 and 32 <= props['centerLat'] <= 40):
                    raise ValueError('Invalid transformed coordinate')
                category = str(min(lanes, 7))
                count[category] += 1
                if props['linkId'] not in ids:
                    ids.add(props['linkId'])
                    counts[category] += 1
                    if not props.get('roadName'):
                        counts['unnamed'] += 1
        if dict(count) != manifest['tiles'][key]:
            raise ValueError(f'Tile count differs: {key}')
        tile_counts[key] = dict(count)
    if len(ids) != provenance['sourceLinkCount'] or dict(counts) != manifest['counts']:
        raise ValueError('Source feature totals differ')
    output.mkdir(parents=True, exist_ok=True)
    for key in tile_counts:
        source_file = source / 'lanes' / (key + '.jsonl.gz')
        target = output / (key + '.jsonl.gz')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.read_bytes() != source_file.read_bytes():
            raise ValueError(f'Refusing to overwrite different data: {target}')
        if not target.exists():
            shutil.copyfile(source_file, target)
    manifest.update(schemaVersion=2, identifierSystem='its', source='https://www.its.go.kr/nodelink/nodelinkStatus?service=inquiryNodelink',
                    sourceLinkCount=len(ids), sourceHashes=hashes, purpose='lane display only; no Level 5.5 traffic or accident join')
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (output / 'ATTRIBUTION.md').write_text('# ITS 차로 수 표시 자료\n\n국토교통부/ITS 표준노드링크 [2026-09-14]NODELINKDATA, MOCT_LINK.\n원본 PRJ로 WGS84(EPSG:4326) 변환한 공간 타일. 원본 진행 방향별 LANES를 사용하며 왕복 합계로 바꾸지 않습니다.\n지도 차로 확인에만 사용하고 View-T 2024년 코스 계산·교통량·사고 자료와 자동 결합하지 않습니다.\n출처: https://www.its.go.kr/nodelink/nodelinkStatus?service=inquiryNodelink\n', encoding='utf-8')
    report = dict(sourceDate=manifest['sourceDate'], sourceLinkCount=len(ids), tileCount=len(tile_counts), counts=dict(counts),
                  outputBytes=sum(p.stat().st_size for p in output.rglob('*') if p.is_file()), sourceHashesVerified=hashes,
                  identifierSystem='its', observationsJoined=False)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('.local/roads-its-backup-20261010'))
    parser.add_argument('--original', type=Path, default=Path('C:/Users/CHOI/Downloads/[2026-09-14]NODELINKDATA'))
    parser.add_argument('--output', type=Path, default=Path('public/data/roads/lanes-its'))
    parser.add_argument('--report', type=Path, default=Path('.local/reports/its-lane-display.json'))
    args = parser.parse_args()
    prepare(args.source, args.original, args.output, args.report)
