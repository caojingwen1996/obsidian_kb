from datetime import datetime, timezone, timedelta
import unittest
from unittest.mock import patch

from scripts.local_proxy import fetch_market_turnover, UpstreamError
from tushare_client import validate_params, TushareClientError


class FakeClient:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def call(self, method, **params):
        self.calls.append((method, params))
        return self.rows.get(params["ts_code"], [])


class MarketTurnoverTests(unittest.TestCase):
    def now(self, hour=10):
        return datetime(2026, 9, 4, hour, 0, tzinfo=timezone(timedelta(hours=8)))

    def test_merges_same_day_full_markets_without_component_double_counting(self):
        client = FakeClient({
            "SH_MARKET": [
                {"ts_code": "SH_MARKET", "trade_date": "20260903", "amount": 8206.03},
                {"ts_code": "SH_A", "trade_date": "20260903", "amount": 6060.03},
                {"ts_code": "SH_STAR", "trade_date": "20260903", "amount": 2144.57},
                {"ts_code": "SH_MARKET", "trade_date": "20260902", "amount": 8000},
            ],
            "SZ_MARKET": [{"ts_code": "SZ_MARKET", "trade_date": "2026-09-03", "amount": 9400.88}],
        })
        data = fetch_market_turnover(client, self.now())
        self.assertEqual(data["points"], [{"date": "2026-09-03", "amount": 17606.91}])
        self.assertEqual(data["incompleteDays"], 1)
        self.assertEqual(data["unit"], "亿元")
        self.assertEqual(client.calls[0][1]["start_date"], "2025-09-04")

    def test_rejects_missing_market_and_invalid_values(self):
        with self.assertRaises(UpstreamError):
            fetch_market_turnover(FakeClient({"SH_MARKET": [{"ts_code": "SH_MARKET", "trade_date": "20260903", "amount": 8206.03}]}), self.now())
        for amount in (None, 0, -1, float("nan"), float("inf")):
            rows = {code: [{"ts_code": code, "trade_date": "20260903", "amount": amount}] for code in ("SH_MARKET", "SZ_MARKET")}
            with self.assertRaises(UpstreamError):
                fetch_market_turnover(FakeClient(rows), self.now())

    def test_excludes_partial_today_and_dates_outside_one_year(self):
        rows = {code: [{"ts_code": code, "trade_date": day, "amount": 100} for day in
                      ("20250903", "20250904", "20260903", "20260904", "20260905", "20260230")]
                for code in ("SH_MARKET", "SZ_MARKET")}
        self.assertEqual([p["date"] for p in fetch_market_turnover(FakeClient(rows), self.now())["points"]], ["2025-09-04", "2026-09-03"])
        self.assertEqual(fetch_market_turnover(FakeClient(rows), self.now(16))["points"][-1], {"date": "2026-09-04", "amount": 200})

    def test_client_validates_market_codes_and_normalizes_dates(self):
        params = validate_params("daily_info", {"ts_code": "SZ_MARKET", "start_date": "2025-09-04"})
        self.assertEqual(params["start_date"], "20250904")
        for code in ("SH_FUND", "SH_A", "SZ_A", "600000.SH"):
            with self.assertRaises(TushareClientError):
                validate_params("daily_info", {"ts_code": code})

    def test_permission_errors_keep_source_identity(self):
        with patch.object(FakeClient, "call", side_effect=TushareClientError("tushare-permission", "no permission")):
            with self.assertRaises(UpstreamError) as caught:
                fetch_market_turnover(FakeClient({}), self.now())
        self.assertEqual(caught.exception.source, "tushare-permission")
