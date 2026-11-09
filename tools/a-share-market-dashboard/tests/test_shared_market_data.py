from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from scripts.shared_market_data import (CN, kline_payload, csi_dividend_payload,
    etf_prices, liquidity_adapters, closed_cn_date, TushareClientError)
from scripts.local_proxy import fetch_index_history, UpstreamError
from scripts.liquidity_data import load_series


NOW = datetime(2026, 11, 6, 10, tzinfo=CN)


class SharedMarketTests(TestCase):
    def test_southbound_uses_shared_history_and_excludes_old_eastmoney_cache(self):
        api = self.api([{"trade_date": "20261104", "complete": True, "net_buy_yi": 0},
                        {"trade_date": "20261105", "complete": False, "net_buy_yi": None}], "ggt_daily")
        points, source, url = liquidity_adapters(date(2026, 11, 6), api)["cn_south"][0]()
        self.assertEqual(points, [{"date": "2026-11-04", "value": 0}])
        self.assertEqual(api.query.call_args.args, ("get_southbound_flow",))
        self.assertIn("Tushare ggt_daily", source)
        with TemporaryDirectory() as directory:
            path = Path(directory)
            load_series("cn_south", [lambda: ([{"date": "2026-11-04", "value": 99}], "东财", "url")], path)
            missing = load_series("cn_south", [Mock(side_effect=RuntimeError("offline"))], path, expected_source="Tushare ")
            self.assertEqual(missing["points"], [])
            self.assertEqual(missing["status"], "missing")
            load_series("cn_south", [lambda: (points, source, url)], path, force=True, expected_source="Tushare ")
            stale = load_series("cn_south", [Mock(side_effect=RuntimeError("offline"))], path, force=True, expected_source="Tushare ")
            self.assertEqual(stale["points"], points)
            self.assertEqual(stale["status"], "stale")

    def api(self, rows, dataset="fund_daily", adjustment="qfq"):
        return Mock(query=Mock(return_value={"rows": rows, "dataset": dataset,
                    "adjustment": adjustment, "anchor_date": "20261105"}))

    def test_fund_kline_uses_one_adjusted_history_and_closed_day(self):
        rows = [{"trade_date": (date(2025, 1, 1) + timedelta(days=i)).strftime("%Y%m%d"),
                 "open": 1, "close": 2, "high": 3, "low": .5, "vol": 123} for i in range(300)]
        api = self.api(rows)
        payload = kline_payload("0.159941", 250, api, NOW)
        self.assertEqual(len(payload["data"]["klines"]), 250)
        self.assertEqual(payload["data"]["klines"][-1].split(",")[1:], ["1", "2", "3", "0.5", "123"])
        self.assertEqual(api.query.call_args.args, ("get_fund_daily",))
        self.assertEqual(api.query.call_args.kwargs["adjustment"], "qfq")
        self.assertEqual(api.query.call_args.kwargs["end_date"], "2026-11-05")
        self.assertEqual(payload["frequency"], "daily")

    def test_csi_exact_identity_and_compatible_date_fields(self):
        api = self.api([{"trade_date": "20261105", "close": 5000}], "index_daily", "none")
        result = csi_dividend_payload("20260101", "20261106", api, NOW)
        self.assertEqual(result["data"], [{"indexCode": "000922", "tradeDate": "20261105", "close": 5000}])
        self.assertEqual(api.query.call_args.kwargs["ts_code"], "000922.CSI")

    def test_missing_data_and_permission_do_not_fallback(self):
        with self.assertRaises(TushareClientError):
            kline_payload("1.000001", 250, self.api([]), NOW)
        api = Mock(query=Mock(side_effect=TushareClientError("tushare-permission")))
        with self.assertRaises(UpstreamError) as caught:
            fetch_index_history("0.159941", 250, api)
        self.assertEqual(caught.exception.source, "tushare-permission")

    def test_etf_raw_and_adjusted_price_use_same_end(self):
        api = self.api([{"trade_date": "20261105", "close": 1.5}])
        self.assertEqual(etf_prices("none", NOW, api)["2026-11-05"]["close"], 1.5)
        etf_prices("qfq", NOW, api)
        self.assertEqual([c.kwargs["adjustment"] for c in api.query.call_args_list], ["none", "qfq"])
        self.assertEqual({c.kwargs["end_date"] for c in api.query.call_args_list}, {"2026-11-05"})

    def test_closed_day_boundary(self):
        self.assertEqual(closed_cn_date(NOW), date(2026, 11, 5))
        self.assertEqual(closed_cn_date(NOW.replace(hour=15, minute=30)), date(2026, 11, 6))

    def test_margin_filters_incomplete_rows_and_preserves_yi_units(self):
        api = self.api([
            {"trade_date": "20261104", "complete": True, "financing_balance_yi": 20000, "financing_net_buy_yi": -20},
            {"trade_date": "20261105", "complete": False, "financing_balance_yi": 10000, "financing_net_buy_yi": 10},
        ], "margin")
        adapters = liquidity_adapters(date(2026, 11, 5), api)
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda key: adapters[key][0](), ["cn_margin", "cn_margin_net"]))
        self.assertEqual(results[0][0], [{"date": "2026-11-04", "value": 20000}])
        self.assertEqual(results[1][0], [{"date": "2026-11-04", "value": -20}])
        api.query.assert_called_once()

    def test_old_provider_cache_is_not_reported_as_fresh_after_switch(self):
        with TemporaryDirectory() as directory:
            path = Path(directory)
            old = lambda: ([{"date": "2026-11-04", "value": 3}], "FRED", "https://example.org")
            load_series("us_DGS10", [old], path, today=date(2026, 11, 5))
            fail = Mock(side_effect=RuntimeError("offline"))
            result = load_series("us_DGS10", [fail], path, today=date(2026, 11, 5), expected_source="Tushare ")
            fail.assert_called_once()
            self.assertEqual(result["status"], "stale")
            self.assertEqual(result["source"], "FRED")

    def test_default_snapshot_installs_shared_adapters_after_monitor_adapters(self):
        from scripts import liquidity_data
        with TemporaryDirectory() as directory, patch.object(liquidity_data.config, "ETF_ESTIMATE_ENABLED", False), patch.object(liquidity_data.config, "WIND_ETF_ENABLED", False), \
             patch.object(liquidity_data, "free_adapters", return_value={}), \
             patch("scripts.wind_data.liquidity_adapters", return_value={}), \
             patch("scripts.yahoo_data.liquidity_adapters", return_value={}), \
             patch.object(liquidity_data, "monitor_adapters", return_value={"cn_margin_net": [Mock(side_effect=AssertionError("old source"))]}), \
             patch("scripts.shared_market_data.liquidity_adapters", return_value={"cn_margin_net": [lambda: ([{"date": "2026-11-04", "value": 12}], "Tushare margin", "https://tushare.pro/")]}) as adapter:
            result = liquidity_data.liquidity_snapshot(directory, force=True, today=date(2026, 11, 5))
            adapter.assert_called_once()
            self.assertEqual(result["provider"], "tushare")
            card = next(c for c in result["fundingMonitor"]["cards"] if c["id"] == "cn_margin_net")
            self.assertEqual(card["value"], 12)

    def test_margin_ratio_uses_shared_service_and_rejects_old_cache_on_failure(self):
        api = self.api([{"trade_date": "20261104", "complete": True, "financing_ratio_pct": 2.5},
                        {"trade_date": "20261105", "complete": False, "financing_ratio_pct": None}], "margin+daily_info")
        points, source, url = liquidity_adapters(date(2026, 11, 5), api)["cn_margin_ratio"][0]()
        self.assertEqual(points, [{"date": "2026-11-04", "value": 2.5}])
        self.assertEqual(api.query.call_args.args, ("get_market_margin_ratio",))
        self.assertTrue(source.startswith("Tushare "))
        with TemporaryDirectory() as directory:
            old = lambda: ([{"date": "2026-11-04", "value": 3}], "东财 · 沪深融资统计", "https://example.org")
            load_series("cn_margin_ratio", [old], Path(directory), today=date(2026, 11, 5))
            result = load_series("cn_margin_ratio", [Mock(side_effect=RuntimeError("offline"))], Path(directory),
                                 today=date(2026, 11, 5), expected_source="Tushare ")
            self.assertEqual(result["status"], "missing")
            self.assertEqual(result["points"], [])
