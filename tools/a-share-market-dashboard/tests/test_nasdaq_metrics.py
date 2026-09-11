import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from local_proxy import nasdaq100_daily_metrics, fetch_nasdaq100_snapshot, UpstreamError


class NasdaqMetricsTests(unittest.TestCase):
    def payload(self):
        start = datetime(2025, 1, 1, 16, tzinfo=timezone.utc)
        end = datetime(2026, 9, 10, 16, tzinfo=timezone.utc)
        days = [start + timedelta(days=i) for i in range((end-start).days+1)]
        days = [d for d in days if d.weekday() < 5]
        return {"chart": {"result": [{
            "meta": {"dataGranularity": "1d", "gmtoffset": -14400,
                     "regularMarketTime": end.timestamp(), "regularMarketPrice": 110},
            "timestamp": [d.timestamp() for d in days],
            "indicators": {"quote": [{"close": [100] * len(days)}]},
        }]}}

    def test_calendar_returns_and_current_session_counted_once(self):
        result = nasdaq100_daily_metrics(self.payload(), 110)
        for key in ("dayChangePercent", "weekChangePercent", "monthChangePercent"):
            self.assertEqual(result[key], 10)
        self.assertEqual(result["ma200"], 100.05)
        self.assertEqual(result["yearDrawdownPercent"], 0)
        self.assertEqual(result["marketDate"], "2026-09-10")

    def test_short_history_leaves_ma_and_year_unavailable(self):
        payload = self.payload()
        row = payload["chart"]["result"][0]
        row["timestamp"] = row["timestamp"][-2:]
        row["indicators"]["quote"][0]["close"] = [120, 110]
        result = nasdaq100_daily_metrics(payload, 110)
        self.assertIsNone(result["ma200"])
        self.assertIsNone(result["yearDrawdownPercent"])
        self.assertAlmostEqual(result["dayChangePercent"], -8.33)

    def test_quarterly_bars_are_not_daily(self):
        payload = self.payload()
        payload["chart"]["result"][0]["meta"]["dataGranularity"] = "3mo"
        with self.assertRaises(ValueError):
            nasdaq100_daily_metrics(payload, 110)

    def test_daily_failure_preserves_quote_and_missing_valuation(self):
        def fetch(url, source):
            if "range=2y" in url:
                raise UpstreamError(source)
            return self.payload()
        result = fetch_nasdaq100_snapshot(fetch)["data"]
        self.assertEqual(result["currentPoint"], 110)
        self.assertIsNone(result["ma200"])
        self.assertIsNone(result["peTtm"])
        self.assertIn("失败", result["dailyMetricsNote"])
