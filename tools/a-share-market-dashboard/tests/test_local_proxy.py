from contextlib import contextmanager
from datetime import date, timedelta
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from scripts.local_proxy import (
    DEFAULT_PORT,
    RouteError,
    UpstreamError,
    build_upstream_url,
    create_server,
    fetch_index_history,
    fetch_market_snapshot,
    fetch_nasdaq100_snapshot,
    fetch_stock_quote,
    fetch_youzhiyouxing_temperature,
    normalize_nasdaq100_chart,
    parse_json_payload,
    parse_youzhiyouxing_temperature,
)


DASHBOARD = Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html"
REPORT_PATH = "/sources/automations/支柱产业/电网/2026-07-17-十五五电网投资与电网行业完整分析报告.html"
WEBPAGE_PATH = "/sources/webpages/2026-07-15-航天电子卖方评级与近期催化剂检索记录.md"
PAPER_PATH = "/sources/papers/航天电子机构研报-2026-07-15/2025年年度报告.pdf"
WORKBENCH_PATH = "/workbench/index.md"


def read_text(url):
    with urlopen(url, timeout=3) as response:
        return response.read().decode("utf-8")


def read_json(url):
    return json.loads(read_text(url))


@contextmanager
def running_server(fetcher):
    with TemporaryDirectory() as temporary_directory:
        portfolio_path = Path(temporary_directory) / "portfolio.json"
        server = create_server(
            port=0,
            fetcher=fetcher,
            dashboard_path=DASHBOARD,
            portfolio_path=portfolio_path,
        )
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        try:
            yield f"http://{host}:{port}"
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)


class RouteTests(unittest.TestCase):
    def test_dashboard_uses_a_fixed_default_port(self):
        self.assertEqual(DEFAULT_PORT, 49888)

    def test_builds_only_allowlisted_index_history_url(self):
        url = build_upstream_url(
            "/api/eastmoney-kline",
            {"secid": ["1.000300"], "limit": ["3000"]},
        )

        parsed = urlparse(url)
        self.assertEqual(parsed.hostname, "push2his.eastmoney.com")
        self.assertEqual(parse_qs(parsed.query)["secid"], ["1.000300"])
        self.assertEqual(parse_qs(parsed.query)["lmt"], ["3000"])

    def test_rejects_unknown_route_and_invalid_index(self):
        with self.assertRaises(RouteError):
            build_upstream_url("/api/unknown", {})
        with self.assertRaises(RouteError):
            build_upstream_url(
                "/api/eastmoney-kline",
                {"secid": ["https://example.com"], "limit": ["3000"]},
            )

    def test_builds_stock_quote_url_for_valid_a_share_secids(self):
        for secid in (
            "0.300001",
            "1.600000",
            "1.688102",
        ):
            with self.subTest(secid=secid):
                url = build_upstream_url(
                    "/api/stock-quote",
                    {"secid": [secid]},
                )

                parsed = urlparse(url)
                query = parse_qs(parsed.query)
                self.assertEqual(parsed.hostname, "push2.eastmoney.com")
                self.assertEqual(parsed.path, "/api/qt/stock/get")
                self.assertEqual(query["secid"], [secid])
                self.assertEqual(query["fields"], ["f43,f57,f58,f60,f86,f170"])

        for bad_secid in ("https://example.com", "2.600000", "1.60000", "sh600000"):
            with self.subTest(secid=bad_secid):
                with self.assertRaises(RouteError):
                    build_upstream_url(
                        "/api/stock-quote",
                        {"secid": [bad_secid]},
                    )


class PayloadTests(unittest.TestCase):
    def test_accepts_json_and_unwraps_jsonp(self):
        self.assertEqual(parse_json_payload(b'{"ok": true}'), {"ok": True})
        self.assertEqual(parse_json_payload(b'callback123({"ok": true});'), {"ok": True})

    def test_decodes_gb18030_market_names(self):
        body = '{"name":"测试股份"}'.encode("gb18030")
        self.assertEqual(parse_json_payload(body, encoding="gb18030"), {"name": "测试股份"})

    def test_parses_youzhiyouxing_market_temperature_page(self):
        page = """
        <main>
          温度更新时间：2026年7月22日 20:00
          全市场温度 使用说明 38° 中估 温度下降
          当前市场处于 低估 40% 中估 38% 高估 22%
        </main>
        """

        payload = parse_youzhiyouxing_temperature(page)

        self.assertEqual(payload["proxySource"], "有知有行公开温度计")
        self.assertEqual(payload["data"]["temperature"], 38)
        self.assertEqual(payload["data"]["band"], "中估")
        self.assertEqual(payload["data"]["trend"], "温度下降")
        self.assertEqual(payload["data"]["updatedText"], "2026年7月22日 20:00")
        self.assertEqual(payload["data"]["probabilities"], {"low": 40.0, "mid": 38.0, "high": 22.0})

    def test_fetches_youzhiyouxing_market_temperature_through_injected_fetcher(self):
        def fake_fetch(url, source):
            self.assertEqual(source, "youzhiyouxing-temperature")
            self.assertEqual(url, "https://youzhiyouxing.cn/data")
            return "温度更新时间：2026年7月22日 20:00 全市场温度 38° 中估 温度下降 低估 40% 中估 38% 高估 22%"

        payload = fetch_youzhiyouxing_temperature(fake_fetch)

        self.assertEqual(payload["data"]["temperature"], 38)

    def test_normalizes_nasdaq100_chart_current_point_and_drawdown(self):
        payload = normalize_nasdaq100_chart({
            "chart": {
                "result": [{
                    "meta": {
                        "regularMarketPrice": 18000.0,
                        "regularMarketTime": 1784601060,
                    },
                    "indicators": {
                        "quote": [{
                            "close": [12000.0, None, 20000.0, 18000.0],
                        }],
                    },
                }],
            },
        })

        self.assertEqual(payload["data"]["currentPoint"], 18000.0)
        self.assertEqual(payload["data"]["highPoint"], 20000.0)
        self.assertEqual(payload["data"]["drawdownPercent"], -10.0)
        self.assertEqual(payload["proxySource"], "Yahoo Finance")

    def test_fetches_nasdaq100_snapshot_through_fixed_yahoo_url(self):
        def fake_fetch(url, source):
            self.assertEqual(source, "nasdaq100")
            self.assertEqual(url, "https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?range=max&interval=1d")
            return {
                "chart": {
                    "result": [{
                        "meta": {"regularMarketPrice": 95.0},
                        "indicators": {"quote": [{"close": [80.0, 100.0, 90.0]}]},
                    }],
                },
            }

        payload = fetch_nasdaq100_snapshot(fake_fetch)

        self.assertEqual(payload["data"]["currentPoint"], 95.0)
        self.assertEqual(payload["data"]["highPoint"], 100.0)
        self.assertEqual(payload["data"]["drawdownPercent"], -5.0)

    def test_index_history_falls_back_to_tencent_and_normalizes_rows(self):
        rows = [
            [(date(2025, 11, 10) + timedelta(days=index)).isoformat(), "3500", str(3510 + index), "3520", "3490", "100"]
            for index in range(250)
        ]

        def fake_fetch(url, source):
            if "push2his.eastmoney.com" in url:
                raise UpstreamError(source)
            return {"data": {"sh000001": {"qfqday": rows}}}

        payload = fetch_index_history("1.000001", 250, fetcher=fake_fetch)

        self.assertEqual(len(payload["data"]["klines"]), 250)
        self.assertEqual(payload["data"]["klines"][0], "2025-11-10,3500,3510,3520,3490,100")
        self.assertEqual(payload["proxySource"], "腾讯行情")

    def test_stock_quote_falls_back_to_tencent_when_eastmoney_is_unavailable(self):
        quote = [""] * 33
        quote[1] = "航天电子"
        quote[2] = "600879"
        quote[3] = "15.15"
        quote[4] = "14.65"
        quote[30] = "20260721111726"
        quote[32] = "3.41"

        def fake_fetch(url, source):
            if "push2.eastmoney.com" in url:
                raise UpstreamError(source)
            return {
                "data": {
                    "sh600879": {
                        "data": {"data": [], "date": "20260721"},
                        "qt": {"sh600879": quote},
                    }
                }
            }

        payload = fetch_stock_quote("1.600879", fetcher=fake_fetch)

        self.assertEqual(payload["data"]["price"], 15.15)
        self.assertEqual(payload["data"]["prevClose"], 14.65)
        self.assertEqual(payload["data"]["changePercent"], 3.41)
        self.assertEqual(payload["data"]["quoteTimestamp"], 1784603846)
        self.assertEqual(payload["proxySource"], "腾讯行情")

    def test_market_snapshot_aggregates_every_reported_page(self):
        def fake_fetch(url, source):
            page = int(parse_qs(urlparse(url).query)["pn"][0])
            rows = [{"f12": f"{page}-{index}"} for index in range(100 if page == 1 else 50)]
            return {"data": {"total": 150, "diff": rows}}

        payload = fetch_market_snapshot(fetcher=fake_fetch, workers=1)

        self.assertEqual(payload["data"]["total"], 150)
        self.assertEqual(len(payload["data"]["diff"]), 150)

    def test_market_snapshot_falls_back_to_sina_and_normalizes_fields(self):
        def fake_fetch(url, source):
            if "push2.eastmoney.com" in url:
                raise UpstreamError(source)
            if "getHQNodeStockCount" in url:
                return "2"
            return [
                {"changepercent": 1.2, "amount": 100, "code": "600001", "name": "甲", "settlement": 10},
                {"changepercent": -2.3, "amount": 200, "code": "000001", "name": "乙", "settlement": 11},
            ]

        payload = fetch_market_snapshot(fetcher=fake_fetch, workers=1)

        self.assertEqual(payload["proxySource"], "新浪财经分页聚合")
        self.assertEqual(payload["data"]["total"], 2)
        self.assertEqual(payload["data"]["diff"][0], {
            "f3": 1.2,
            "f6": 100,
            "f12": "600001",
            "f14": "甲",
            "f18": 10,
        })


class ServerTests(unittest.TestCase):
    @staticmethod
    def fake_fetch(url, source):
        if "kline/get" in url:
            return {"data": {"klines": ["2026-07-17,3500,3510"]}}
        if "stock/get" in url:
            return {
                "data": {
                    "f43": 1443,
                    "f57": "600879",
                    "f58": "航天电子",
                    "f60": 1465,
                    "f86": 1784601060,
                    "f170": -150,
                }
            }
        raise UpstreamError(source)

    def test_health_and_dashboard_are_served_without_exposing_other_files(self):
        with running_server(self.fake_fetch) as base:
            self.assertEqual(read_json(f"{base}/health"), {"ok": True})
            self.assertIn("温度计", read_text(f"{base}/"))
            with self.assertRaises(HTTPError) as missing:
                urlopen(f"{base}/AGENTS.md", timeout=3)
            self.assertEqual(missing.exception.code, 404)

    def test_serves_html_reports_from_the_automations_directory(self):
        with running_server(self.fake_fetch) as base:
            report = read_text(f"{base}{quote(REPORT_PATH, safe='/')}")
        self.assertIn("电网投资与电网行业完整分析报告", report)

    def test_serves_files_from_sources_and_workbench_whitelists(self):
        with running_server(self.fake_fetch) as base:
            webpage = read_text(f"{base}{quote(WEBPAGE_PATH, safe='/')}")
            workbench = read_text(f"{base}{quote(WORKBENCH_PATH, safe='/')}")
            with urlopen(f"{base}{quote(PAPER_PATH, safe='/')}", timeout=3) as response:
                paper_type = response.headers.get_content_type()
                paper_header = response.read(4)

        self.assertIn("航天电子卖方评级与近期催化剂检索记录", webpage)
        self.assertIn("Investment Workbench", workbench)
        self.assertEqual(paper_type, "application/pdf")
        self.assertEqual(paper_header, b"%PDF")

    def test_rejects_encoded_path_traversal_from_the_automations_directory(self):
        with running_server(self.fake_fetch) as base:
            with self.assertRaises(HTTPError) as blocked:
                urlopen(f"{base}/sources/automations/%2e%2e/%2e%2e/AGENTS.md", timeout=3)
        self.assertEqual(blocked.exception.code, 404)

    def test_rejects_traversal_outside_sources_and_workbench_whitelists(self):
        with running_server(self.fake_fetch) as base:
            for path in (
                "/sources/webpages/%2e%2e/%2e%2e/AGENTS.md",
                "/workbench/%2e%2e/AGENTS.md",
            ):
                with self.subTest(path=path):
                    with self.assertRaises(HTTPError) as blocked:
                        urlopen(f"{base}{path}", timeout=3)
                    self.assertEqual(blocked.exception.code, 404)

    def test_api_returns_normalized_json(self):
        with running_server(self.fake_fetch) as base:
            payload = read_json(
                f"{base}/api/eastmoney-kline?secid=1.000300&limit=3000"
            )
        self.assertEqual(payload["data"]["klines"][0].split(",")[0], "2026-07-17")

    def test_youzhiyouxing_temperature_api_returns_normalized_temperature(self):
        def fake_fetch(url, source):
            if url == "https://youzhiyouxing.cn/data":
                return "温度更新时间：2026年7月22日 20:00 全市场温度 38° 中估 温度下降 低估 40% 中估 38% 高估 22%"
            raise UpstreamError(source)

        with running_server(fake_fetch) as base:
            payload = read_json(f"{base}/api/youzhiyouxing-temperature")

        self.assertEqual(payload["proxySource"], "有知有行公开温度计")
        self.assertEqual(payload["data"]["temperature"], 38)
        self.assertEqual(payload["data"]["band"], "中估")

    def test_nasdaq100_api_returns_current_point_and_drawdown(self):
        def fake_fetch(url, source):
            if source == "nasdaq100":
                return {
                    "chart": {
                        "result": [{
                            "meta": {"regularMarketPrice": 190.0},
                            "indicators": {"quote": [{"close": [100.0, 200.0, 190.0]}]},
                        }],
                    },
                }
            raise UpstreamError(source)

        with running_server(fake_fetch) as base:
            payload = read_json(f"{base}/api/nasdaq100")

        self.assertEqual(payload["data"]["currentPoint"], 190.0)
        self.assertEqual(payload["data"]["highPoint"], 200.0)
        self.assertEqual(payload["data"]["drawdownPercent"], -5.0)

    def test_stock_quote_api_returns_normalized_quote_and_rejects_invalid_secids(self):
        with running_server(self.fake_fetch) as base:
            payload = read_json(f"{base}/api/stock-quote?secid=1.600879")
            with self.assertRaises(HTTPError) as bad_request:
                urlopen(f"{base}/api/stock-quote?secid=2.600000", timeout=3)

        self.assertEqual(payload, {
            "data": {
                "secid": "1.600879",
                "code": "600879",
                "name": "航天电子",
                "price": 14.43,
                "prevClose": 14.65,
                "changePercent": -1.5,
                "quoteTimestamp": 1784601060,
            },
            "proxySource": "东方财富行情",
        })
        self.assertEqual(bad_request.exception.code, 400)

    def test_portfolio_api_persists_valid_local_holdings(self):
        payload = {
            "holdings": [{
                "id": "holding-1",
                "code": "600879",
                "name": "航天电子",
                "quantity": 1000,
                "cost": 12.3,
                "price": 14.5,
                "status": "持有",
                "note": "跟踪订单兑现",
                "updatedAt": 1784601060000,
            }],
            "trackingItems": [{
                "id": "tracking-1",
                "code": "",
                "name": "航天电子",
                "status": "观察",
                "thesis": "等待产业逻辑和资金状态重新共振",
                "riskLine": "跌破复核线且资金继续转弱",
                "nextAction": "复核",
                "reviewCondition": "出现风险转弱证据",
                "updatedAt": 1784601060000,
            }],
        }
        with running_server(self.fake_fetch) as base:
            request = Request(
                f"{base}/api/portfolio",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            with urlopen(request, timeout=3) as response:
                saved = json.loads(response.read().decode("utf-8"))
            loaded = read_json(f"{base}/api/portfolio")

        self.assertEqual(saved, payload)
        self.assertEqual(loaded, payload)

    def test_portfolio_api_accepts_legacy_holdings_only_payload(self):
        payload = {"holdings": []}
        expected = {"holdings": [], "trackingItems": []}
        with running_server(self.fake_fetch) as base:
            request = Request(
                f"{base}/api/portfolio",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            with urlopen(request, timeout=3) as response:
                saved = json.loads(response.read().decode("utf-8"))
            loaded = read_json(f"{base}/api/portfolio")

        self.assertEqual(saved, expected)
        self.assertEqual(loaded, expected)

    def test_portfolio_api_rejects_invalid_tracking_items(self):
        payload = {
            "holdings": [],
            "trackingItems": [{
                "id": "tracking-1",
                "code": "600879",
                "name": "航天电子",
                "status": "随便买",
                "updatedAt": 1784601060000,
            }],
        }
        with running_server(self.fake_fetch) as base:
            request = Request(
                f"{base}/api/portfolio",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            with self.assertRaises(HTTPError) as bad_request:
                urlopen(request, timeout=3)

        self.assertEqual(bad_request.exception.code, 400)

    def test_api_rejects_bad_parameters_and_sanitizes_upstream_errors(self):
        with running_server(self.fake_fetch) as base:
            with self.assertRaises(HTTPError) as bad_request:
                urlopen(f"{base}/api/margin?market=3", timeout=3)
            self.assertEqual(bad_request.exception.code, 400)

            with self.assertRaises(HTTPError) as upstream:
                urlopen(f"{base}/api/margin?market=1", timeout=3)
            self.assertEqual(upstream.exception.code, 502)
            body = json.loads(upstream.exception.read().decode("utf-8"))
            self.assertEqual(body, {
                "error": "upstream request failed",
                "source": "margin",
            })


if __name__ == "__main__":
    unittest.main()
