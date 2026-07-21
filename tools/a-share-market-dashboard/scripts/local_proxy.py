"""Local same-origin data proxy for the A-share market dashboard."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen
import webbrowser


ALLOWED_SECIDS = {"1.000001", "1.000300", "1.000985"}
ALLOWED_STOCK_SECIDS = {"1.600879"}
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
    "/api/stock-quote": "stock-quote",
}
TENCENT_STOCK_SYMBOLS = {"1.600879": "sh600879"}


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
    if path == "/api/stock-quote":
        secid = _one(query, "secid")
        if secid not in ALLOWED_STOCK_SECIDS:
            raise RouteError("invalid secid")
        return _build_url(
            "https://push2.eastmoney.com/api/qt/stock/get",
            {
                "secid": secid,
                "fields": "f43,f57,f58,f60,f86,f170",
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


def normalize_stock_quote(payload, secid):
    """Normalize one allowlisted Eastmoney stock quote for report pages."""
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        raise UpstreamError("stock-quote")
    numeric_fields = ("f43", "f60", "f86", "f170")
    if any(isinstance(data.get(field), bool) or not isinstance(data.get(field), (int, float)) for field in numeric_fields):
        raise UpstreamError("stock-quote")
    code = data.get("f57")
    name = data.get("f58")
    if not isinstance(code, str) or not code or not isinstance(name, str) or not name:
        raise UpstreamError("stock-quote")
    return {
        "data": {
            "secid": secid,
            "code": code,
            "name": name,
            "price": round(data["f43"] / 100, 2),
            "prevClose": round(data["f60"] / 100, 2),
            "changePercent": round(data["f170"] / 100, 2),
            "quoteTimestamp": int(data["f86"]),
        },
        "proxySource": "东方财富行情",
    }


def _build_tencent_stock_quote_url(secid):
    symbol = TENCENT_STOCK_SYMBOLS.get(secid)
    if not symbol:
        raise RouteError("invalid secid")
    return _build_url(
        "https://ifzq.gtimg.cn/appstock/app/minute/query",
        {"code": symbol},
    )


def normalize_tencent_stock_quote(payload, secid):
    """Normalize the fixed Tencent quote array used as the stock fallback."""
    symbol = TENCENT_STOCK_SYMBOLS.get(secid)
    data = payload.get("data") if isinstance(payload, dict) else None
    node = data.get(symbol) if isinstance(data, dict) else None
    qt = node.get("qt") if isinstance(node, dict) else None
    quote = qt.get(symbol) if isinstance(qt, dict) else None
    if not isinstance(quote, list) or len(quote) < 33:
        raise UpstreamError("tencent-stock-quote")
    try:
        price = float(quote[3])
        prev_close = float(quote[4])
        change_percent = float(quote[32])
        quote_time = datetime.strptime(quote[30], "%Y%m%d%H%M%S").replace(
            tzinfo=timezone(timedelta(hours=8))
        )
    except (TypeError, ValueError) as error:
        raise UpstreamError("tencent-stock-quote") from error
    code = quote[2]
    name = quote[1]
    if not isinstance(code, str) or not code or not isinstance(name, str) or not name:
        raise UpstreamError("tencent-stock-quote")
    return {
        "data": {
            "secid": secid,
            "code": code,
            "name": name,
            "price": round(price, 2),
            "prevClose": round(prev_close, 2),
            "changePercent": round(change_percent, 2),
            "quoteTimestamp": int(quote_time.timestamp()),
        },
        "proxySource": "腾讯行情",
    }


def fetch_stock_quote(secid, fetcher=None):
    """Fetch a fixed stock quote, falling back from Eastmoney to Tencent."""
    if fetcher is None:
        fetcher = fetch_upstream
    query = {"secid": [secid]}
    try:
        upstream_url = build_upstream_url("/api/stock-quote", query)
        return normalize_stock_quote(fetcher(upstream_url, "stock-quote"), secid)
    except UpstreamError:
        payload = fetcher(
            _build_tencent_stock_quote_url(secid),
            "tencent-stock-quote",
        )
        return normalize_tencent_stock_quote(payload, secid)


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


def create_server(
    host="127.0.0.1",
    port=0,
    fetcher=fetch_upstream,
    dashboard_path=None,
    portfolio_path=None,
):
    """Create a loopback-only dashboard server with fixed proxy routes."""
    artifact = Path(dashboard_path or Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html").resolve()
    portfolio_file = Path(
        portfolio_path or artifact.parent / "data" / "portfolio.json"
    ).resolve()
    vault_root = artifact.parents[2]
    file_roots = {
        "/sources/": (vault_root / "sources").resolve(),
        "/workbench/": (vault_root / "workbench").resolve(),
    }
    content_types = {
        ".css": "text/css; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".gif": "image/gif",
        ".html": "text/html; charset=utf-8",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".json": "application/json; charset=utf-8",
        ".md": "text/plain; charset=utf-8",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".txt": "text/plain; charset=utf-8",
        ".webp": "image/webp",
    }

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

        def send_portfolio(self):
            try:
                payload = json.loads(portfolio_file.read_text(encoding="utf-8"))
            except FileNotFoundError:
                payload = {"holdings": []}
            except (OSError, json.JSONDecodeError):
                return self.send_json(500, {"error": "portfolio data unavailable"})
            return self.send_json(200, payload)

        def save_portfolio(self):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "invalid content length"})
            if content_length <= 0 or content_length > 262_144:
                return self.send_json(400, {"error": "invalid portfolio payload"})
            try:
                payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                holdings = payload.get("holdings")
                if not isinstance(holdings, list) or len(holdings) > 200:
                    raise ValueError
                normalized = []
                allowed_statuses = {"持有", "观察", "计划加仓", "计划减仓"}
                for item in holdings:
                    if not isinstance(item, dict):
                        raise ValueError
                    holding_id = str(item.get("id", ""))[:80]
                    code = str(item.get("code", ""))[:12]
                    name = str(item.get("name", ""))[:30]
                    status = str(item.get("status", "持有"))
                    note = str(item.get("note", ""))[:240]
                    quantity = float(item.get("quantity", 0))
                    cost = float(item.get("cost", 0))
                    price = float(item.get("price", 0))
                    updated_at = int(item.get("updatedAt", 0))
                    if (
                        not holding_id
                        or not code
                        or not name
                        or status not in allowed_statuses
                        or not all(math.isfinite(value) for value in (quantity, cost, price))
                        or min(quantity, cost, price, updated_at) < 0
                    ):
                        raise ValueError
                    normalized.append({
                        "id": holding_id,
                        "code": code,
                        "name": name,
                        "quantity": quantity,
                        "cost": cost,
                        "price": price,
                        "status": status,
                        "note": note,
                        "updatedAt": updated_at,
                    })
                saved = {"holdings": normalized}
                portfolio_file.parent.mkdir(parents=True, exist_ok=True)
                temporary_file = portfolio_file.with_suffix(".tmp")
                temporary_file.write_text(
                    json.dumps(saved, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8",
                )
                temporary_file.replace(portfolio_file)
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                return self.send_json(400, {"error": "invalid portfolio payload"})
            return self.send_json(200, saved)

        def send_whitelisted_file(self, request_path):
            decoded_path = unquote(request_path)
            match = next(
                (
                    (prefix, root)
                    for prefix, root in file_roots.items()
                    if decoded_path.startswith(prefix)
                ),
                None,
            )
            if match is None:
                return self.send_json(404, {"error": "not found"})
            prefix, root = match
            requested_file = (root / decoded_path[len(prefix):]).resolve()
            try:
                requested_file.relative_to(root)
            except ValueError:
                return self.send_json(404, {"error": "not found"})
            if not requested_file.is_file():
                return self.send_json(404, {"error": "not found"})
            try:
                body = requested_file.read_bytes()
            except OSError:
                return self.send_json(404, {"error": "not found"})
            content_type = content_types.get(
                requested_file.suffix.lower(),
                "application/octet-stream",
            )
            return self._send_bytes(200, body, content_type)

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                return self.send_json(200, {"ok": True})
            if parsed.path in {"/", "/a-share-market-dashboard.html"}:
                return self.send_dashboard()
            if parsed.path == "/api/portfolio":
                return self.send_portfolio()
            if parsed.path.startswith("/sources/") or parsed.path.startswith("/workbench/"):
                return self.send_whitelisted_file(parsed.path)
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
                elif parsed.path == "/api/stock-quote":
                    secid = _one(query, "secid")
                    payload = fetch_stock_quote(secid, fetcher)
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

        def do_PUT(self):
            parsed = urlparse(self.path)
            if parsed.path != "/api/portfolio":
                return self.send_json(404, {"error": "not found"})
            return self.save_portfolio()

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
