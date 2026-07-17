import unittest
from urllib.parse import parse_qs, urlparse

from scripts.local_proxy import RouteError, build_upstream_url


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


if __name__ == "__main__":
    unittest.main()
