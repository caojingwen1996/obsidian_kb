from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from scripts import lixinger_data as lx

NOW = datetime(2026, 11, 9, 1, tzinfo=timezone.utc)


def fixture(day="2026-11-06", percentile=.5623):
    return {"code": 1, "data": [{"date": day + "T00:00:00-05:00", "stockCode": ".NDX",
        "pe_ttm.mcw": 30.2, "pe_ttm.y10.mcw.cvpos": percentile}]}


class LixingerTests(TestCase):
    def test_same_basis_percentile_conversion_including_zero(self):
        for value in (0, .5623, 1):
            result = lx.normalize(fixture(percentile=value), "2026-10-10", "2026-11-09")
            self.assertAlmostEqual(result["pePercentile10y"], value * 100)
            self.assertEqual(result["valuationDate"], "2026-11-06")
            self.assertEqual(result["peTtm"], 30.2)

    def test_missing_or_invalid_percentile_does_not_become_zero(self):
        for value in (None, True, 56.23, -1, float("nan")):
            result = lx.normalize(fixture(percentile=value), "2026-10-10", "2026-11-09")
            self.assertIsNone(result["pePercentile10y"])
            self.assertEqual(result["status"], "partial")

    def test_wrong_code_duplicate_outside_dates_and_api_errors_rejected(self):
        wrong = fixture(); wrong["data"][0]["stockCode"] = ".IXIC"
        duplicate = fixture(); duplicate["data"] *= 2
        for payload in (wrong, duplicate, fixture("2026-11-10"), {"code": 0, "message": "secret"}, {"code": 1, "data": []}):
            with self.assertRaises(lx.LixingerError):
                lx.normalize(payload, "2026-10-10", "2026-11-09")

    def test_newest_day_missing_pe_does_not_silently_select_older_day(self):
        payload = fixture(); recent = fixture("2026-11-09")["data"][0]
        recent["pe_ttm.mcw"] = None; payload["data"].append(recent)
        with self.assertRaises(lx.LixingerError):
            lx.normalize(payload, "2026-10-10", "2026-11-09")

    def test_request_cache_stale_fallback_and_secret_redaction(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "cache.json"
            transport = Mock(return_value=fixture())
            args = dict(token="private-token", transport=transport, cache_path=path, now=NOW)
            good = lx.get_nasdaq_valuation("2026-11-09", **args)
            self.assertEqual(transport.call_args.args[0]["metricsList"], list(lx.METRICS))
            self.assertEqual(transport.call_args.args[0]["stockCodes"], [".NDX"])
            self.assertTrue(lx.get_nasdaq_valuation("2026-11-09", **args)["cacheHit"])
            self.assertEqual(transport.call_count, 1)
            transport.side_effect = RuntimeError("private-token")
            bad = lx.get_nasdaq_valuation("2026-11-09", force=True, **args)
            self.assertEqual(bad["status"], "stale")
            self.assertEqual(bad["valuationDate"], good["valuationDate"])
            self.assertNotIn("private-token", json.dumps(bad) + path.read_text())

    def test_missing_token_makes_no_network_request_and_ignores_wind_cache(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "cache.json"
            path.write_text(json.dumps({"peTtm": 99, "valuationSource": "Wind"}))
            transport = Mock()
            result = lx.get_nasdaq_valuation("2026-11-09", token="", transport=transport, cache_path=path, now=NOW)
            self.assertEqual(result["status"], "missing")
            self.assertIsNone(result.get("peTtm"))
            transport.assert_not_called()

    def test_old_observation_is_marked_stale_even_after_successful_fetch(self):
        with TemporaryDirectory() as directory:
            result = lx.get_nasdaq_valuation("2026-11-09", token="test", transport=lambda _: fixture("2026-10-15"),
                cache_path=Path(directory) / "cache.json", now=NOW)
            self.assertEqual(result["status"], "stale")
            self.assertIn("2026-10-15", result["valuationNote"])
