from pathlib import Path
import json
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import tushare_client as tc
from tushare_client import TushareClient, TushareClientError, RowsFrame, validate_params
from tushare_market_data import MarketData, market_tools
import mcp_server


class FakePro:
    def __init__(self, responder):
        self.responder = responder
        self.calls = []

    def __getattr__(self, method):
        def call(**params):
            self.calls.append((method, params))
            return RowsFrame(self.responder(method, params))
        return call


class MarketTests(unittest.TestCase):
    def test_southbound_units_sign_missing_and_zero(self):
        raw = [
            {"trade_date": "20261102", "buy_amount": 295.52, "sell_amount": 256.44},
            {"trade_date": "20261103", "buy_amount": 10, "sell_amount": 12},
            {"trade_date": "20261104", "buy_amount": 0, "sell_amount": 0},
            {"trade_date": "20261105", "buy_amount": None, "sell_amount": 3},
            {"trade_date": "20261106", "buy_amount": -2, "sell_amount": 3},
        ]
        service = self.service(lambda *_: raw)
        result = service.query("get_southbound_flow", start_date="2026-11-02", end_date="2026-11-06")
        self.assertEqual([r["net_buy_yi"] for r in result["rows"]], [39.08, -2, 0, None, None])
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["currency"], "provider_unspecified")
        self.assertEqual(result["units"]["buy_volume"], "ten_thousand_transactions")
        self.assertEqual(self.pro.calls[0][0], "ggt_daily")
        with self.assertRaises(TushareClientError):
            service.query("get_southbound_flow", ts_code="000001.SZ", start_date="2026-11-02", end_date="2026-11-06")

    def test_southbound_history_chunks_and_mcp_uses_same_implementation(self):
        service = self.service(lambda method, p: [{"trade_date": p["end_date"], "buy_amount": 1, "sell_amount": 3}])
        result = service.query("get_southbound_flow", start_date="2024-01-01", end_date="2026-11-06", use_cache=False)
        self.assertEqual(len(self.pro.calls), 3)
        self.assertEqual(result["row_count"], 3)
        self.assertEqual(result["latest"]["net_buy_yi"], -2)
        self.assertIn("get_southbound_flow", [t["name"] for t in market_tools()])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = patch.object(tc, "CACHE_DIR", Path(self.temp.name))
        self.cache.start()
        self.addCleanup(self.cache.stop)

    def service(self, responder):
        self.pro = FakePro(responder)
        return MarketData(TushareClient(pro=self.pro, retries=0, rate_limiter=type("Limiter", (), {"wait": lambda self: None})()))

    def test_new_datasets_normalize_codes_without_stock_inference(self):
        for dataset, code in [("fund_daily", "159941.sz"), ("fund_adj", "515450.sh"), ("index_daily", "000922.csi"), ("index_dailybasic", "000300.sh"), ("index_global", "spx")]:
            with self.subTest(dataset=dataset):
                self.assertEqual(validate_params(dataset, {"ts_code": code})["ts_code"], code.upper())
        for dataset, code in [("fund_daily", "159941"), ("index_daily", "000001"), ("index_global", "NDX.GI")]:
            with self.assertRaises(TushareClientError):
                validate_params(dataset, {"ts_code": code})

    def test_invalid_calendar_dates_and_reversed_range_fail_before_network(self):
        for start, end in [("2026-02-30", "2026-03-01"), ("2026-11-05", "2026-11-01"), ("", "2026-11-05")]:
            service = self.service(lambda *_: self.fail("must not query"))
            with self.assertRaises(TushareClientError):
                service.query("get_shibor", start_date=start, end_date=end)

    def test_history_splits_full_span_and_sorts_deduplicates(self):
        def respond(method, p):
            code = p["ts_code"]
            return [{"ts_code": code, "trade_date": p["end_date"], "close": 2},
                    {"ts_code": code, "trade_date": p["start_date"], "close": 1},
                    {"ts_code": code, "trade_date": p["start_date"], "close": 1}]
        service = self.service(respond)
        result = service.query("get_index_daily", ts_code="000922.CSI", start_date="2024-01-01", end_date="2026-01-05")
        self.assertEqual(len(self.pro.calls), 3)
        self.assertEqual(self.pro.calls[1][1]["start_date"], "20250101")
        self.assertEqual(result["observed_start"], "2024-01-01")
        self.assertEqual(result["observed_end"], "2026-01-05")
        self.assertEqual(result["row_count"], 6)

    def test_identity_mismatch_and_conflicting_duplicate_rejected(self):
        cases = [
            [{"ts_code": "000300.SH", "trade_date": "20261102", "close": 1}],
            [{"ts_code": "000922.CSI", "trade_date": "20261102", "close": n} for n in [1, 2]],
        ]
        for rows in cases:
            service = self.service(lambda *_: rows)
            with self.assertRaises(TushareClientError):
                service.query("get_index_daily", ts_code="000922.CSI", start_date="2026-11-01", end_date="2026-11-05")

    def test_range_filters_extra_provider_dates(self):
        service = self.service(lambda *_: [{"date": "20261031", "on": 1}, {"date": "20261102", "on": 2}])
        result = service.query("get_shibor", start_date="2026-11-01", end_date="2026-11-05")
        self.assertEqual(result["rows"], [{"date": "2026-11-02", "on": 2}])

    def test_history_fields_keep_identity_and_reject_unknown(self):
        service = self.service(lambda *_: [])
        service.client.history("fund_adj", "20260101", "20260102", ts_code="159941.SZ", fields=["adj_factor"])
        self.assertEqual(set(self.pro.calls[0][1]["fields"].split(",")), {"ts_code", "trade_date", "adj_factor"})
        with self.assertRaises(TushareClientError):
            service.client.history("fund_adj", "20260101", "20260102", ts_code="159941.SZ", fields="unknown")
        service.client.history("fund_adj", "20260101", "20260102", ts_code="159941.SZ", fields=None, use_cache=False)
        self.assertIn("adj_factor", self.pro.calls[-1][1]["fields"])

    def test_partial_failure_does_not_return_shortened_history(self):
        def respond(method, p):
            if p["start_date"] > "20241231":
                raise OSError("network failed")
            return []
        service = self.service(respond)
        with self.assertRaises(TushareClientError):
            service.query("get_shibor", start_date="2024-01-01", end_date="2026-01-05")

    def fund_response(self, method, params):
        if method == "fund_adj":
            return [{"ts_code": params["ts_code"], "trade_date": "20261102", "adj_factor": 1},
                    {"ts_code": params["ts_code"], "trade_date": "20261103", "adj_factor": 2}]
        return [{"ts_code": params["ts_code"], "trade_date": day, "open": close, "high": close+1,
                 "low": close-1, "close": close, "pre_close": 99, "change": 99, "pct_chg": 99,
                 "vol": 100, "amount": 200} for day, close in [("20261103", 6), ("20261102", 10)]]

    def test_qfq_uses_end_of_requested_range_before_limit(self):
        service = self.service(self.fund_response)
        result = service.query("get_fund_daily", ts_code="159941.SZ", start_date="20261101", end_date="20261105", adjustment="qfq", limit=1)
        self.assertEqual(result["anchor_date"], "2026-11-03")
        self.assertEqual(result["anchor_factor"], 2)
        self.assertEqual(result["rows"][0]["close"], 6)
        self.assertEqual(result["rows"][0]["pre_close"], 5)
        self.assertAlmostEqual(result["rows"][0]["pct_chg"], 20)
        self.assertEqual(result["rows"][0]["raw"]["pct_chg"], 99)
        self.assertEqual(result["total_row_count"], 2)
        self.assertTrue(result["truncated"])

    def test_hfq_and_unadjusted_prices_preserve_volume_and_amount(self):
        service = self.service(self.fund_response)
        result = service.query("get_fund_daily", ts_code="515450.SH", start_date="20261101", end_date="20261105", adjustment="hfq")
        self.assertEqual([r["close"] for r in result["rows"]], [10, 12])
        self.assertIsNone(result["rows"][0]["pre_close"])
        self.assertEqual(result["rows"][1]["vol"], 100)
        self.assertEqual(result["rows"][1]["amount"], 200)
        before = len(self.pro.calls)
        service.query("get_fund_daily", ts_code="515450.SH", start_date="20261101", end_date="20261105", use_cache=False)
        self.assertEqual(len(self.pro.calls)-before, 1)

    def test_missing_or_zero_factor_fails_without_silent_fill(self):
        for bad in [None, 0, -1, float("inf")]:
            def respond(method, p):
                rows = self.fund_response(method, p)
                if method == "fund_adj":
                    rows[0]["adj_factor"] = bad
                return rows
            service = self.service(respond)
            with self.assertRaises(TushareClientError):
                service.query("get_fund_daily", ts_code="159941.SZ", start_date="20261101", end_date="20261105", adjustment="qfq", use_cache=False)

    def test_empty_is_explicit_and_has_no_latest_or_fake_zero(self):
        service = self.service(lambda *_: [])
        result = service.query("get_fund_daily", ts_code="159941.SZ", start_date="20261101", end_date="20261105", adjustment="qfq")
        self.assertEqual(result["status"], "empty")
        self.assertEqual(result["rows"], [])
        self.assertIsNone(result["latest"])
        self.assertEqual(len(self.pro.calls), 1)

    def test_market_turnover_requires_both_markets_and_keeps_yi_units(self):
        def respond(method, p):
            rows = [{"ts_code": p["ts_code"], "trade_date": "20261102", "amount": 100}]
            if p["ts_code"] == "SH_MARKET":
                rows.append({"ts_code": p["ts_code"], "trade_date": "20261103", "amount": 50})
            return rows
        result = self.service(respond).query("get_market_turnover", start_date="20261101", end_date="20261105")
        self.assertEqual(result["rows"][0]["turnover_yi"], 200)
        self.assertIsNone(result["rows"][1]["turnover_yi"])
        self.assertEqual(result["rows"][1]["missing_markets"], ["SZ_MARKET"])
        self.assertEqual(result["status"], "partial")

    def test_margin_excludes_bse_and_does_not_mix_dates_or_nulls(self):
        rows = [{"exchange_id": e, "trade_date": "20261102", "rzye": n*1e8, "rzmre": n*1e8, "rzche": 1e8}
                for e, n in [("SSE", 2), ("SZSE", 3), ("BSE", 100)]]
        rows += [{"exchange_id": "SSE", "trade_date": "20261103", "rzye": None, "rzmre": 1, "rzche": 0}]
        result = self.service(lambda *_: rows).query("get_market_margin_history", start_date="20261101", end_date="20261105")
        self.assertEqual(result["rows"][0]["financing_balance_yi"], 5)
        self.assertEqual(result["rows"][0]["financing_net_buy_yi"], 3)
        self.assertIsNone(result["rows"][1]["financing_balance_yi"])
        self.assertFalse(result["rows"][1]["complete"])

    def test_treasury_spread_uses_same_row_and_retains_missing(self):
        rows = [{"date": "20261102", "y10": 4.5, "y2": 4}, {"date": "20261103", "y10": 4.6, "y2": None}]
        result = self.service(lambda *_: rows).query("get_us_treasury_curve", start_date="20261101", end_date="20261105")
        self.assertEqual(result["rows"][0]["spread_10y_2y"], .5)
        self.assertIsNone(result["rows"][1]["spread_10y_2y"])

    def ratio_response(self, method, params):
        if method == "margin":
            return [{"exchange_id": code, "trade_date": "20261102", "rzye": value}
                    for code, value in [("SSE", 2e8), ("SZSE", 3e8), ("BSE", 99e8)]]
        return [{"ts_code": params["ts_code"], "trade_date": "20261102", "float_mv": 100}]

    def test_ratio_pairs_markets_and_converts_yuan_to_yi(self):
        result = self.service(self.ratio_response).query("get_market_margin_ratio", start_date="20261101", end_date="20261105")
        row = result["latest"]
        self.assertEqual(row["financing_balance_yi"], 5)
        self.assertEqual(row["float_market_cap_yi"], 200)
        self.assertEqual(row["financing_ratio_pct"], 2.5)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(self.pro.calls), 3)

    def test_ratio_missing_invalid_and_mismatched_dates_are_not_filled(self):
        for value in [None, 0, -1, float("inf")]:
            def respond(method, params):
                rows = self.ratio_response(method, params)
                if params.get("ts_code") == "SZ_MARKET":
                    rows[0]["float_mv"] = value
                return rows
            result = self.service(respond).query("get_market_margin_ratio", start_date="20261101", end_date="20261105", use_cache=False)
            self.assertEqual(result["status"], "partial")
            self.assertIsNone(result["latest"]["financing_ratio_pct"])
            self.assertEqual(result["latest"]["missing_inputs"], ["SZ_MARKET"])
        def respond(method, params):
            rows = self.ratio_response(method, params)
            if params.get("ts_code") == "SZ_MARKET":
                rows[0]["trade_date"] = "20261103"
            return rows
        result = self.service(respond).query("get_market_margin_ratio", start_date="20261101", end_date="20261105", use_cache=False)
        self.assertEqual(len(result["rows"]), 2)
        self.assertTrue(all(r["financing_ratio_pct"] is None for r in result["rows"]))

    def test_ratio_conflicts_rejected_and_zero_financing_is_valid(self):
        def conflict(method, params):
            rows = self.ratio_response(method, params)
            if method == "margin":
                rows.append({**rows[0], "rzye": 0})
            return rows
        with self.assertRaises(TushareClientError):
            self.service(conflict).query("get_market_margin_ratio", start_date="20261101", end_date="20261105")
        def zero(method, params):
            rows = self.ratio_response(method, params)
            if method == "margin":
                for row in rows:
                    row["rzye"] = 0
            return rows
        result = self.service(zero).query("get_market_margin_ratio", start_date="20261101", end_date="20261105", use_cache=False)
        self.assertEqual(result["latest"]["financing_ratio_pct"], 0)

    def test_fx_does_not_substitute_bid_with_ask(self):
        service = self.service(lambda *_: [{"ts_code": "USDJPY.FXCM", "trade_date": "20261102", "bid_close": None, "ask_close": 150}])
        result = service.query("get_fx_daily", start_date="20261101", end_date="20261105")
        self.assertIsNone(result["rows"][0]["bid_close"])
        self.assertEqual(result["rows"][0]["ask_close"], 150)

    def test_cache_reused_and_bypass_queries_again(self):
        service = self.service(lambda *_: [{"date": "20261102", "on": 1}])
        args = dict(start_date="20261101", end_date="20261105")
        service.query("get_shibor", **args)
        service.query("get_shibor", **args)
        self.assertEqual(len(self.pro.calls), 1)
        service.query("get_shibor", use_cache=False, **args)
        self.assertEqual(len(self.pro.calls), 2)

    def test_permission_error_not_retried_or_leaked(self):
        def fail(*_):
            raise RuntimeError("permission denied fake-secret")
        service = self.service(fail)
        service.client.retries = 2
        with self.assertRaises(TushareClientError) as raised:
            service.query("get_shibor", start_date="20261101", end_date="20261105")
        self.assertEqual(raised.exception.source, "tushare-permission")
        self.assertNotIn("fake-secret", str(raised.exception.details))
        self.assertEqual(len(self.pro.calls), 1)

    def test_mcp_all_new_tools_dispatch_same_service(self):
        service = self.service(lambda *_: [])
        for tool in market_tools():
            args = dict(start_date="20261101", end_date="20261105")
            if "ts_code" in tool["inputSchema"]["required"]:
                args["ts_code"] = "SPX" if tool["name"] == "get_global_index_daily" else "159941.SZ" if "fund" in tool["name"] else "000922.CSI"
            with patch.object(mcp_server, "TushareClient", return_value=service.client):
                result = mcp_server.handle({"id": 1, "method": "tools/call", "params": {"name": tool["name"], "arguments": args}})
            self.assertFalse(result["result"]["isError"], result)
            self.assertEqual(result["result"]["structuredContent"]["status"], "empty")

    def test_mcp_invalid_arguments_and_unexpected_error_are_safe(self):
        request = {"id": 1, "method": "tools/call", "params": {"name": "get_shibor", "arguments": {"start_date": "20261101", "end_date": "20261105", "extra": 1}}}
        self.assertTrue(mcp_server.handle(request)["result"]["isError"])
        del request["params"]["arguments"]["extra"]
        with patch.object(mcp_server.MarketData, "query", side_effect=RuntimeError("fake-secret")):
            result = mcp_server.handle(request)
        self.assertNotIn("fake-secret", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
