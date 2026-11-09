import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from nasdaq_history import extend_daily_chart, read_daily, SEED_PATH
from local_proxy import nasdaq100_return_history


class HistoricalNasdaqTests(unittest.TestCase):
    def test_seed_covers_each_requested_year(self):
        rows = read_daily(SEED_PATH)
        self.assertEqual(min(rows), '1996-01-02')
        self.assertEqual(max(rows), '2021-12-31')
        for year in range(1996, 2022):
            self.assertGreaterEqual(sum(day.startswith(str(year)) for day in rows), 245)

    def test_join_cache_roll_forward_and_reject_conflict(self):
        rows = read_daily(SEED_PATH)
        overlap = sorted(rows)[-40:]
        def chart(days, values):
            stamps = [datetime.strptime(day, '%Y-%m-%d').replace(hour=16, tzinfo=timezone.utc).timestamp() for day in days]
            return {'chart': {'result': [{'meta': {'dataGranularity': '1d', 'gmtoffset': 0, 'regularMarketTime': stamps[-1]}, 'timestamp': stamps, 'indicators': {'quote': [{'close': values}]}}]}}
        original = chart(overlap + ['2022-01-03'], [rows[d] for d in overlap] + [16500])
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / 'cache.json'
            merged = extend_daily_chart(original, cache_path=cache)
            result = nasdaq100_return_history(merged, 'test')
            self.assertEqual(result['firstDate'], '1996-01-02')
            self.assertEqual(result['lastDate'], '2022-01-03')
            self.assertEqual(len(original['chart']['result'][0]['timestamp']), 41)
            before = cache.read_bytes()
            bad = chart(overlap, [rows[d] + 1 for d in overlap])
            with self.assertRaises(ValueError): extend_daily_chart(bad, cache_path=cache)
            self.assertEqual(cache.read_bytes(), before)
            # Older responses cannot remove persisted newer observations.
            extend_daily_chart(chart(overlap, [rows[d] for d in overlap]), cache_path=cache)
            self.assertIn('2022-01-03', read_daily(cache))
            with self.assertRaises(ValueError): extend_daily_chart(chart(overlap[-2:], [rows[d] for d in overlap[-2:]]), cache_path=cache)

if __name__ == '__main__': unittest.main()
