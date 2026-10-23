from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import urlopen

from scripts.local_proxy import create_server, fetch_market_turnover, UpstreamError
from tushare_client import RowsFrame, validate_params, TushareClientError


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

    def test_missing_dependency_has_a_distinct_error(self):
        error = TushareClientError("tushare", "package missing")
        error.__cause__ = ImportError("tushare")
        with patch.object(FakeClient, "call", side_effect=error):
            with self.assertRaises(UpstreamError) as caught:
                fetch_market_turnover(FakeClient({}), self.now())
        self.assertEqual(caught.exception.source, "tushare-dependency")

    def test_missing_token_is_classified_before_calling_provider(self):
        with patch("tushare_client.resolve_token", side_effect=TushareClientError("tushare-token")):
            with self.assertRaises(UpstreamError) as caught:
                fetch_market_turnover(now=self.now())
        self.assertEqual(caught.exception.source, "tushare-token")

    def test_reuses_dashboard_env_without_process_environment(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            dashboard = root / "dashboard"
            dashboard.mkdir()
            (dashboard / ".env").write_text("TUSHARE_TOKEN=test-only-credential\n", encoding="utf-8")
            provider = Mock()
            provider.daily_info.side_effect = lambda **params: RowsFrame([
                {"ts_code": params["ts_code"], "trade_date": "20260903", "amount": 100}
            ])
            pro_api = Mock(return_value=provider)
            with patch.dict(os.environ, {}, clear=True), \
                 patch("scripts.local_proxy.__file__", str(dashboard / "scripts" / "local_proxy.py")), \
                 patch("tushare_client.TUSHARE_DATA_DIR", root / "shared"), \
                 patch("tushare_client.REPO_ROOT", root), \
                 patch.dict("sys.modules", {"tushare": SimpleNamespace(pro_api=pro_api)}), \
                 patch("tushare_client._read_cache", return_value=None), \
                 patch("tushare_client._write_cache"), \
                 patch("scripts.local_proxy.write_proxy_log"):
                data = fetch_market_turnover(now=self.now())
            self.assertEqual(data["points"], [{"date": "2026-09-03", "amount": 200}])
            pro_api.assert_called_once_with("test-only-credential")

    def test_route_explains_failures_logs_source_and_survives_next_request(self):
        server = create_server(port=0)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_address[1]}/api/market-turnover"
        try:
            for source, status, hint in (
                ("tushare-token", 503, "TUSHARE_TOKEN"),
                ("tushare-dependency", 503, "依赖"),
                ("tushare-permission", 503, "daily_info"),
                ("market-turnover-empty", 502, "沪深"),
                ("tushare", 502, "取数失败"),
            ):
                with self.subTest(source=source), \
                     patch("scripts.local_proxy.fetch_market_turnover", side_effect=UpstreamError(source)), \
                     patch("scripts.local_proxy.write_proxy_log") as logger:
                    with self.assertRaises(HTTPError) as caught:
                        urlopen(url, timeout=3)
                    with caught.exception as response:
                        payload = json.load(response)
                        self.assertEqual(response.code, status)
                    self.assertEqual(payload["source"], source)
                    self.assertIn(hint, payload["error"])
                    logger.assert_called_once_with("UPSTREAM_FAIL", route="/api/market-turnover", source=source)
            expected = fetch_market_turnover(FakeClient({code: [
                {"ts_code": code, "trade_date": "20260903", "amount": 100}
            ] for code in ("SH_MARKET", "SZ_MARKET")}), self.now())
            with patch("scripts.local_proxy.fetch_market_turnover", return_value=expected):
                with urlopen(url, timeout=3) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(json.load(response), expected)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)
