"""Local same-origin data proxy for the A-share market dashboard."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen
import webbrowser


ALLOWED_SECIDS = {"1.000001", "1.000300", "1.000985"}
ALLOWED_INDEX_CODES = {"000300", "000985"}
TENCENT_SYMBOLS = {
    "1.000001": "sh000001",
    "1.000300": "sh000300",
    "1.000985": "sh000985",
}
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


def _build_market_url(page):
    return _build_url(
        "https://push2.eastmoney.com/api/qt/clist/get",
        {
            "pn": str(page),
            "pz": "100",
            "po": "1",
            "np": "1",
            "fltt": "2",
            "invt": "2",
            "fid": "f3",
            "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
            "fields": "f3,f6,f12,f14,f18",
        },
    )


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
        return _build_market_url(1)
    if path == "/api/margin":
        market = _one(query, "market")
        if market not in {"1", "2"}:
            raise RouteError("invalid market")
        return f"https://cdn.jin10.com/data_center/reports/fs_{market}.json"
    raise RouteError("unknown route")


def parse_json_payload(body, encoding="utf-8-sig"):
    """Decode an upstream JSON or JSONP response into Python data."""
    try:
        text = body.decode(encoding).strip()
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
        encoding = "gb18030" if host == "vip.stock.finance.sina.com.cn" else "utf-8-sig"
        return parse_json_payload(body, encoding=encoding)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        raise UpstreamError(source) from error


def _tencent_rows(payload, symbol):
    data = payload.get("data") if isinstance(payload, dict) else None
    node = data.get(symbol) if isinstance(data, dict) else None
    if not isinstance(node, dict):
        return []
    rows = node.get("qfqday") or node.get("day") or []
    return rows if isinstance(rows, list) else []


def _build_tencent_kline_url(symbol, count, end_date=""):
    parameter = f"{symbol},day,,{end_date},{count},qfq"
    return _build_url(
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get",
        {"param": parameter},
    )


def fetch_index_history(secid, limit=3000, fetcher=fetch_upstream):
    """Fetch index history, falling back from Eastmoney to Tencent."""
    query = {"secid": [secid], "limit": [str(limit)]}
    upstream_url = build_upstream_url("/api/eastmoney-kline", query)
    try:
        payload = fetcher(upstream_url, "eastmoney-kline")
        rows = payload.get("data", {}).get("klines", []) if isinstance(payload, dict) else []
        if isinstance(rows, list) and rows:
            return payload
    except UpstreamError:
        pass

    symbol = TENCENT_SYMBOLS.get(secid)
    if not symbol:
        raise UpstreamError("index-history")
    requested = _bounded_int(limit, 250, 4000)
    rows_by_date = {}
    end_date = ""
    while len(rows_by_date) < requested:
        remaining = requested - len(rows_by_date)
        count = min(2000, remaining)
        payload = fetcher(_build_tencent_kline_url(symbol, count, end_date), "tencent-kline")
        rows = _tencent_rows(payload, symbol)
        if not rows:
            break
        for row in rows[-count:]:
            if isinstance(row, list) and len(row) >= 3:
                rows_by_date[str(row[0])] = row
        earliest = min(rows_by_date)
        end_date = (datetime.strptime(earliest, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        if len(rows) < count:
            break
    normalized = [
        ",".join(str(value) for value in rows_by_date[date][:6])
        for date in sorted(rows_by_date)[-requested:]
    ]
    if len(normalized) < 250:
        raise UpstreamError("index-history")
    return {"data": {"klines": normalized}, "proxySource": "腾讯行情"}


def _fetch_eastmoney_market_snapshot(fetcher, workers):
    first = fetcher(_build_market_url(1), "market")
    data = first.get("data") if isinstance(first, dict) else None
    first_rows = data.get("diff") if isinstance(data, dict) else None
    total = data.get("total") if isinstance(data, dict) else None
    if not isinstance(first_rows, list) or not first_rows or not isinstance(total, int) or total <= 0:
        raise UpstreamError("market")
    page_size = len(first_rows)
    page_count = (total + page_size - 1) // page_size

    def load_page(page):
        payload = fetcher(_build_market_url(page), "market")
        page_data = payload.get("data") if isinstance(payload, dict) else None
        rows = page_data.get("diff") if isinstance(page_data, dict) else None
        if not isinstance(rows, list):
            raise UpstreamError("market")
        return page, rows

    pages = {1: first_rows}
    if page_count > 1:
        with ThreadPoolExecutor(max_workers=max(1, min(workers, 12))) as executor:
            for page, rows in executor.map(load_page, range(2, page_count + 1)):
                pages[page] = rows
    combined = [row for page in range(1, page_count + 1) for row in pages.get(page, [])]
    if len(combined) < min(total, 1000):
        raise UpstreamError("market")
    return {"data": {"total": total, "diff": combined[:total]}, "proxySource": "东方财富分页聚合"}


def _build_sina_market_url(page):
    return _build_url(
        "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData",
        {
            "page": str(page),
            "num": "100",
            "sort": "symbol",
            "asc": "1",
            "node": "hs_a",
            "symbol": "",
            "_s_r_a": "page",
        },
    )


def _normalize_sina_row(row):
    return {
        "f3": row.get("changepercent"),
        "f6": row.get("amount"),
        "f12": row.get("code"),
        "f14": row.get("name"),
        "f18": row.get("settlement"),
    }


def _fetch_sina_market_snapshot(fetcher, workers):
    count_url = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeStockCount?node=hs_a"
    count_value = fetcher(count_url, "sina-market")
    try:
        total = int(count_value)
    except (TypeError, ValueError) as error:
        raise UpstreamError("sina-market") from error
    if total <= 0:
        raise UpstreamError("sina-market")
    page_count = (total + 99) // 100

    def load_page(page):
        rows = fetcher(_build_sina_market_url(page), "sina-market")
        if not isinstance(rows, list):
            raise UpstreamError("sina-market")
        return page, rows

    pages = {}
    with ThreadPoolExecutor(max_workers=max(1, min(workers, 12))) as executor:
        for page, rows in executor.map(load_page, range(1, page_count + 1)):
            pages[page] = rows
    combined = [row for page in range(1, page_count + 1) for row in pages.get(page, [])]
    if len(combined) < min(total, 1000):
        raise UpstreamError("sina-market")
    normalized = [_normalize_sina_row(row) for row in combined[:total] if isinstance(row, dict)]
    return {"data": {"total": total, "diff": normalized}, "proxySource": "新浪财经分页聚合"}


def fetch_market_snapshot(fetcher=fetch_upstream, workers=8):
    """Fetch the full A-share universe with an independent Sina fallback."""
    try:
        return _fetch_eastmoney_market_snapshot(fetcher, workers)
    except UpstreamError:
        return _fetch_sina_market_snapshot(fetcher, workers)


def create_server(host="127.0.0.1", port=0, fetcher=fetch_upstream, dashboard_path=None):
    """Create a loopback-only dashboard server with fixed proxy routes."""
    artifact = Path(dashboard_path or Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html").resolve()
    automations_root = (artifact.parents[2] / "sources" / "automations").resolve()

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

        def send_automation_report(self, request_path):
            prefix = "/sources/automations/"
            decoded_path = unquote(request_path)
            if not decoded_path.startswith(prefix):
                return self.send_json(404, {"error": "not found"})
            report = (automations_root / decoded_path[len(prefix):]).resolve()
            try:
                report.relative_to(automations_root)
            except ValueError:
                return self.send_json(404, {"error": "not found"})
            if report.suffix.lower() != ".html" or not report.is_file():
                return self.send_json(404, {"error": "not found"})
            try:
                body = report.read_bytes()
            except OSError:
                return self.send_json(404, {"error": "not found"})
            return self._send_bytes(200, body, "text/html; charset=utf-8")

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                return self.send_json(200, {"ok": True})
            if parsed.path in {"/", "/a-share-market-dashboard.html"}:
                return self.send_dashboard()
            if parsed.path.startswith("/sources/automations/"):
                return self.send_automation_report(parsed.path)
            if not parsed.path.startswith("/api/"):
                return self.send_json(404, {"error": "not found"})
            source = SOURCE_NAMES.get(parsed.path, "unknown")
            try:
                query = parse_qs(parsed.query, keep_blank_values=True)
                if parsed.path == "/api/eastmoney-kline":
                    build_upstream_url(parsed.path, query)
                    payload = fetch_index_history(
                        _one(query, "secid"),
                        _bounded_int(_one(query, "limit", "3000"), 250, 4000),
                        fetcher,
                    )
                elif parsed.path == "/api/market":
                    build_upstream_url(parsed.path, query)
                    payload = fetch_market_snapshot(fetcher)
                else:
                    upstream_url = build_upstream_url(parsed.path, query)
                    payload = fetcher(upstream_url, source)
                return self.send_json(200, payload)
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
