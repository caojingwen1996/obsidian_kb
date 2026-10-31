import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from local_proxy import nasdaq100_return_history, fetch_nasdaq100_snapshot


class NasdaqReturnTests(unittest.TestCase):
    def payload(self):
        dates = ['2025-11-03', '2025-11-28', '2025-12-31', '2026-01-02', '2026-01-30', '2026-02-02', '2026-02-27', '2026-03-02']
        stamps = [datetime.fromisoformat(day).replace(hour=16, tzinfo=timezone.utc).timestamp() for day in dates]
        return {'chart': {'result': [{'meta': {'dataGranularity': '1d', 'gmtoffset': 0, 'regularMarketTime': stamps[-2], 'regularMarketPrice': 99},
            'timestamp': stamps, 'indicators': {'quote': [{'close': [100, 110, 88, 100, 110, 88, 99, 999]}]}}]}}

    def test_monthly_compounding_drawdown_and_partial_year(self):
        history = nasdaq100_return_history(self.payload(), 'test')
        old, current = history['rows']
        self.assertEqual(history['lastDate'], '2026-02-27')
        self.assertEqual(old['status'], '样本首年')
        self.assertEqual(current['status'], '年内')
        self.assertAlmostEqual(old['annualReturn'], -12)
        self.assertAlmostEqual(current['annualReturn'], -1)
        self.assertAlmostEqual(current['maxDrawdown'], -20)
        self.assertAlmostEqual(current['monthlyReturns'][0]['value'], 10)
        self.assertAlmostEqual(current['monthlyReturns'][1]['value'], -10)
        self.assertEqual(current['monthlyReturns'][1]['status'], '月内累计')
        self.assertIsNone(current['monthlyReturns'][2]['value'])
        self.assertEqual(current['monthlyReturns'][2]['status'], '未开始')
        self.assertIsNone(old['monthlyReturns'][0]['value'])
        self.assertEqual(old['monthlyReturns'][0]['status'], '数据不足')

    def test_monthly_drawdown_resets_peak_and_does_not_use_month_end_return(self):
        payload = self.payload()
        values = payload['chart']['result'][0]['indicators']['quote'][0]['close']
        values[3:7] = [100, 120, 100, 90]
        months = nasdaq100_return_history(payload, 'test')['rows'][-1]['monthlyReturns']
        self.assertEqual(months[0]['maxDrawdown'], 0)
        self.assertAlmostEqual(months[1]['maxDrawdown'], -10)
        self.assertAlmostEqual(months[1]['value'], -25)
        self.assertIsNone(months[2]['maxDrawdown'])
        old = nasdaq100_return_history(payload, 'test')['rows'][0]['monthlyReturns']
        self.assertIsNone(old[11]['maxDrawdown'])  # One close cannot establish a drawdown path.

    def test_missing_month_does_not_fabricate_return(self):
        payload = self.payload()
        row = payload['chart']['result'][0]
        row['meta']['regularMarketTime'] = row['timestamp'][-1]
        kept = [0, 1, 2, 3, 4, 7]
        row['timestamp'] = [row['timestamp'][i] for i in kept]
        row['indicators']['quote'][0]['close'] = [100, 110, 88, 100, 110, 120]
        history = nasdaq100_return_history(payload, 'test')
        current = history['rows'][-1]
        self.assertEqual(current['status'], '样本不足')
        self.assertIsNone(current['monthlyReturns'][1]['value'])
        self.assertIsNone(current['monthlyReturns'][2]['value'])
        self.assertAlmostEqual(current['annualReturn'], 20)

    def test_coarse_bars_rejected_and_history_connected_to_api(self):
        result = fetch_nasdaq100_snapshot(lambda *_: self.payload())
        self.assertEqual(len(result['data']['returnHistory']['rows']), 2)
        payload = self.payload()
        payload['chart']['result'][0]['meta']['dataGranularity'] = '3mo'
        with self.assertRaises(ValueError):
            nasdaq100_return_history(payload, 'test')

if __name__ == '__main__':
    unittest.main()
