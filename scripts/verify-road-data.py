"""Verify every generated shard and primary key without a browser or database server."""
import gzip
import json
from pathlib import Path


def main():
    root = Path('public/data/roads')
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf8'))
    provenance = json.loads((root / 'provenance.json').read_text(encoding='utf8'))
    target = json.loads((root / 'target-link.json').read_text(encoding='utf8'))
    metadata = {}
    for file in (root / 'search').glob('*.json.gz'):
        for group in json.loads(gzip.decompress(file.read_bytes())):
            assert group['roadGroupId'] not in metadata, 'Duplicate road group'
            metadata[group['roadGroupId']] = group
    links, groups, found = set(), set(), None
    for file in (root / 'geometry').glob('*.jsonl.gz'):
        with gzip.open(file, 'rt', encoding='utf8') as stream:
            for line in stream:
                group = json.loads(line)
                identifier = group['roadGroupId']
                assert identifier not in groups, 'Duplicate geometry group'
                groups.add(identifier)
                meta = metadata[identifier]
                assert file.stem.split('.')[0] == meta['geometryShard']
                assert len(group['features']) == meta['linkCount']
                west, south, east, north = meta['bounds']
                for feature in group['features']:
                    props, geometry = feature['properties'], feature['geometry']
                    assert props['linkId'] not in links, 'Duplicate LINK_ID'
                    links.add(props['linkId'])
                    assert isinstance(props['linkId'], str)
                    assert props['roadName'] == meta['roadName']
                    assert all(props[key] is None for key in ['trafficVolume', 'accidentCount', 'floatingPopulation', 'difficultyScore'])
                    lines = geometry['coordinates'] if geometry['type'] == 'MultiLineString' else [geometry['coordinates']]
                    for coordinates in lines:
                        assert len(coordinates) >= 2
                        for lng, lat in coordinates:
                            assert 120 < lng < 135 and 30 < lat < 42, 'Coordinate order/CRS error'
                            assert west <= lng <= east and south <= lat <= north
                    if props['linkId'] == '1160059701':
                        found = {'roadGroupId': identifier, 'feature': feature}
    assert groups == set(metadata)
    assert len(links) == provenance['searchableLinkCount']
    assert len(groups) == provenance['roadGroupCount']
    assert found == target
    p = found['feature']['properties']
    assert (p['roadName'], p['lanes'], p['fNode'], p['tNode']) == ('공원로', 2, '1160032302', '1160032301')
    assert p['regions'] == ['서울특별시 구로구']
    assert any(area['name'] == '서울특별시 구로구' for area in manifest['areas'])
    park = [group for group in metadata.values() if group['roadName'] == '공원로']
    assert len(park) > 1 and len({region for group in park for region in group['regions']}) > 1
    print(f'PASS: {len(links):,} unique LINK_IDs, {len(groups):,} complete road groups, {len(park)} separate 공원로 groups')


if __name__ == '__main__':
    main()
