from contextlib import contextmanager
import json
from pathlib import Path
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from scripts.local_proxy import (
    RouteError,
    UpstreamError,
    build_upstream_url,
    create_server,
    parse_json_payload,
)


DASHBOARD = Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html"


def read_text(url):
    with urlopen(url, timeout=3) as response:
        return response.read().decode("utf-8")


def read_json(url):
    return json.loads(read_text(url))


@contextmanager
def running_server(fetcher):
    server = create_server(port=0, fetcher=fetcher, dashboard_path=DASHBOARD)
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


class PayloadTests(unittest.TestCase):
    def test_accepts_json_and_unwraps_jsonp(self):
        self.assertEqual(parse_json_payload(b'{"ok": true}'), {"ok": True})
        self.assertEqual(parse_json_payload(b'callback123({"ok": true});'), {"ok": True})


class ServerTests(unittest.TestCase):
    @staticmethod
    def fake_fetch(url, source):
        if "kline/get" in url:
            return {"data": {"klines": ["2026-07-17,3500,3510"]}}
        raise UpstreamError(source)

    def test_health_and_dashboard_are_served_without_exposing_other_files(self):
        with running_server(self.fake_fetch) as base:
            self.assertEqual(read_json(f"{base}/health"), {"ok": True})
            self.assertIn("A股温度计", read_text(f"{base}/"))
            with self.assertRaises(HTTPError) as missing:
                urlopen(f"{base}/AGENTS.md", timeout=3)
            self.assertEqual(missing.exception.code, 404)

    def test_api_returns_normalized_json(self):
        with running_server(self.fake_fetch) as base:
            payload = read_json(
                f"{base}/api/eastmoney-kline?secid=1.000300&limit=3000"
            )
        self.assertEqual(payload["data"]["klines"][0].split(",")[0], "2026-07-17")

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
