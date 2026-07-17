"""Local same-origin data proxy for the A-share market dashboard."""

from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
import webbrowser


ALLOWED_SECIDS = {"1.000001", "1.000300", "1.000985"}
ALLOWED_INDEX_CODES = {"000300", "000985"}
MAX_RESPONSE_BYTES = 25 * 1024 * 1024
SOURCE_NAMES = {
    "/api/eastmoney-kline": "eastmoney-kline",
    "/api/csindex-performance": "csindex-performance",
    "/api/treasury": "treasury",
    "/api/market": "market",
    "/api/margin": "margin",
}


class RouteError(ValueError):
    """Raised when a local proxy route or parameter is not allowlisted."""


class UpstreamError(RuntimeError):
    """Raised when a fixed upstream request cannot return valid JSON."""

    def __init__(self, source):
        super().__init__("upstream request failed")
        self.source = source


def _one(query, key, default=None):
    values = query.get(key)
    if values is None:
        if default is not None:
            return default
        raise RouteError(f"missing {key}")
    if not isinstance(values, list) or len(values) != 1:
        raise RouteError(f"invalid {key}")
    return str(values[0])


def _bounded_int(value, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError) as error:
        raise RouteError("invalid integer") from error
    if not minimum <= number <= maximum:
        raise RouteError("integer out of range")
    return number


def _date8(value):
    if not re.fullmatch(r"\d{8}", value):
        raise RouteError("invalid date")
    try:
        datetime.strptime(value, "%Y%m%d")
    except ValueError as error:
        raise RouteError("invalid date") from error
    return value


def _build_url(base, params):
    return f"{base}?{urlencode(params)}"


def build_upstream_url(path, query):
    """Map one fixed local API route to a validated upstream URL."""
    if path == "/api/eastmoney-kline":
        secid = _one(query, "secid")
        if secid not in ALLOWED_SECIDS:
            raise RouteError("invalid secid")
        limit = _bounded_int(_one(query, "limit", "3000"), 250, 4000)
        return _build_url(
            "https://push2his.eastmoney.com/api/qt/stock/kline/get",
            {
                "secid": secid,
                "klt": "101",
                "fqt": "1",
                "lmt": str(limit),
                "fields1": "f1,f2,f3,f4,f5,f6",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            },
        )
    if path == "/api/csindex-performance":
        index_code = _one(query, "indexCode")
        if index_code not in ALLOWED_INDEX_CODES:
            raise RouteError("invalid indexCode")
        start_date = _date8(_one(query, "startDate"))
        end_date = _date8(_one(query, "endDate"))
        if start_date > end_date:
            raise RouteError("invalid date range")
        return _build_url(
            "https://www.csindex.com.cn/csindex-home/perf/index-perf",
            {"indexCode": index_code, "startDate": start_date, "endDate": end_date},
        )
    if path == "/api/treasury":
        return _build_url(
            "https://datacenter.eastmoney.com/api/data/get",
            {
                "type": "RPTA_WEB_TREASURYYIELD",
                "sty": "ALL",
                "st": "SOLAR_DATE",
                "sr": "-1",
                "token": "894050c76af8597a853f5b408b759f5d",
                "p": "1",
                "ps": "500",
                "pageNo": "1",
                "pageNum": "1",
            },
        )
    if path == "/api/market":
        return _build_url(
            "https://push2.eastmoney.com/api/qt/clist/get",
            {
                "pn": "1",
                "pz": "6000",
                "po": "1",
                "np": "1",
                "fltt": "2",
                "invt": "2",
                "fid": "f3",
                "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
                "fields": "f3,f6,f12,f14,f18",
            },
        )
    if path == "/api/margin":
        market = _one(query, "market")
        if market not in {"1", "2"}:
            raise RouteError("invalid market")
        return f"https://cdn.jin10.com/data_center/reports/fs_{market}.json"
    raise RouteError("unknown route")


def parse_json_payload(body):
    """Decode an upstream JSON or JSONP response into Python data."""
    try:
        text = body.decode("utf-8-sig").strip()
    except (AttributeError, UnicodeDecodeError) as error:
        raise ValueError("invalid response encoding") from error
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.fullmatch(r"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\((.*)\);?", text, re.DOTALL)
        if not match:
            raise ValueError("invalid JSON response")
        return json.loads(match.group(1))


def fetch_upstream(url, source):
    """Fetch one allowlisted upstream response with bounded resources."""
    host = urlparse(url).hostname or ""
    referer = "https://www.csindex.com.cn/" if host.endswith("csindex.com.cn") else "https://quote.eastmoney.com/"
    request = Request(
        url,
        headers={
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
            "Referer": referer,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        },
    )
    try:
        with urlopen(request, timeout=12) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("response too large")
        return parse_json_payload(body)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        raise UpstreamError(source) from error


def create_server(host="127.0.0.1", port=0, fetcher=fetch_upstream, dashboard_path=None):
    """Create a loopback-only dashboard server with fixed proxy routes."""
    artifact = Path(dashboard_path or Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html")

    class DashboardHandler(BaseHTTPRequestHandler):
        server_version = "AShareDashboard/1.0"

        def _send_bytes(self, status, body, content_type):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def send_json(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self._send_bytes(status, body, "application/json; charset=utf-8")

        def send_dashboard(self):
            try:
                body = artifact.read_bytes()
            except OSError:
                return self.send_json(500, {"error": "dashboard artifact unavailable"})
            return self._send_bytes(200, body, "text/html; charset=utf-8")

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                return self.send_json(200, {"ok": True})
            if parsed.path in {"/", "/a-share-market-dashboard.html"}:
                return self.send_dashboard()
            if not parsed.path.startswith("/api/"):
                return self.send_json(404, {"error": "not found"})
            source = SOURCE_NAMES.get(parsed.path, "unknown")
            try:
                upstream_url = build_upstream_url(parsed.path, parse_qs(parsed.query, keep_blank_values=True))
                return self.send_json(200, fetcher(upstream_url, source))
            except RouteError as error:
                return self.send_json(400, {"error": str(error)})
            except UpstreamError as error:
                return self.send_json(502, {"error": "upstream request failed", "source": error.source})
            except Exception:
                return self.send_json(500, {"error": "internal proxy error", "source": source})

        def log_message(self, message_format, *args):
            sys.stderr.write("proxy: " + message_format % args + "\n")

    return ThreadingHTTPServer((host, port), DashboardHandler)


def main():
    server = create_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    print(f"A 股大盘面板已启动：{url}")
    print("关闭此窗口或按 Ctrl+C 可停止本地数据服务。")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止本地数据服务……")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
