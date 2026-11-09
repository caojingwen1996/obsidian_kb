from datetime import date
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError

from scripts import wind_data as wind
from scripts.liquidity_data import load_series


class WindDataTests(unittest.TestCase):
    def setUp(self):
        enabled = patch.object(wind.config, 'WIND_ENABLED', True)
        enabled.start()
        self.addCleanup(enabled.stop)
    def payload(self, code='G1100075', unit='百万美元', values=None):
        return {'metrics': [{'meta': {'code': code, 'unit': unit, 'source': 'test', 'freq': '周'},
                             'date': ['20261103', '20261104'], 'value': values or [6700000, 6748145]}]}

    def test_edb_identity_units_missing_and_zero(self):
        result = wind.parse_edb(self.payload(), 'us_WALCL', date(2026, 11, 6))
        self.assertAlmostEqual(result['points'][-1]['value'], 6748.145)
        for payload in [self.payload(code='other'), self.payload(unit='十亿美元'), {'metrics': []}]:
            with self.assertRaises(ValueError): wind.parse_edb(payload, 'us_WALCL', date(2026, 11, 6))
        result = wind.parse_edb(self.payload(values=[None, 0]), 'us_WALCL', date(2026, 11, 6))
        self.assertEqual(result['points'], [{'date': '2026-11-04', 'value': 0}])

    def test_edb_rejects_future_duplicate_and_nonfinite(self):
        for days, values in [(['20261103', '20261107'], [1, 2]), (['20261103', '20261103'], [None, 2]),
                             (['20261103', '20261104'], [1, float('nan')])]:
            payload = self.payload(values=values)
            payload['metrics'][0]['date'] = days
            with self.assertRaises(ValueError): wind.parse_edb(payload, 'us_WALCL', date(2026, 11, 6))

    def test_cache_failure_keeps_date_and_never_exports_raw_exception(self):
        with TemporaryDirectory() as directory:
            good = wind.cached_fetch('test', lambda: {'points': [{'date': '2026-11-04', 'value': 1}]}, directory)
            bad = wind.cached_fetch('test', Mock(side_effect=ValueError('sensitive upstream body')), directory, True)
            self.assertEqual(bad['status'], 'stale')
            self.assertEqual(good['fetchedAt'], bad['fetchedAt'])
            self.assertNotIn('sensitive', json.dumps(bad))
            self.assertEqual(bad['points'], good['points'])

    def test_credit_failure_is_explicit_and_local_circuit_breaker_avoids_client(self):
        with TemporaryDirectory() as directory:
            result = wind.cached_fetch('test', Mock(side_effect=wind.WindETFError('credits_exhausted')), directory)
            self.assertEqual(result['status'], 'missing')
            self.assertIn('402', result['error'])
        with patch.object(wind, 'read_json', return_value={'failedAtEpoch': wind.time.time()}), patch.object(wind, 'WindClient') as client:
            with self.assertRaisesRegex(wind.WindETFError, 'credits_exhausted'): wind.new_client()
            client.assert_not_called()

    def test_kline_rejects_truncation_and_internal_gap(self):
        def payload(days):
            return {'data': {'columns': [{'name': 'TIME'}, {'name': 'MATCH'}], 'rows': [[d, '100'] for d in days]}}
        good = payload(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'])
        self.assertEqual(len(wind.parse_kline(good, date(2026, 11, 1), date(2026, 11, 5))['points']), 4)
        for p, start, end in [(good, date(2026, 1, 1), date(2026, 11, 5)),
                              (payload(['2026-10-01', '2026-11-05']), date(2026, 10, 1), date(2026, 11, 5))]:
            with self.assertRaises(ValueError): wind.parse_kline(p, start, end)

    def test_valuation_requires_index_identity_ttm_and_ten_year_evidence(self):
        def table(names, row):
            return {'columns': [{'name': n} for n in names], 'rows': [row]}
        pe = table(['Wind代码', '2026年11月5日市盈率PE_TTM'], ['NDX.GI', 26])
        result = wind.parse_valuation({'data': {'data': [pe]}}, '2026-11-05')
        self.assertEqual(result['peTtm'], 26)
        self.assertIsNone(result['pePercentile10y'])
        tables = [pe, table(['Wind代码', '2026年11月5日市盈率PE_TTM在过去十年的分位数'], ['NDX.GI', 18]),
                  table(['2026年11月5日近十年有效观测数'], [2513]),
                  table(['2026年11月5日近十年最早日期'], ['2016-11-07']),
                  table(['2026年11月5日近十年最晚日期'], ['2026-11-05'])]
        self.assertEqual(wind.parse_valuation({'data': {'data': tables}}, '2026-11-05')['pePercentile10y'], 18)
        pe['rows'][0][0] = 'AAPL.O'
        with self.assertRaises(ValueError): wind.parse_valuation({'data': {'data': tables}}, '2026-11-05')

    def test_wind_stale_liquidity_keeps_original_date_and_replaces_history_without_splicing(self):
        with TemporaryDirectory() as directory:
            path = Path(directory)
            wind.write_json(path / 'cn_south.json', {'source': '东财', 'points': [{'date': '2020-01-01', 'value': 90}]})
            result = load_series('cn_south', [lambda: {'unit': '亿元', 'points': [{'date': '2026-11-05', 'value': -181.2}],
                'source': 'Wind MCP · 人民币', 'sourceUrl': wind.URL, 'fetchedAt': '2026-11-06T01:00:00Z',
                'status': 'stale', 'error': '余额不足'}], path, expected_source='Wind ', today=date(2026, 11, 6))
            self.assertEqual(result['status'], 'stale')
            self.assertEqual(len(result['points']), 1)
            self.assertEqual(result['fetchedAt'], '2026-11-06T01:00:00Z')

    def test_reserve_ratio_is_not_enabled_and_etf_snapshot_does_not_refresh(self):
        self.assertNotIn('pending-money-3', wind.SERIES)
        with TemporaryDirectory() as directory, patch.object(wind, 'etf_snapshot', return_value={}) as etf:
            wind.write_json(Path(directory) / 'risk.json', {'attemptEpoch': wind.time.time(), 'indicators': {}})
            result = wind.risk_snapshot(directory)
            self.assertIn('pending-structure-3', result['indicators'])
            self.assertEqual(etf.call_args.kwargs, {})

    def test_endpoint_exposes_only_fixed_readings(self):
        from scripts.local_proxy import create_server
        with patch.object(wind, 'risk_snapshot', return_value={'indicators': {'test': {'value': 0}}}) as snapshot, \
             patch('scripts.local_proxy.yahoo_risk_readings', return_value={}):
            server = create_server(port=0)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = 'http://127.0.0.1:' + str(server.server_address[1]) + '/api/wind-risk'
            try:
                with urlopen(url) as response:
                    self.assertEqual(json.load(response)['indicators'], {})
                with self.assertRaises(HTTPError) as error:
                    urlopen(url + '?tool=arbitrary')
                self.assertEqual(error.exception.code, 400)
                snapshot.assert_not_called()
            finally:
                server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
