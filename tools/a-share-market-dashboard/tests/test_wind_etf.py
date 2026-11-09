from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import wind_etf
from scripts.liquidity_data import liquidity_snapshot

TODAY = date(2026, 11, 5)


def universe_text(code):
    return ('为您查到 1 条基金数据\n| 序号 | 基金代码 | 基金简称 | 基金成立日 |\n'
            f'|---|---|---|---|\n| 1 | {code} | 测试ETF | 2020-01-01 |')


def flow_text(codes, day='2026-11-04', missing=None):
    rows = '\n'.join(f'| {i + 1} | {code} | 测试ETF | {"--" if code == missing else "100000000"} |'
                     for i, code in enumerate(codes))
    return (f'已返回{len(codes)}只基金 {day}的行情数据。\n'
            '| 序号 | 基金代码 | 基金简称 | 申赎净流入额（元） |\n|---|---|---|---|\n' + rows)


class WindParsingTests(unittest.TestCase):
    def test_json_and_sse_rpc_responses_match_request(self):
        response = {'jsonrpc': '2.0', 'id': 'req', 'result': {'content': []}}
        self.assertEqual(wind_etf.decode_rpc(json.dumps(response), 'req'), {'content': []})
        sse = 'event: message\ndata: {"method":"progress"}\n\nevent: message\ndata: ' + json.dumps(response) + '\n\n'
        self.assertEqual(wind_etf.decode_rpc(sse, 'req'), {'content': []})
        with self.assertRaises(wind_etf.WindETFError): wind_etf.decode_rpc(sse, 'wrong')
        with self.assertRaises(wind_etf.WindETFError): wind_etf.decode_rpc('{"id":"req","error":{}}', 'req')

    def test_credentials_reuse_environment_or_existing_config(self):
        self.assertEqual(wind_etf.authorization({'WIND_API_KEY': 'example-test-value'}), 'Bearer example-test-value')
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'config.toml'
            path.write_text('[mcp_servers.wind-tools.http_headers]\nAuthorization = "Bearer example-test-value"\n', encoding='utf-8')
            self.assertEqual(wind_etf.authorization({}, path), 'Bearer example-test-value')
            path.write_text('', encoding='utf-8')
            with self.assertRaisesRegex(wind_etf.WindETFError, 'credentials_missing'):
                wind_etf.authorization({}, path)

    def test_universe_rejects_truncation_duplicates_and_wrong_exchange(self):
        text = universe_text('510300.OF')
        self.assertEqual(wind_etf.parse_universe(text, 'SH'), ['510300.OF'])
        for bad in [text.replace('1 条', '1001 条'), text + '\n超出展示上限', text.replace('510300', '159919'),
                    text.replace('1 条', '2 条') + '\n| 2 | 510300.OF | 测试ETF | 2020-01-01 |']:
            with self.assertRaises(wind_etf.WindETFError): wind_etf.parse_universe(bad, 'SH')

    def test_net_subscription_field_exact_unit_zero_and_single_fund_summary(self):
        text = flow_text(['510300.OF']).replace('100000000', '0').replace('1只基金', '沪深300ETF（510300.OF）')
        day, values, missing = wind_etf.parse_flows(text, ['510300.OF'], TODAY)
        self.assertEqual(day, '2026-11-04'); self.assertEqual(values['510300.OF'], Decimal(0)); self.assertEqual(missing, [])
        with self.assertRaisesRegex(wind_etf.WindETFError, 'unexpected_fields'):
            wind_etf.parse_flows(text.replace('申赎净流入额（元）', '净流入额（元）'), ['510300.OF'], TODAY)

    def test_flow_rejects_unknown_duplicate_or_future_date(self):
        text = flow_text(['510300.OF'])
        for bad in [text.replace('510300', '510050'), text.replace('2026-11-04', '2026-11-06'),
                    flow_text(['510300.OF', '510300.OF'])]:
            with self.assertRaises(wind_etf.WindETFError): wind_etf.parse_flows(bad, ['510300.OF'], TODAY)
        self.assertEqual(wind_etf.parse_flows(flow_text(['510300.OF'], missing='510300.OF'), ['510300.OF'], TODAY)[2], ['510300.OF'])


class FakeClient:
    def __init__(self, partial=False):
        self.partial = partial
        self.requests = []

    def call(self, name, args):
        self.requests.append((name, args))
        if name == 'fund_screener':
            return universe_text('510300.OF' if '上海' in args['query'] else '159919.OF')
        if name == 'fund_get_basic_info':
            return '| 基金代码 | 上市日期 |\n|---|---|\n' + '\n'.join(f'| {code} | 2020-01-01 |' for code in args['windCodes'])
        if args['tradeDate'] == '2026-11-05':
            return '2只基金在所查询交易日2026-11-05均无行情数据。'
        return flow_text(args['windCodes'], args['tradeDate'], '159919.OF' if self.partial else None)


class WindCollectionTests(unittest.TestCase):
    def setUp(self):
        for key, value in [('WIND_ENABLED', True), ('WIND_ETF_ENABLED', True), ('DATA_PROVIDER', 'free')]:
            setting = patch.object(wind_etf.config, key, value)
            setting.start()
            self.addCleanup(setting.stop)
    def test_refresh_seeds_actual_latest_and_previous_and_exact_coverage(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); client = FakeClient()
            wind_etf.refresh_etf(root, TODAY, lambda: client)
            data = wind_etf.read_json(root / 'series.json')
            self.assertEqual(data['points'], [{'date': '2026-11-03', 'value': 2}, {'date': '2026-11-04', 'value': 2}])
            self.assertEqual(data['dailyCoverage']['2026-11-04']['received'], 2)
            self.assertEqual(data['transport'], 'wind-mcp')
            self.assertFalse(wind_etf.read_json(root / 'status.json')['running'])
            self.assertEqual(wind_etf.read_json(root / 'status.json')['error'], '')
            for name, args in client.requests:
                if name == wind_etf.FLOW_TOOL:
                    self.assertEqual(args['includeFields'], ['f_mf_netsubamt'])
            # Same-day list cache is used on the next refresh.
            next_client = FakeClient()
            wind_etf.refresh_etf(root, TODAY, lambda: next_client)
            self.assertFalse(any(name == 'fund_screener' for name, _ in next_client.requests))

    def test_incomplete_data_keeps_last_complete_aggregate_and_redacts_errors(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            wind_etf.refresh_etf(root, TODAY, FakeClient)
            original = (root / 'series.json').read_bytes()
            wind_etf.refresh_etf(root, TODAY, lambda: FakeClient(partial=True))
            self.assertEqual((root / 'series.json').read_bytes(), original)
            self.assertEqual(wind_etf.read_json(root / 'status.json')['error'], 'coverage_incomplete')
            def fail(): raise RuntimeError('private sentinel, must never persist')
            wind_etf.refresh_etf(root, TODAY, fail)
            self.assertNotIn('sentinel', (root / 'status.json').read_text())

    def test_batches_never_exceed_50_and_reject_mixed_dates(self):
        codes = [f'{510000 + i}.OF' for i in range(51)]
        calls = []
        class Client:
            def call(self, name, args):
                calls.append(args)
                return flow_text(args['windCodes'], '2026-11-04' if len(args['windCodes']) == 50 else '2026-11-03')
        with self.assertRaisesRegex(wind_etf.WindETFError, 'mixed_trade_dates'):
            wind_etf.collect_day(Client(), codes, TODAY, lambda *args: None)
        self.assertEqual(sorted(len(c['windCodes']) for c in calls), [1, 50])

    def test_missing_fund_is_excluded_only_with_later_verified_listing_date(self):
        class NewFundClient(FakeClient):
            def call(self, name, args):
                if name == 'fund_get_basic_info':
                    return '| 基金代码 | 上市日期 |\n|---|---|\n| 159919.OF | 2026-11-05 |'
                return super().call(name, args)
        point, coverage, values = wind_etf.collect_day(NewFundClient(partial=True), ['510300.OF','159919.OF'], TODAY, lambda *args: None)
        self.assertEqual(point['value'], 1)
        self.assertEqual(coverage['expected'], 1)
        self.assertEqual(coverage['screened'], 2)
        self.assertEqual(coverage['excludedNotListed'], [{'code':'159919.OF','listedDate':'2026-11-05'}])

    def test_background_refresh_is_deduplicated_and_snapshot_has_progress(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch('scripts.wind_etf.Thread') as thread:
                first = wind_etf.etf_snapshot(root, force=True, today=TODAY)
                second = wind_etf.etf_snapshot(root, force=True, today=TODAY)
                self.assertTrue(first['refresh']['running']); self.assertEqual(second['status'], 'missing')
                self.assertEqual(thread.call_count, 1)
            wind_etf._JOBS.discard(str((root / 'wind-etf').resolve()))

    def test_reading_snapshot_never_starts_wind_even_if_cache_is_old(self):
        with tempfile.TemporaryDirectory() as temporary, patch('scripts.wind_etf.Thread') as thread:
            root = Path(temporary)
            wind_etf.write_json(root/'wind-etf/status.json', {'lastAttemptEpoch':0})
            wind_etf.etf_snapshot(root, today=TODAY)
            thread.assert_not_called()

    def test_scheduled_attempt_once_per_day_manual_refresh_still_available(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = wind_etf.refresh_etf(root, TODAY, FakeClient, scheduled=True)
            self.assertEqual(first['scheduledAttemptDate'], '2026-11-05')
            with patch('scripts.wind_etf._refresh_etf') as refresh:
                self.assertEqual(wind_etf.refresh_etf(root, TODAY, FakeClient, scheduled=True)['skipped'], 'already_attempted_today')
                refresh.assert_not_called()
                wind_etf.refresh_etf(root, TODAY, FakeClient)
                refresh.assert_called_once()
            failed_root = root/'failure'
            def fail(): raise RuntimeError('private')
            wind_etf.refresh_etf(failed_root, TODAY, fail, scheduled=True)
            self.assertEqual(wind_etf.refresh_etf(failed_root, TODAY, fail, scheduled=True)['skipped'], 'already_attempted_today')

    def test_cross_process_lock_prevents_manual_and_scheduled_overlap(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)/'wind-etf';root.mkdir()
            with (root/'refresh.lock').open('a') as lock:
                wind_etf.fcntl.flock(lock, wind_etf.fcntl.LOCK_EX|wind_etf.fcntl.LOCK_NB)
                self.assertTrue(wind_etf.refresh_is_running(root))
                self.assertEqual(wind_etf.refresh_etf(root,TODAY,FakeClient,scheduled=True),{'skipped':'running'})
                with patch('scripts.wind_etf.Thread') as thread:
                    wind_etf.etf_snapshot(root.parent, force=True, today=TODAY)
                    thread.assert_not_called()

    def test_report_cache_keeps_etf_progress_and_values_current(self):
        with tempfile.TemporaryDirectory() as temporary:
            raw = {'points': [{'date': '2026-11-04', 'value': 1}], 'transport': 'wind-mcp', 'status': 'ok'}
            with patch('scripts.liquidity_data.etf_snapshot', return_value=raw), \
                 patch('scripts.liquidity_data.free_adapters', return_value={}), \
                 patch('scripts.liquidity_data.monitor_adapters', return_value={}):
                first = liquidity_snapshot(temporary, today=TODAY)
                raw['points'][0]['value'] = 2
                second = liquidity_snapshot(temporary, today=TODAY)
            a = next(x for x in first['fundingMonitor']['cards'] if x['id'] == 'cn_etf_flow')
            b = next(x for x in second['fundingMonitor']['cards'] if x['id'] == 'cn_etf_flow')
            self.assertEqual(a['value'], 1); self.assertEqual(b['value'], 2)


if __name__ == '__main__':
    unittest.main()
