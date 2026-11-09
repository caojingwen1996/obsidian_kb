from datetime import datetime
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import urlopen

from scripts.dividend_signal_query import (DividendSignalQuery, INDEX_NAME, SHANGHAI,
    parse_marketscreener_quotes, save_snapshot)
from scripts.local_proxy import create_server
from tests.dividend_fixture import seed_dividend_vault


def html_page(values=("3,840.64", "3,834.78"), dates=("2026-10-30", "2026-11-02"), name=INDEX_NAME):
    # Minimal synthetic markup, based on the public dated Last table; no live quote is a daily close.
    return f'<h1>Quotes {name}</h1><div>Live 9999.99</div><table><tr><th></th>' + ''.join(
        f'<th>{day}</th>' for day in dates) + '</tr><tr><td>Last</td>' + ''.join(
        f'<td>{value}</td>' for value in values) + '</tr><tr><td>Change</td><td>1%</td><td>2%</td></tr></table>'


class DividendQueryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dashboard, self.directory = seed_dividend_vault(self.tmp.name)
        self.fetcher = Mock(return_value=html_page())
        self.query = DividendSignalQuery(self.dashboard.parent, Mock(return_value={
            "schemaVersion": 1, "indexHistory": [], "payload": {"records": []}}), self.fetcher)

    def test_parser_uses_dates_and_last_not_live_or_percentages(self):
        data = parse_marketscreener_quotes(html_page(), datetime(2026, 11, 4, tzinfo=SHANGHAI))
        self.assertEqual(data, [{"date": "2026-10-30", "close": 3840.64}, {"date": "2026-11-02", "close": 3834.78}])

    def test_invalid_identity_blocked_page_dates_values_and_duplicates(self):
        for page in ["<h1>Access Denied</h1>", html_page(name="ETF 515450"),
                     html_page(dates=("2026-10-31", "2026-11-02")),
                     html_page(dates=("2026-10-30", "2099-11-02")),
                     html_page(values=("NaN", "1")), html_page(values=("0", "1")),
                     html_page(dates=("2026-10-30", "2026-10-30"))]:
            with self.subTest(page=page), self.assertRaises(ValueError):
                parse_marketscreener_quotes(page, datetime(2026, 11, 4, tzinfo=SHANGHAI))

    def test_intraday_is_excluded(self):
        data = parse_marketscreener_quotes(html_page(dates=("2026-11-03", "2026-11-04")),
                                          datetime(2026, 11, 4, 10, tzinfo=SHANGHAI))
        self.assertEqual(len(data), 1)

    def test_index_cache_and_persistence(self):
        result = self.query.query("SPCLLHCP")
        self.assertEqual(result["instrumentId"], "SPCLLHCP")
        self.assertEqual(result["sourceStatus"]["status"], "updated")
        self.assertEqual(result["lastPoint"]["close"], 3834.78)
        self.assertIsNone(result["valuation"])
        self.assertEqual(json.loads(self.query.path.read_text(encoding="utf-8")), result)
        result["daily"].clear()
        self.assertEqual(len(self.query.query("SPCLLHCP")["daily"]), 2)
        self.fetcher.assert_called_once()

    def test_failure_keeps_disk_and_original_dates_and_retries_after_ttl(self):
        result = self.query.query("SPCLLHCP")
        before = self.query.path.read_bytes()
        self.query.expires = 0
        self.fetcher.side_effect = RuntimeError("MarketScreener HTTP 403")
        failed = self.query.query("SPCLLHCP")
        self.assertEqual(failed["sourceStatus"]["status"], "cached")
        self.assertEqual(failed["fetchedAt"], result["fetchedAt"])
        self.assertEqual(failed["lastPoint"], result["lastPoint"])
        self.assertIn("403", failed["sourceStatus"]["error"])
        self.assertEqual(self.query.path.read_bytes(), before)
        self.query.query("SPCLLHCP")
        self.assertEqual(self.fetcher.call_count, 2)

    def test_missing_no_fabricated_data_and_wrong_code_never_fetches(self):
        self.fetcher.side_effect = TimeoutError("timeout")
        result = self.query.query("SPCLLHCP")
        self.assertEqual(result["sourceStatus"]["status"], "missing")
        self.assertEqual(result["daily"], [])
        self.assertFalse(self.query.path.exists())
        with self.assertRaises(ValueError):
            self.query.query("https://example.com")
        self.fetcher.assert_called_once()

    def test_browser_history_quality_survives_refresh_and_failure(self):
        original = self.query.query("SPCLLHCP")
        original.update(historyCoverage="partial-history",
                        collection={"method": "browser-dom"},
                        dataQuality={"status": "incomplete", "quarantinedCount": 1})
        save_snapshot(self.query.path, original)
        self.query.expires = 0
        refreshed = self.query.query("SPCLLHCP")
        self.assertEqual(refreshed["historyCoverage"], "partial-history")
        before = self.query.path.read_bytes()
        self.query.expires = 0
        self.fetcher.side_effect = RuntimeError("MarketScreener HTTP 403")
        cached = self.query.query("SPCLLHCP")
        self.assertEqual(cached["daily"], original["daily"])
        self.assertEqual(cached["dataQuality"], original["dataQuality"])
        self.assertEqual(cached["collection"], original["collection"])
        self.assertEqual(cached["historyCoverage"], "partial-history")
        self.assertEqual(cached["sourceStatus"]["status"], "cached")
        self.assertEqual(self.query.path.read_bytes(), before)

    def test_wrong_cache_identity_is_not_read_as_sp(self):
        self.query.path.parent.mkdir(parents=True)
        self.query.path.write_text('{"schemaVersion":1,"instrumentId":"000922"}', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "身份"):
            self.query.query("SPCLLHCP")
        self.fetcher.assert_not_called()

    def test_atomic_write_failure_preserves_previous(self):
        self.query.query("SPCLLHCP")
        before = self.query.path.read_bytes()
        with patch("scripts.dividend_signal_query.os.replace", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                save_snapshot(self.query.path, {"changed": True})
        self.assertEqual(self.query.path.read_bytes(), before)
        self.assertFalse(list(self.query.path.parent.glob("*.tmp")))

    def test_http_contract_validates_before_network_and_keeps_csi_payload(self):
        server = create_server(port=0, dashboard_path=self.dashboard, dividend_quote_fetcher=self.fetcher)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}/api/dividend-signal"
        try:
            for query in ["", "?code=bad", "?code=", "?code=000922&code=SPCLLHCP", "?code=SPCLLHCP&url=bad"]:
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + query)
                self.assertEqual(error.exception.code, 400)
            self.fetcher.assert_not_called()
            with urlopen(base + "?code=000922") as response:
                csi = json.load(response)
            self.assertEqual(csi["instrumentId"], "000922")
            self.assertIn("payload", csi)
            self.fetcher.assert_not_called()
            with urlopen(base + "?code=SPCLLHCP") as response:
                sp = json.load(response)
            self.assertEqual(sp["instrumentId"], "SPCLLHCP")
            self.assertEqual(sp["source"], "MarketScreener")
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=3)
