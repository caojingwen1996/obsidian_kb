from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from scripts import yahoo_data as yahoo
from scripts.local_proxy import fetch_nasdaq100_snapshot, fetch_stock_quote, UpstreamError

NOW = datetime(2026, 11, 6, 15, tzinfo=timezone.utc)


def stamp(day, hour=14):
    return int(datetime.fromisoformat(day).replace(hour=hour, tzinfo=timezone.utc).timestamp())


def fixture(symbol="^NDX"):
    instrument, currency, zone = yahoo.symbol_identity(symbol)
    return {"chart": {"error": None, "result": [{
        "meta": {"symbol": symbol, "instrumentType": instrument, "currency": currency,
                 "exchangeTimezoneName": zone, "gmtoffset": -18000, "dataGranularity": "1d",
                 "regularMarketTime": NOW.timestamp(), "regularMarketPrice": 120,
                 "chartPreviousClose": 110, "longName": "Fixture instrument",
                 "currentTradingPeriod": {"regular": {"start": stamp("2026-11-06"), "end": stamp("2026-11-06", 21)}}},
        "timestamp": [stamp(d) for d in ["2026-11-04", "2026-11-05", "2026-11-06"]],
        "indicators": {"quote": [{"close": [100, 110, 120]}]},
    }]}}


class YahooTests(TestCase):
    def client(self, symbol="^NDX"):
        raw = fixture(symbol)
        return yahoo.YahooChartClient(lambda url: raw)

    def test_exact_identity_currency_timezone_and_frequency_required(self):
        for field, invalid in [("symbol", "^IXIC"), ("currency", "CNY"), ("instrumentType", "FUTURE"),
                               ("exchangeTimezoneName", "UTC"), ("dataGranularity", "3mo")]:
            data = fixture()
            data["chart"]["result"][0]["meta"][field] = invalid
            with self.subTest(field=field), self.assertRaises(yahoo.YahooDataError):
                yahoo.parse_chart(data, "^NDX", NOW)

    def test_malformed_containers_fail_with_provider_error(self):
        for path, invalid in [(('chart',), []), (('chart', 'result'), [None]),
                              (('chart', 'result', 0, 'indicators'), None),
                              (('chart', 'result', 0, 'indicators', 'quote'), [None]),
                              (('chart', 'result', 0, 'events'), [])]:
            data = fixture()
            target = data
            for key in path[:-1]: target = target[key]
            target[path[-1]] = invalid
            with self.subTest(path=path), self.assertRaises(yahoo.YahooDataError):
                yahoo.parse_chart(data, '^NDX', NOW)

    def test_incomplete_session_excluded_and_after_close_included(self):
        chart = yahoo.parse_chart(fixture(), "^NDX", NOW)
        self.assertEqual(len(yahoo.completed_points(chart, NOW)), 2)
        self.assertEqual(len(yahoo.completed_points(chart, NOW.replace(hour=21, minute=15))), 3)
        data = yahoo.daily_chart_payload(chart, NOW)["chart"]["result"][0]
        self.assertEqual(data["meta"]["regularMarketPrice"], 110)
        self.assertEqual(data["meta"]["regularMarketTime"], stamp("2026-11-05"))
        self.assertEqual(chart["meta"]["regularMarketPrice"], 120)

    def test_null_close_skipped_but_misaligned_arrays_and_false_values_rejected(self):
        data = fixture()
        node = data["chart"]["result"][0]
        node["indicators"]["quote"][0]["close"][0] = None
        self.assertEqual(len(yahoo.parse_chart(data, "^NDX", NOW)["daily"]), 2)
        for bad in (True, 0, float("nan")):
            node["indicators"]["quote"][0]["close"][0] = bad
            with self.assertRaises(yahoo.YahooDataError):
                yahoo.parse_chart(data, "^NDX", NOW)
        node["timestamp"].pop()
        with self.assertRaises(yahoo.YahooDataError):
            yahoo.parse_chart(data, "^NDX", NOW)

    def test_query_uses_explicit_start_and_never_max_resampling(self):
        fetch = Mock(return_value=fixture())
        yahoo.YahooChartClient(fetch).chart("^NDX", start_date="1996-01-01", now=NOW)
        url = fetch.call_args.args[0]
        args = parse_qs(urlparse(url).query)
        self.assertEqual(args["interval"], ["1d"])
        self.assertEqual(args["period1"], ["820454400"])
        self.assertNotIn("range", args)
        self.assertIn("%5ENDX", url)
        with self.assertRaises(yahoo.YahooDataError):
            yahoo.YahooChartClient(fetch).chart("https://arbitrary.example", now=NOW)

    def test_chart_error_and_future_quote_rejected(self):
        data = fixture()
        data["chart"]["error"] = {"code": "Not Found"}
        with self.assertRaises(yahoo.YahooDataError): yahoo.parse_chart(data, "^NDX", NOW)
        data = fixture()
        data["chart"]["result"][0]["meta"]["regularMarketTime"] = NOW.timestamp() + 3600
        with self.assertRaises(yahoo.YahooDataError): yahoo.parse_chart(data, "^NDX", NOW)

    def test_quote_previous_close_is_from_one_day_request(self):
        chart = yahoo.parse_chart(fixture("600000.SS"), "600000.SS", NOW)
        client = Mock(chart=Mock(return_value=chart))
        result = yahoo.stock_quote("1.600000", client, NOW)
        self.assertEqual(client.chart.call_args.kwargs["range"], "1d")
        self.assertEqual(result["data"]["prevClose"], 110)
        self.assertAlmostEqual(result["data"]["changePercent"], (120/110-1)*100)
        self.assertIn("可能延迟", result["proxySource"])

    def test_dividends_are_cash_per_share_and_do_not_invent_pay_date(self):
        data = fixture("515450.SS")
        data["chart"]["result"][0]["events"] = {"dividends": {"event": {"date": stamp("2026-09-09", 1), "amount": .015}}}
        client = yahoo.YahooChartClient(lambda url: data)
        self.assertEqual(yahoo.dividend_events(NOW, client), [{"exDate": "2026-09-09", "cashPerShare": .015, "payDate": None}])
        data["chart"]["result"][0]["events"] = {}
        with self.assertRaises(yahoo.YahooDataError): yahoo.dividend_events(NOW, client)

    def test_liquidity_adapter_only_replaces_non_tushare_keys(self):
        from scripts.shared_market_data import LIQUIDITY_SERIES
        adapters = yahoo.liquidity_adapters(self.client("DX-Y.NYB"), NOW)
        self.assertFalse(set(adapters) & set(LIQUIDITY_SERIES))
        daily, source, _ = adapters["us_DXY_HISTORY"][0]()
        live, _, _ = adapters["us_DXY"][0]()
        self.assertEqual(daily[-1]["date"], "2026-11-05")
        self.assertEqual(live[-1]["date"], "2026-11-06")
        self.assertIn("Yahoo", source)

    def test_risk_failure_preserves_previous_date_and_marks_stale(self):
        def chart(symbol, **kwargs):
            return {**yahoo.parse_chart(fixture(symbol), symbol, NOW), "fetchedAt": "2026-11-06T15:00:00Z"}
        with TemporaryDirectory() as directory:
            client = Mock(chart=Mock(side_effect=chart))
            good = yahoo.risk_readings(client, NOW, directory)
            bad = yahoo.risk_readings(Mock(chart=Mock(side_effect=RuntimeError("offline"))), NOW, directory)
            for key in yahoo.RISK_SYMBOLS:
                self.assertEqual(bad[key]["value"], good[key]["value"])
                self.assertEqual(bad[key]["date"], good[key]["date"])
                self.assertEqual(bad[key]["status"], "stale")
            self.assertEqual(good["pending-capital-1"]["unit"], "元")

    def test_production_nasdaq_uses_yahoo_history_and_keeps_lixinger_valuation_separate(self):
        raw = fixture()
        raw["chart"]["result"][0]["meta"]["regularMarketTime"] = stamp("2026-11-05", 21)
        chart = {**yahoo.parse_chart(raw, "^NDX", NOW), "fetchedAt": "2026-11-06T00:00:00Z"}
        client = Mock(chart=Mock(return_value=chart))
        valuation = Mock(return_value={"status": "ok", "peTtm": 30, "pePercentile10y": 56.2, "valuationDate": "2026-11-04", "valuationNote": "理杏仁 PE · 2026-11-04"})
        with patch("scripts.local_proxy.daily_chart_payload", side_effect=lambda c: yahoo.daily_chart_payload(c, NOW)):
            result = fetch_nasdaq100_snapshot(client=client, valuation_loader=valuation)
        self.assertIn("Yahoo", result["proxySource"])
        self.assertEqual(result["data"]["returnHistory"]["lastDate"], "2026-11-05")
        self.assertEqual(result["data"]["peTtm"], 30)
        self.assertEqual(result["data"]["pePercentile10y"], 56.2)
        self.assertEqual(result["data"]["valuationDate"], "2026-11-04")
        valuation.assert_called_once_with("2026-11-05")

    def test_production_stock_errors_report_yahoo_source(self):
        client = Mock(chart=Mock(side_effect=yahoo.YahooDataError("offline")))
        with self.assertRaises(UpstreamError) as caught:
            fetch_stock_quote("1.600000", client=client)
        self.assertEqual(caught.exception.source, "yahoo-chart")
