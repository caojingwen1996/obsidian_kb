from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch
from scripts.etf_estimate import estimate_snapshot, read_estimate, SOURCE
from scripts.liquidity_data import etf_metric, read_etf_metric, liquidity_snapshot


class EstimateTests(TestCase):
    def api(self):
        return Mock(query=Mock(return_value={'rows':[{'trade_date':'2026-11-05','complete':False,
            'sample_net_flow_yi':12, 'coverage':{'expected':2,'received':1},
            'excluded':[{'ts_code':'512220.SH','name':'ETF','reason':'corporate_action_review'}]}]}))

    def test_partial_estimate_disclosed_and_old_wind_isolated(self):
        with TemporaryDirectory() as path:
            api=self.api()
            raw=estimate_snapshot(path,today=date(2026,11,6),api=api)
            metric=etf_metric(raw,date(2026,11,6))
            self.assertEqual(metric['value'],12)
            self.assertIn('样本估算',metric['name'])
            self.assertEqual(metric['coverage']['received'],1)
            self.assertIsNone(metric['percentile'])
            self.assertIsNone(metric['previous'])
            self.assertEqual(read_etf_metric(path,date(2026,11,6))['source'],SOURCE)
            estimate_snapshot(path,today=date(2026,11,6),api=api)
            api.query.assert_called_once()
            api.query.side_effect=RuntimeError('secret must not leak')
            failed=estimate_snapshot(path,force=True,today=date(2026,11,6),api=api)
            self.assertEqual(failed['status'],'stale')
            self.assertEqual(failed['fetchedAt'],raw['fetchedAt'])
            self.assertNotIn('secret',failed['error'])

    def test_read_only_empty_does_not_call_provider(self):
        with TemporaryDirectory() as path, patch('scripts.etf_estimate.market_data') as service:
            self.assertEqual(read_estimate(path)['status'],'missing')
            service.assert_not_called()

    def test_default_snapshot_attaches_estimate_without_wind(self):
        with TemporaryDirectory() as path:
            raw=estimate_snapshot(path,today=date(2026,11,6),api=self.api())
            with patch('scripts.etf_estimate.estimate_snapshot',return_value=raw), \
                 patch('scripts.liquidity_data.free_adapters',return_value={}), \
                 patch('scripts.liquidity_data.monitor_adapters',return_value={}), \
                 patch('scripts.shared_market_data.liquidity_adapters',return_value={}), \
                 patch('scripts.yahoo_data.liquidity_adapters',return_value={}), \
                 patch('scripts.liquidity_data.etf_snapshot') as wind:
                result=liquidity_snapshot(path,force=True,today=date(2026,11,6))
            wind.assert_not_called()
            metric=next(r for r in result['fundingMonitor']['cards'] if r['id']=='cn_etf_flow')
            self.assertEqual(metric['value'],12)
            self.assertTrue(metric['estimate'])
