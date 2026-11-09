from datetime import datetime
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock
from urllib.parse import parse_qs, urlparse

from scripts.dividend_signal_query import DividendSignalQuery, SHANGHAI, resolve_code
from scripts.dividend_etf_query import (DividendEtfQuery, DISTRIBUTION_URL,
    parse_distributions, parse_prices, trailing_distribution_yield)


NOW = datetime(2026, 11, 4, 11, tzinfo=SHANGHAI)
DIVIDENDS = '''<title>515450基金分红</title><table>
<tr><th>年份</th><th>权益登记日</th><th>除息日</th><th>每10份分红</th><th>分红发放日</th></tr>
<tr><td>2026年</td><td>2026-09-08</td><td>2026-09-09</td><td>每10份派现金0.1500元</td><td>2026-09-14</td></tr>
</table>'''


def prices(rows, key="qfqday", code="515450"):
    return {"data": {"sh515450": {key: [[day, str(close), str(close)] for day, close in rows],
                                 "qt": {"sh515450": ["1", "红利低波50ETF南方", code]}}}}


class EtfQueryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.fail_price = self.fail_dividend = False
        self.scale = 1
        self.overlap_conflict = False
        self.urls = []

        def fetch(url):
            self.urls.append(url)
            if url == DISTRIBUTION_URL:
                if self.fail_dividend:
                    raise OSError("distribution unavailable")
                return DIVIDENDS
            if self.fail_price:
                raise OSError("price unavailable")
            parts = parse_qs(urlparse(url).query, keep_blank_values=True)["param"][0].split(",")
            if parts[-1] == "":
                return json.dumps(prices([("2026-11-03", 1.491)], "day"))
            if parts[3]:
                return json.dumps(prices([("2020-02-26", .6 * self.scale),
                                          ("2024-03-13", (1.1 if self.overlap_conflict else 1) * self.scale)]))
            return json.dumps(prices([("2024-03-13", self.scale), ("2026-11-03", 1.491)]))

        self.fetcher = Mock(side_effect=fetch)
        def price_loader(adjustment, now):
            if self.fail_price or self.overlap_conflict:
                raise ValueError("invalid price history")
            rows = [("2026-11-03", 1.491)] if adjustment == "none" else [
                ("2020-02-26", .6 * self.scale), ("2024-03-13", self.scale), ("2026-11-03", 1.491)]
            return {day: {"date": day, "close": close} for day, close in rows}
        self.price_loader = price_loader
        self.distribution_loader = lambda now: parse_distributions(self.fetcher(DISTRIBUTION_URL), now)
        self.query = DividendEtfQuery(self.root, self.fetcher, price_loader, self.distribution_loader)

    def test_real_code_no_longer_resolves_to_index_or_calls_marketscreener(self):
        self.assertEqual(resolve_code("515450"), "515450")
        index_fetch = Mock(side_effect=AssertionError("must not call index source"))
        service = DividendSignalQuery(self.root, Mock(), index_fetch, etf_fetcher=self.fetcher)
        service.etf.price_loader = self.price_loader
        service.etf.distribution_loader = self.distribution_loader
        data = service.query("515450")
        self.assertEqual(data["instrumentId"], "515450")
        self.assertEqual(data["lastPoint"]["close"], 1.491)
        self.assertEqual(data["priceBasis"], "qfq")
        self.assertEqual(len(data["daily"]), 3)
        index_fetch.assert_not_called()

    def test_intraday_future_wrong_identity_and_unadjusted_fallback_rejected(self):
        data = parse_prices(prices([("2026-11-03", 1.491), ("2026-11-04", 1.48)]), "qfq", NOW)
        self.assertEqual(list(data), ["2026-11-03"])
        for payload in [prices([("2099-11-04", 1)]), prices([("2026-11-01", 1)]),
                        prices([("2026-11-03", 1)], code="000922"),
                        prices([("2026-11-03", 1)], key="day")]:
            with self.assertRaises(ValueError):
                parse_prices(payload, "qfq", NOW)

    def test_cash_dividend_units_and_ttm_boundary(self):
        events = parse_distributions(DIVIDENDS, NOW)
        self.assertEqual(events[0]["cashPerShare"], .015)
        events += [{"exDate": "2025-11-03", "cashPerShare": 50},
                   {"exDate": "2025-11-04", "cashPerShare": .03},
                   {"exDate": "2026-11-04", "cashPerShare": 20}]
        value = trailing_distribution_yield(events, {"date": "2026-11-03", "close": 1.5})
        self.assertAlmostEqual(value["dividendYield"], 3)
        self.assertEqual(value["eventCount"], 2)
        self.assertEqual(value["priceBasis"], "unadjusted-close")

    def test_missing_distribution_is_not_zero(self):
        with self.assertRaises(ValueError):
            parse_distributions('<title>515450基金</title>', NOW)
        self.fail_dividend = True
        data = self.query.query()
        self.assertEqual(len(data["daily"]), 3)
        self.assertIsNone(data["valuation"])
        self.assertIn("distributionError", data["sourceStatus"])

    def test_price_failure_preserves_cache_and_date(self):
        original = self.query.query()
        calls = self.fetcher.call_count
        self.query.query()
        self.assertEqual(self.fetcher.call_count, calls)
        self.fail_price = True
        self.query.expires = 0
        failed = self.query.query()
        self.assertEqual(failed["daily"], original["daily"])
        self.assertEqual(failed["fetchedAt"], original["fetchedAt"])
        self.assertEqual(failed["sourceStatus"]["status"], "cached")

    def test_adjustment_change_replaces_old_series_and_conflict_preserves_it(self):
        self.query.query()
        self.scale = .9
        self.query.expires = 0
        updated = self.query.query()
        self.assertEqual(updated["daily"][0]["close"], .54)
        self.overlap_conflict = True
        self.query.expires = 0
        failed = self.query.query()
        self.assertEqual(failed["daily"], updated["daily"])
        self.assertEqual(failed["sourceStatus"]["status"], "cached")
