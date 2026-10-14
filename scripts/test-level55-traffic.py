import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('level55', Path(__file__).with_name('preprocess-level55-roads.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TrafficTests(unittest.TestCase):
    def setUp(self):
        self.props = {'lane': '4', 'road_rank': '102', 'road_name': '올림픽대로', 'sido_id': '11000', 'k_length': '.8'}
        self.row = {'lanes': '4', 'road_rank': '102', 'road_name': '올림픽대로', 'sido_code': '11000000', 'length_km': '.8', 'all_weekday_aadt': '90682'}

    def test_real_source_units(self):
        out = module.traffic_values(self.props, self.row, {'11': 58071})
        self.assertEqual(out['trafficVolume'], 90682 / 24)
        self.assertEqual(out['trafficPerLaneReference'], 58071 / 24)
        self.assertEqual(out['trafficPeriod'], out['trafficReferencePeriod'])

    def test_missing_is_not_zero(self):
        self.assertIsNone(module.traffic_values(self.props, None, {'11': 58071})['trafficVolume'])
        self.row['all_weekday_aadt'] = '0'
        self.assertEqual(module.traffic_values(self.props, self.row, {'11': 58071})['trafficVolume'], 0)

    def test_wrong_attributes_or_reference_are_excluded(self):
        for key, value in [('lane', '2'), ('road_name', '다른 도로'), ('road_rank', '106'), ('sido_id', '22000'), ('k_length', '2')]:
            with self.subTest(key=key):
                self.assertIsNone(module.traffic_values({**self.props, key: value}, self.row, {'11': 58071})['trafficVolume'])
        self.assertIsNone(module.traffic_values(self.props, self.row, {'11': 0})['trafficVolume'])

    def test_invalid_observation_is_excluded(self):
        for value in ['', '-1', 'NaN', 'Infinity']:
            self.assertIsNone(module.traffic_values(self.props, {**self.row, 'all_weekday_aadt': value}, {'11': 58071})['trafficVolume'])


if __name__ == '__main__':
    unittest.main()
