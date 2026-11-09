import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess

from scripts.liquidity_data import load_series, shared_fetch, wind_fetch_all
from scripts.akshare_data import shared_market_fund_flow, market_fund_flow, AKShareUnavailable
from scripts.liquidity_monitor import (margin_monitor_series, order_flow_series, breadth_snapshot,
                                       imported_etf_series, build_funding_monitor, monitor_adapters)

TODAY = date(2026, 11, 5)


def sample(values, status='ok'):
    return {'status': status, 'source': '测试来源', 'points': [
        {'date': (TODAY - timedelta(days=len(values) - i - 1)).isoformat(), 'value': value}
        for i, value in enumerate(values)]}


def breadth_html(**changes):
    counts = {'total': 100, 'totalUp': 60, 'totalDown': 30, 'priceStop': 8, 'pricePaused': 2,
              'limitUp': 5, 'limitDown': 0}
    counts.update(changes)
    return '<span class="market-activity-time">2026-11-05 15:00:00</span>' + ''.join(
        f'<div id="{key}" data-chart="{value}"></div>' for key, value in counts.items())


class FundingAdapterTests(unittest.TestCase):
    def test_financing_net_is_purchases_minus_repayments_not_balance_change(self):
        rows = [{'DIM_DATE': '2026-11-04 00:00:00', 'RZMRE': 150e8, 'RZCHE': 120e8,
                 'RZJME': 42e8, 'RZYE': 20000e8, 'LTSZ': 1000000e8}]
        self.assertEqual(margin_monitor_series(rows, 'cn_margin_net')[0][0]['value'], 30)
        self.assertEqual(margin_monitor_series(rows, 'cn_margin_ratio')[0][0]['value'], 2)
        rows[0]['RZCHE'] = None
        self.assertEqual(margin_monitor_series(rows, 'cn_margin_net')[0], [])
        rows[0]['LTSZ'] = 0
        self.assertEqual(margin_monitor_series(rows, 'cn_margin_ratio')[0], [])

    def test_order_flow_named_columns_units_and_bad_values(self):
        rows = [{'日期': '2026-11-04', '超大单净流入-净额': 3e8, '小单净流入-净额': -2e8},
                {'日期': '2026-11-05', '超大单净流入-净额': 'NaN', '小单净流入-净额': 0},
                {'日期': 'NaT', '超大单净流入-净额': 4e8, '小单净流入-净额': 2e8}]
        load = lambda: rows
        close = lambda points, _: points
        self.assertEqual(order_flow_series(load, 'cn_super_flow', close)[0], [{'date': '2026-11-04', 'value': 3}])
        self.assertEqual(order_flow_series(load, 'cn_small_flow', close)[0],
                         [{'date': '2026-11-04', 'value': -2}, {'date': '2026-11-05', 'value': 0}])
        with self.assertRaises(ValueError):
            order_flow_series(lambda: [{'日期': '2026-11-05'}], 'cn_small_flow', close)

    def test_flow_cards_share_request_and_apply_closing_filter(self):
        rows = [{'日期': day, '主力净流入-净额': -5e8, '主力净流入-净占比': -1.2,
                 '超大单净流入-净额': 3e8, '小单净流入-净额': -2e8}
                for day in ['2026-11-04', '2026-11-05']]
        with patch('scripts.akshare_data.market_fund_flow', return_value=rows) as loader:
            adapters = monitor_adapters(None, None, lambda ps, _: ps[:1], Path('.'))
            with ThreadPoolExecutor(max_workers=3) as pool:
                results = list(pool.map(lambda key: adapters[key][0](), ['cn_flow', 'cn_super_flow', 'cn_small_flow']))
            loader.assert_called_once()
            self.assertEqual([r[0][0]['value'] for r in results], [-5, 3, -2])
            self.assertTrue(all(len(r[0]) == 1 and r[1].startswith('AKShare ') for r in results))

    def test_flow_failure_deduplicated_and_worker_timeout_bounded(self):
        with patch('scripts.akshare_data.market_fund_flow', side_effect=AKShareUnavailable) as loader:
            load = shared_market_fund_flow()
            for _ in range(2):
                with self.assertRaises(AKShareUnavailable): load()
            loader.assert_called_once()
        with patch('scripts.akshare_data.subprocess.run', side_effect=subprocess.TimeoutExpired('worker', 25)) as run:
            with self.assertRaises(AKShareUnavailable): market_fund_flow()
            self.assertEqual(run.call_args.kwargs['timeout'], 25)

    def test_main_flow_zero_missing_and_old_cache(self):
        rows = [{'日期': day, '主力净流入-净额': value}
                for day, value in [('2026-11-03', 0), ('2026-11-04', None), ('2026-11-05', float('nan'))]]
        points = order_flow_series(lambda: rows, 'cn_flow', lambda ps, _: ps)[0]
        self.assertEqual(points, [{'date': '2026-11-03', 'value': 0}])
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            load_series('cn_flow', [lambda: (points, '东财旧接口', 'https://example.com')], root, True, TODAY)
            def failed(): raise AKShareUnavailable()
            result = load_series('cn_flow', [failed], root, False, TODAY, 'AKShare ')
            self.assertEqual(result['status'], 'missing')
            self.assertEqual(result['points'], [])

    def test_flow_failed_migration_does_not_relabel_old_cache(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adapter = lambda: ([{'date': '2026-11-04', 'value': 3}], '东财旧接口', 'https://example.com')
            load_series('cn_super_flow', [adapter], root, True, TODAY)
            def failed(): raise AKShareUnavailable()
            result = load_series('cn_super_flow', [failed], root, False, TODAY, 'AKShare ')
            self.assertEqual(result['points'], [])
            self.assertEqual(result['status'], 'missing')
            self.assertIn('AKShare东方财富接口暂不可用', result['error'])
            adapter = lambda: ([{'date': '2026-11-04', 'value': 3}], 'AKShare 东财', 'https://example.com')
            load_series('cn_super_flow', [adapter], root, True, TODAY, 'AKShare ')
            result = load_series('cn_super_flow', [failed], root, True, TODAY, 'AKShare ')
            self.assertEqual(result['status'], 'stale')
            self.assertEqual(result['points'][0]['value'], 3)

    def test_breadth_denominator_includes_suspended_and_zero_limit_is_valid(self):
        day, values = breadth_snapshot(breadth_html())
        self.assertEqual(day, TODAY.isoformat())
        self.assertEqual(values['ratio'], 60)
        self.assertEqual(values['limit_down'], 0)
        for html in [breadth_html(total=99), breadth_html(limitDown=31), breadth_html(totalUp='NaN'),
                     breadth_html().replace('market-activity-time', 'no-date')]:
            with self.assertRaises(ValueError):
                breadth_snapshot(html)

    def test_breadth_cache_accumulates_revises_and_does_not_mix_sources(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def adapter(day, value, source='同一来源'):
                return lambda: ([{'date': day, 'value': value}], source, 'https://example.com/')
            load_series('cn_breadth_ratio', [adapter('2026-11-04', 40)], root, True, TODAY)
            current = load_series('cn_breadth_ratio', [adapter('2026-11-05', 60)], root, True, TODAY)
            self.assertEqual([p['value'] for p in current['points']], [40, 60])
            revised = load_series('cn_breadth_ratio', [adapter('2026-11-05', 61)], root, True, TODAY)
            self.assertEqual([p['value'] for p in revised['points']], [40, 61])
            changed = load_series('cn_breadth_ratio', [adapter('2026-11-05', 62, '其他来源')], root, True, TODAY)
            self.assertEqual(len(changed['points']), 1)

    def test_etf_import_requires_scope_basis_and_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'imports').mkdir()
            payload = {'id': 'cn_etf_flow', 'unit': '亿元', 'scope': '沪深股票型ETF',
                       'basis': 'net_creation_redemption', 'source': '已核验数据',
                       'sourceUrl': 'https://example.com/', 'points': [{'date': '2026-11-04', 'value': 0}]}
            path = root / 'imports' / 'cn_etf_flow.json'
            path.write_text(json.dumps(payload), encoding='utf-8')
            self.assertEqual(imported_etf_series(root, TODAY)[0][0]['value'], 0)
            for key, bad in [('basis', 'turnover'), ('scope', '部分ETF'), ('unit', '元'), ('sourceUrl', '')]:
                path.write_text(json.dumps({**payload, key: bad}), encoding='utf-8')
                with self.assertRaises(ValueError): imported_etf_series(root, TODAY)
            (root / 'wind').mkdir()
            (root / 'wind' / path.name).write_text(json.dumps({**payload, 'basis': 'turnover'}), encoding='utf-8')
            self.assertEqual(wind_fetch_all(root, TODAY)['cn_etf_flow']['status'], 'missing')

    def test_shared_requests_are_deduplicated_including_errors(self):
        calls = []
        def fetch(url):
            calls.append(url)
            if url == 'bad': raise ValueError('failed')
            return 'response'
        get = shared_fetch(fetch)
        with ThreadPoolExecutor(max_workers=6) as pool:
            self.assertEqual(list(pool.map(get, ['same'] * 6)), ['response'] * 6)
        for _ in range(2):
            with self.assertRaises(ValueError): get('bad')
        self.assertEqual(calls, ['same', 'bad'])


class FundingObservationTests(unittest.TestCase):
    def test_percentile_requires_60_and_ties_rank_at_midpoint(self):
        for values, rank in [([1] * 59, None), ([1] * 60, 50), (list(range(60)), 99),
                             ([0] * 59 + [-1], 1)]:
            item = build_funding_monitor({'cn_margin_net': sample(values)}, TODAY)['cards'][0]
            self.assertEqual(item['percentile'], rank)
            self.assertIsNone(item['score'])
            self.assertTrue(item['reference'])

    def test_stale_reading_has_no_current_direction_or_rank(self):
        item = build_funding_monitor({'cn_margin_net': sample([1] * 60, 'stale')}, TODAY)['cards'][0]
        self.assertEqual(item['value'], 1)
        self.assertEqual(item['status'], 'stale')
        self.assertEqual(item['direction'], '待更新')
        self.assertIsNone(item['percentile'])
        old = {'points': [{'date': '2026-10-01', 'value': 5}]}
        self.assertEqual(build_funding_monitor({'cn_margin_net': old}, TODAY)['cards'][0]['status'], 'stale')

    def test_no_etf_data_is_not_zero_and_previous_keeps_actual_date(self):
        raw = {'points': [{'date': '2026-10-30', 'value': 4}, {'date': '2026-11-04', 'value': 0}]}
        monitor = build_funding_monitor({'cn_margin_net': raw}, TODAY)
        self.assertEqual(monitor['cards'][0]['previous']['date'], '2026-10-30')
        self.assertEqual(monitor['cards'][0]['value'], 0)
        self.assertIsNone(monitor['cards'][2]['value'])
        self.assertIn('尚未接入', monitor['cards'][2]['reason'])


if __name__ == '__main__':
    unittest.main()
