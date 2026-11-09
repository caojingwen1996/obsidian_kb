from datetime import date
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from scripts import liquidity_config as config
from scripts import liquidity_data, wind_etf
from scripts.local_proxy import fetch_nasdaq100_snapshot
from tests.test_yahoo_data import fixture, stamp
from scripts.yahoo_data import YahooChartClient


class DisabledWindTests(TestCase):
    def test_transport_stops_before_credentials_or_network(self):
        self.assertFalse(config.WIND_ENABLED)
        self.assertFalse(config.WIND_ETF_ENABLED)
        with patch.object(wind_etf, 'authorization') as auth, patch.object(wind_etf, 'build_opener') as network:
            with self.assertRaisesRegex(wind_etf.WindETFError, 'disabled_by_user'):
                wind_etf.WindClient()
            auth.assert_not_called()
            network.assert_not_called()

    def test_manual_etf_refresh_ignores_old_cache_without_starting_job(self):
        with TemporaryDirectory() as directory, patch.object(wind_etf, 'Thread') as thread:
            root = Path(directory)
            wind_etf.write_json(root/'wind-etf/series.json', {'source': 'Wind MCP', 'points': [{'date':'2026-11-05','value':9}]})
            result = wind_etf.etf_snapshot(root, force=True)
            self.assertEqual(result['points'], [])
            self.assertEqual(result['transport'], 'disabled')
            thread.assert_not_called()
            self.assertEqual(wind_etf.read_json(root/'wind-etf/series.json')['points'][0]['value'],9)

    def test_disabled_wind_cache_is_not_used_on_fallback_failure(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            wind_etf.write_json(root/'us_WALCL.json', {'source': 'Wind MCP', 'points': [{'date':'2026-11-05','value':9}]})
            result = liquidity_data.load_series('us_WALCL', [Mock(side_effect=ValueError('offline'))], root, today=date(2026,11,6))
            self.assertFalse(result.get('points'))
            self.assertEqual(result['status'], 'missing')

    def test_default_refresh_never_installs_wind_or_reads_etf(self):
        with TemporaryDirectory() as directory, patch.object(liquidity_data.config, 'ETF_ESTIMATE_ENABLED', False), patch.object(liquidity_data, 'free_adapters', return_value={}), \
             patch.object(liquidity_data, 'monitor_adapters', return_value={}), \
             patch('scripts.shared_market_data.liquidity_adapters', return_value={}), \
             patch('scripts.yahoo_data.liquidity_adapters', return_value={}), \
             patch('scripts.wind_data.liquidity_adapters') as wind, patch.object(liquidity_data, 'etf_snapshot') as etf:
            result = liquidity_data.liquidity_snapshot(directory, force=True)
            wind.assert_not_called(); etf.assert_not_called()
            card = next(r for r in result['fundingMonitor']['cards'] if r['id']=='cn_etf_flow')
            self.assertIsNone(card['value'])
            self.assertEqual(card['status'], 'missing')

    def test_nasdaq_does_not_request_wind_valuation(self):
        raw = fixture()
        raw['chart']['result'][0]['meta']['regularMarketTime'] = stamp('2026-11-05')
        with patch('scripts.wind_data.nasdaq_valuation') as valuation:
            result = fetch_nasdaq100_snapshot(client=YahooChartClient(lambda url: raw), valuation_loader=lambda _: {"status": "missing", "valuationNote": "理杏仁未配置"})
            self.assertIsNone(result['data']['peTtm'])
            self.assertIn('理杏仁', result['data']['valuationNote'])
            valuation.assert_not_called()
