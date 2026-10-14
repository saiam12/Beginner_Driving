"""Audit the full generated graph, identifiers, observations and shard inventory."""
import argparse
import csv
import gzip
import json
from pathlib import Path
from pyproj import Geod

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path('public/data/roads'))
args = parser.parse_args()
root = args.root
report = json.loads((root / 'provenance.json').read_text(encoding='utf-8'))
assert report['identifierSystem'] == 'level5.5'
assert len(report['sourceHashes']) == 17
assert len(set(report['sourceCrsWkt'].values())) == 1, 'Grouping endpoints must use the same declared CRS'
raw = list(csv.DictReader(open('.local/viewt/2024-regional/traffic.csv', encoding='utf-8-sig')))
observations = {r['lev5_5_link_id']: r for r in raw}
features, nodes, duplicates, known, max_node_gap = {}, {}, 0, 0, 0
large_node_gaps = []
geod = Geod(ellps='WGS84')
lane_manifest = json.loads((root / 'lanes/manifest.json').read_text(encoding='utf-8'))
for tile in lane_manifest['tiles']:
    for line in gzip.decompress((root / 'lanes' / f'{tile}.jsonl.gz').read_bytes()).decode().splitlines():
        f = json.loads(line); p = f['properties']; identifier = f['id']
        assert identifier == p['linkId'] == p['lev5_5_link_id']
        assert p['identifierSystem'] == 'level5.5'
        assert not any('its' in key.lower() or key.startswith('lev55') for key in p)
        if identifier in features:
            assert features[identifier] == f
            duplicates += 1
            continue
        features[identifier] = f
        assert p['fNode'] and p['tNode']
        if p['trafficVolume'] is not None:
            r = observations[identifier]
            assert p['trafficVolume'] == float(r['all_weekday_aadt']) / 24
            assert p['lanes'] == int(r['lanes'])
            assert p['trafficPerLaneReference'] == report['trafficReferencesPerDayPerLane'][r['sido_code'][:2]] / 24
            assert p['trafficPeriod'] == p['trafficReferencePeriod']
            assert p['trafficMatchStatus'] == 'same_year_level55'
            known += 1
        else:
            assert identifier not in observations
        coords = f['geometry']['coordinates']
        if f['geometry']['type'] == 'LineString':
            for node, point in [(p['fNode'], coords[0]), (p['tNode'], coords[-1])]:
                if node in nodes:
                    gap = geod.inv(*nodes[node], *point)[2]
                    max_node_gap = max(max_node_gap, gap)
                    if gap > 60:
                        large_node_gaps.append((node, identifier, round(gap, 3)))
                else:
                    nodes[node] = point
assert len(features) == report['sourceLinkCount'] == 119466
assert known == 119413
assert set(observations) <= features.keys()
metadata = {}
for path in (root / 'search').glob('*.json.gz'):
    for group in json.loads(gzip.decompress(path.read_bytes())):
        assert group['roadGroupId'] not in metadata
        metadata[group['roadGroupId']] = group
searched, groups = set(), set()
for path in (root / 'geometry').glob('*.jsonl.gz'):
    for line in gzip.decompress(path.read_bytes()).decode().splitlines():
        group = json.loads(line); gid = group['roadGroupId']
        assert gid not in groups; groups.add(gid)
        meta = metadata[gid]
        assert len(group['features']) == meta['linkCount']
        assert meta['geometryShard'] == path.name.split('.')[0]
        for f in group['features']:
            assert f == features[f['id']]
            assert f['id'] not in searched
            searched.add(f['id'])
assert groups == metadata.keys()
assert len(searched) == report['searchableLinkCount']
assert len(groups) == report['roadGroupCount']
target = json.loads((root / 'target-link.json').read_text(encoding='utf-8'))
assert target['feature'] == features['1014051']
assert target['feature']['properties']['trafficAadt'] == 90682
assert target['feature']['properties']['lanes'] == 4
# Keep the official geometry unchanged. The routing engine separately rejects
# candidates with consecutive endpoints over 60m apart; source quality is not
# permission to fabricate connecting geometry.
print(f'Source endpoint warnings over 60m: {len(large_node_gaps)} {large_node_gaps[:10]}')
print(f'PASS: {len(features):,} Level 5.5 IDs, {known:,} direct same-year observations, {len(groups):,} search groups, {len(nodes):,} nodes, max shared endpoint gap {max_node_gap:.3f}m, {duplicates:,} identical boundary-tile duplicates')
