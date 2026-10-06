"""Focused tests for grouping: IDs and spatial continuity, never name alone."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('roads', Path(__file__).with_name('preprocess-road-links.py'))
roads = importlib.util.module_from_spec(spec)
spec.loader.exec_module(roads)


def link(identifier, start, end, coords):
    return ({'LINK_ID': identifier, 'F_NODE': start, 'T_NODE': end}, [coords])


class RoadGroupingTests(unittest.TestCase):
    def test_shared_node_connects_links(self):
        rows = [link('a', 'n1', 'n2', [(0, 0), (100, 0)]),
                link('b', 'n2', 'n3', [(100, 0), (200, 0)])]
        self.assertEqual([len(g) for g in roads.components(rows)], [2])

    def test_disconnected_same_name_stays_separate(self):
        rows = [link('a', 'n1', 'n2', [(0, 0), (100, 0)]),
                link('b', 'n3', 'n4', [(1000, 0), (1100, 0)])]
        self.assertEqual(len(list(roads.components(rows))), 2)

    def test_opposite_carriageways_join_for_display(self):
        rows = [link('a', 'n1', 'n2', [(0, 0), (100, 0)]),
                link('b', 'n3', 'n4', [(100, 12), (0, 12)])]
        self.assertEqual([len(g) for g in roads.components(rows)], [2])

    def test_middle_crossing_does_not_connect(self):
        rows = [link('a', 'n1', 'n2', [(-100, 0), (100, 0)]),
                link('b', 'n3', 'n4', [(0, -100), (0, 100)])]
        self.assertEqual(len(list(roads.components(rows))), 2)

    def test_missing_nodes_do_not_join_distant_links(self):
        rows = [link('a', '', '', [(0, 0), (100, 0)]),
                link('b', '', '', [(1000, 0), (1100, 0)])]
        self.assertEqual(len(list(roads.components(rows))), 2)

    def test_unknown_values_remain_null(self):
        self.assertIsNone(roads.nullable('-'))
        self.assertIsNone(roads.nullable(''))
        self.assertEqual(roads.nullable('104'), '104')


if __name__ == '__main__':
    unittest.main()
