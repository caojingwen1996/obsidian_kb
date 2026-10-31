"""Local same-origin data proxy for the A-share market dashboard."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from http.client import RemoteDisconnected
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import html
import importlib
import types
import json
import math
import os
import plistlib
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
from threading import Event, Lock, Thread
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from urllib.request import Request, build_opener
import webbrowser
import zipfile
import xml.etree.ElementTree as ET

try:
    from .dividend_index_history import refresh_index_history, index_history_metadata
    from .dividend_recalculation import iso_date, number, save_and_recalculate
except ImportError:
    from dividend_index_history import refresh_index_history, index_history_metadata
    from dividend_recalculation import iso_date, number, save_and_recalculate


VENDOR_PYTHON_PATH = Path(__file__).resolve().parents[1] / "vendor" / "python"
if VENDOR_PYTHON_PATH.exists():
    sys.path.append(str(VENDOR_PYTHON_PATH))
TUSHARE_CLIENT_PATH = Path(__file__).resolve().parents[2] / "tushare-data" / "scripts"
if TUSHARE_CLIENT_PATH.exists() and str(TUSHARE_CLIENT_PATH) not in sys.path:
    sys.path.append(str(TUSHARE_CLIENT_PATH))

TODO_DATA_LOCK = Lock()

ALLOWED_SECIDS = {"1.000001", "1.000300", "1.000985", "0.159941"}
ALLOWED_INDEX_CODES = {"000300", "000985", "000922"}
TENCENT_SYMBOLS = {
    "0.159941": "sz159941",
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
    "/api/market-turnover": "market-turnover",
    "/api/us-treasury-yield": "us-treasury-yield",
    "/api/us-dollar-index": "us-dollar-index",
    "/api/usd-jpy": "usd-jpy",
    "/api/stock-lookup": "tushare-stock-basic",
    "/api/stock-quote": "stock-quote",
    "/api/stock-close-performance": "stock-close-performance",
    "/api/stock-dividend-yield": "stock-dividend-yield",
    "/api/youzhiyouxing-temperature": "youzhiyouxing-temperature",
    "/api/nasdaq100": "nasdaq100",
    "/api/fugui-candidate": "fugui-candidate",
    "/api/review-diary": "review-diary",
    "/api/review-diaries": "review-diaries",
    "/api/tracking-rerender-reports": "tracking-rerender-reports",
    "/api/featured-post": "featured-post",
    "/api/todo-item": "todo-item",
}
YOUZHIYOUXING_TEMPERATURE_URL = "https://youzhiyouxing.cn/data"
NASDAQ100_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?range=max&interval=1d"
PORTFOLIO_STATUSES = {"持有", "观察", "计划加仓", "计划减仓"}
TODO_QUADRANT_FLAGS = {
    "重要且紧急": ("是", "是"),
    "重要不紧急": ("是", "否"),
    "紧急不重要": ("否", "是"),
    "不重要且不紧急": ("否", "否"),
}
TODO_QUADRANTS = tuple(TODO_QUADRANT_FLAGS)
TODO_STATUSES = ("未开始", "进行中", "已完成")
TODO_CREATE_SOURCE = "看板新增"
DEFAULT_PORT = 49888
TODO_ACTION_PORT = 49889
DIVIDEND_WORKBOOK_PATH = Path("sources/automations/中证红利信号/中证红利每日信号.xlsx")
FUGUI_DATA_PROVIDERS = {"akshare", "tushare"}
AKSHARE_CODE_NAME_CACHE_TTL_SECONDS = 600
AKSHARE_SPOT_CACHE_TTL_SECONDS = 120
FUGUI_QUOTE_CACHE_TTL_SECONDS = 30
FUGUI_TREASURY_CACHE_TTL_SECONDS = 600
_AKSHARE_CODE_NAME_CACHE = {"expires": 0.0, "rows": None}
_AKSHARE_SPOT_CACHE = {"expires": 0.0, "rows": None}
_FUGUI_QUOTE_CACHE = {}
_FUGUI_TREASURY_CACHE = {"expires": 0.0, "payload": None}
PROXY_LOG_PATH = Path(__file__).resolve().parents[1] / "data" / "proxy.log"


class RouteError(ValueError):
    """Raised when a local proxy route or parameter is not allowlisted."""


class UpstreamError(RuntimeError):
    """Raised when a fixed upstream request cannot return valid JSON."""

    def __init__(self, source):
        super().__init__("upstream request failed")
        self.source = source


def _trim_log_value(value):
    text = str(value)
    return text if len(text) <= 500 else f"{text[:497]}..."


def write_proxy_log(event, **fields):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    details = " ".join(f"{key}={_trim_log_value(value)}" for key, value in fields.items() if value is not None)
    message = f"[{timestamp}] {event}" + (f" {details}" if details else "")
    print(message, flush=True)
    try:
        PROXY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with PROXY_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(message + "\n")
    except OSError:
        pass


def call_logged_data_api(provider, method, loader, **fields):
    write_proxy_log("DATA_CALL", provider=provider, method=method, **fields)
    try:
        result = loader()
    except Exception as error:
        write_proxy_log("DATA_FAIL", provider=provider, method=method, error=type(error).__name__, **fields)
        raise
    write_proxy_log("DATA_OK", provider=provider, method=method, **fields)
    return result


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


def _stock_secid(value):
    if not re.fullmatch(r"[01]\.\d{6}", value):
        raise RouteError("invalid secid")
    return value


def _stock_code_from_secid(value):
    return _stock_secid(value).split(".", 1)[1]


def _stock_market_for_code(code):
    digits = str(code or "").strip()
    if not re.fullmatch(r"\d{6}", digits):
        raise RouteError("invalid stock code")
    if digits.startswith(("6", "9")):
        return f"1.{digits}"
    if digits.startswith(("0", "2", "3")):
        return f"0.{digits}"
    raise RouteError("invalid stock code")


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
        secid = _stock_secid(_one(query, "secid"))
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


def _stock_daily_rows_for_close_performance(secid, client=None):
    from tushare_client import TushareClient, TushareClientError, a_share_ts_code, frame_to_rows

    code = _stock_code_from_secid(secid)
    today = datetime.now(timezone(timedelta(hours=8))).date()
    start_date = (today - timedelta(days=140)).isoformat()
    end_date = today.isoformat()
    try:
        frame = (client or TushareClient(logger=write_proxy_log)).daily(
            ts_code=a_share_ts_code(code),
            start_date=start_date,
            end_date=end_date,
            fields=["ts_code", "trade_date", "close", "pre_close", "change"],
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-daily")) from error
    return frame_to_rows(frame)


def calculate_close_performance(rows):
    if not isinstance(rows, list) or not rows:
        raise UpstreamError("tushare-daily")
    ordered = sorted(
        (row for row in rows if isinstance(row, dict)),
        key=lambda row: str(row.get("trade_date") or ""),
        reverse=True,
    )
    valid = []
    for row in ordered:
        try:
            close = float(row.get("close"))
            pre_close = float(row.get("pre_close"))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(close) or not math.isfinite(pre_close) or pre_close <= 0:
            continue
        valid.append({
            "tradeDate": str(row.get("trade_date") or ""),
            "close": close,
            "preClose": pre_close,
        })
    if not valid:
        raise UpstreamError("tushare-daily")
    latest = valid[0]
    baseline = valid[min(4, len(valid) - 1)]
    week_change_percent = None
    if baseline["close"] > 0:
        week_change_percent = round(((latest["close"] / baseline["close"]) - 1) * 100, 2)
    return {
        "tradeDate": latest["tradeDate"],
        "latestClose": round(latest["close"], 2),
        "preClose": round(latest["preClose"], 2),
        "weekChangePercent": week_change_percent,
        "sampleDays": min(5, len(valid)),
    }


def fetch_stock_close_performance(secid, client=None):
    normalized_secid = _stock_secid(secid)
    rows = _stock_daily_rows_for_close_performance(normalized_secid, client)
    return {
        "data": {
            "secid": normalized_secid,
            **calculate_close_performance(rows),
        },
        "proxySource": "Tushare daily via tushare-data",
    }


def _finite_number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        stripped = value.strip().replace(",", "")
        if stripped in {"", "-", "--"}:
            return None
        try:
            number = float(stripped)
        except ValueError:
            return None
    else:
        return None
    return number if math.isfinite(number) else None


def _latest_treasury_yield(payload):
    rows = payload.get("result", {}).get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise UpstreamError("treasury")
    candidates = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        value = _finite_number(row.get("EMM00166466"))
        date_text = str(row.get("SOLAR_DATE") or "")
        if value is not None and date_text:
            candidates.append((date_text[:10], value))
    if not candidates:
        raise UpstreamError("treasury")
    return sorted(candidates, key=lambda item: item[0])[-1]


def _akshare_rows(frame):
    try:
        records = frame.to_dict("records")
    except AttributeError as error:
        raise UpstreamError("akshare") from error
    return records if isinstance(records, list) else []


def _akshare_value(row, *keys):
    if not isinstance(row, dict):
        return None
    for key in keys:
        if key in row:
            return row.get(key)
    return None


def _cached_akshare_rows(cache, ttl_seconds, loader):
    now = monotonic()
    cached_rows = cache.get("rows")
    if isinstance(cached_rows, list) and cache.get("expires", 0.0) > now:
        return cached_rows
    rows = _akshare_rows(loader())
    cache["rows"] = rows
    cache["expires"] = now + ttl_seconds
    return rows


def _cached_fugui_quote(code, fetcher):
    now = monotonic()
    cached = _FUGUI_QUOTE_CACHE.get(code)
    if isinstance(cached, dict) and cached.get("expires", 0.0) > now:
        return cached["payload"]
    secid = _stock_market_for_code(code)
    payload = fetcher(_build_tencent_stock_quote_url(secid), "tencent-stock-quote")
    _FUGUI_QUOTE_CACHE[code] = {"expires": now + FUGUI_QUOTE_CACHE_TTL_SECONDS, "payload": payload}
    return payload


def _cached_fugui_treasury(fetcher):
    now = monotonic()
    payload = _FUGUI_TREASURY_CACHE.get("payload")
    if payload is not None and _FUGUI_TREASURY_CACHE.get("expires", 0.0) > now:
        return payload
    payload = fetcher(build_upstream_url("/api/treasury", {}), "treasury")
    _FUGUI_TREASURY_CACHE["payload"] = payload
    _FUGUI_TREASURY_CACHE["expires"] = now + FUGUI_TREASURY_CACHE_TTL_SECONDS
    return payload


def _money_to_yuan(value):
    number = _finite_number(value)
    if number is not None:
        return number
    if not isinstance(value, str):
        return None
    text = value.strip().replace(",", "")
    units = (("亿元", 100_000_000), ("亿", 100_000_000), ("万元", 10_000), ("万", 10_000), ("元", 1))
    for suffix, multiplier in units:
        if text.endswith(suffix):
            number = _finite_number(text[: -len(suffix)])
            return number * multiplier if number is not None else None
    return None


def _fugui_provider(value):
    provider = str(value or "akshare").strip().lower()
    if provider not in FUGUI_DATA_PROVIDERS:
        raise RouteError("invalid provider")
    return provider


def _fugui_candidate_from_akshare_code_name(rows, query):
    normalized_query = str(query or "").strip()
    candidates = []
    for row in rows:
        code = str(_akshare_value(row, "code", "代码", "A股代码") or "").strip()
        name = str(_akshare_value(row, "name", "名称", "A股简称") or "").strip()
        if not re.fullmatch(r"\d{6}", code) or not name:
            continue
        if code == normalized_query or name == normalized_query:
            score = 0
        elif normalized_query and (normalized_query in name or name in normalized_query):
            score = 1
        else:
            continue
        candidates.append((score, code, {"code": code, "name": name}))
    if not candidates:
        raise UpstreamError("akshare-code-name")
    return sorted(candidates, key=lambda item: (item[0], item[1]))[0][2]


def fetch_stock_lookup(name, client=None):
    """Resolve an exact A-share name; partial names are suggestions only."""
    from tushare_client import TushareClient, TushareClientError

    query = str(name or "").strip()
    if not query or len(query) > 30:
        raise RouteError("invalid stock name")
    if client is None:
        client = TushareClient(
            extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
            logger=write_proxy_log,
        )
    try:
        rows = client.stock_basic_rows()
    except TushareClientError as error:
        raise UpstreamError(error.source) from error
    candidates = {}
    for row in rows:
        code = str(row.get("symbol") or str(row.get("ts_code", "")).split(".")[0]).strip()
        stock_name = str(row.get("name") or "").strip()
        if re.fullmatch(r"\d{6}", code) and stock_name and (query in stock_name or query == code):
            candidates[code] = {"name": stock_name, "code": code}
    exact = [item for item in candidates.values() if query in (item["name"], item["code"])]
    return {
        "data": {"match": exact[0] if len(exact) == 1 else None,
                 "candidates": (exact or list(candidates.values()))[:10]},
        "proxySource": "Tushare stock_basic",
    }


def _fugui_candidate_from_tushare_stock_basic(rows, query):
    from tushare_client import plain_code_from_ts_code

    normalized_query = str(query or "").strip()
    candidates = []
    for row in rows:
        code = plain_code_from_ts_code(_akshare_value(row, "ts_code", "symbol"))
        name = str(_akshare_value(row, "name") or "").strip()
        if not re.fullmatch(r"\d{6}", code) or not name:
            continue
        if code == normalized_query or name == normalized_query:
            score = 0
        elif normalized_query and (normalized_query in name or name in normalized_query):
            score = 1
        else:
            continue
        candidates.append((score, code, {
            "code": code,
            "name": name,
            "industry": str(_akshare_value(row, "industry") or "未获取到").strip() or "未获取到",
        }))
    if not candidates:
        raise UpstreamError("tushare-code-name")
    return sorted(candidates, key=lambda item: (item[0], item[1]))[0][2]


def _infer_fugui_ownership(*values):
    text = " ".join(str(value or "") for value in values)
    if "央企" in text or "中央" in text or "中证央企" in text:
        return "央企"
    if "国企" in text or "国有" in text or "国资" in text:
        return "国企"
    return "待验证"


def _fugui_spot_row(rows, code):
    for row in rows:
        row_code = str(_akshare_value(row, "代码", "code") or "").strip()
        if row_code == code or row_code[-6:] == code:
            return row
    raise UpstreamError("akshare-spot")


def _fugui_quote_row_from_tencent(code, fetcher):
    secid = _stock_market_for_code(code)
    payload = _cached_fugui_quote(code, fetcher)
    quote = normalize_tencent_stock_quote(payload, secid)["data"]
    return {"代码": quote["code"], "名称": quote["name"], "最新价": quote["price"]}


def _fugui_profile_row(rows, code):
    for row in rows:
        row_code = str(_akshare_value(row, "A股代码", "代码", "code") or "").strip()
        if not row_code or row_code == code:
            return row
    return {}


def _latest_cash_dividend_per_10(rows):
    candidates = []
    for row in rows:
        progress = str(_akshare_value(row, "进度") or "")
        if "实施" not in progress:
            continue
        amount = _finite_number(_akshare_value(row, "派息"))
        date_text = str(_akshare_value(row, "除权除息日", "股权登记日", "公告日期") or "")
        if amount is not None and amount > 0 and date_text:
            candidates.append((date_text[:10], amount))
    if not candidates:
        raise UpstreamError("akshare-dividend")
    return sorted(candidates, key=lambda item: item[0])[-1]


def normalize_fugui_candidate_from_akshare(candidate, spot_row, profile_row, dividend_rows, treasury_payload):
    """Normalize one automatically fetched Fugui strategy candidate from AKShare data."""
    bond_date, bond10y_yield = _latest_treasury_yield(treasury_payload)
    code = str(candidate.get("code") or _akshare_value(spot_row, "代码", "code") or "").strip()
    name = str(candidate.get("name") or _akshare_value(spot_row, "名称", "name") or "").strip()
    price = _finite_number(_akshare_value(spot_row, "最新价", "最新", "price"))
    dividend_date, cash_dividend_per_10 = _latest_cash_dividend_per_10(dividend_rows)
    industry = str(_akshare_value(profile_row, "所属行业") or "未获取到").strip() or "未获取到"
    registered_capital_wan = _finite_number(_akshare_value(profile_row, "注册资金"))
    market_cap_yi = None
    if price is not None and registered_capital_wan is not None:
        market_cap_yi = price * registered_capital_wan / 10_000
    market_cap_yuan = _money_to_yuan(_akshare_value(profile_row, "总市值", "市值"))
    if market_cap_yuan is not None:
        market_cap_yi = market_cap_yuan / 100_000_000
    if price is None or market_cap_yi is None or not code or not name:
        raise UpstreamError("akshare-candidate")
    dividend_yield = cash_dividend_per_10 / 10 / price * 100
    ownership = _infer_fugui_ownership(
        _akshare_value(profile_row, "入选指数"),
        _akshare_value(profile_row, "公司名称"),
        _akshare_value(profile_row, "机构简介"),
    )
    return {
        "data": {
            "candidate": {
                "industry": industry,
                "code": code,
                "name": name,
                "ownership": ownership,
                "price": round(price, 2),
                "marketCapYi": round(market_cap_yi, 2),
                "dividendYield": round(dividend_yield, 2),
                "bond10yYield": round(bond10y_yield, 2),
                "bondDate": bond_date,
                "dividendDate": dividend_date,
            },
        },
        "proxySource": "AKShare A股代码名称 + 腾讯单标的行情 + 巨潮公司资料 + 分红明细 + 10年国债收益率",
    }


def normalize_fugui_candidate_from_tushare(candidate, daily_basic_rows, treasury_payload):
    """Normalize one automatically fetched Fugui strategy candidate from Tushare data."""
    bond_date, bond10y_yield = _latest_treasury_yield(treasury_payload)
    if not daily_basic_rows:
        raise UpstreamError("tushare-daily-basic")
    row = daily_basic_rows[0]
    code = candidate["code"]
    name = candidate["name"]
    price = _finite_number(_akshare_value(row, "close"))
    market_cap_wan = _finite_number(_akshare_value(row, "total_mv"))
    dividend_yield = _finite_number(_akshare_value(row, "dv_ttm"))
    if price is None or market_cap_wan is None or dividend_yield is None:
        raise UpstreamError("tushare-daily-basic")
    industry = candidate.get("industry") or "未获取到"
    ownership = _infer_fugui_ownership(name, industry)
    return {
        "data": {
            "candidate": {
                "industry": industry,
                "code": code,
                "name": name,
                "ownership": ownership,
                "price": round(price, 2),
                "marketCapYi": round(market_cap_wan / 10_000, 2),
                "dividendYield": round(dividend_yield, 2),
                "bond10yYield": round(bond10y_yield, 2),
                "bondDate": bond_date,
            },
        },
        "proxySource": "Tushare stock_basic + daily_basic(dv_ttm) + 10年国债收益率",
    }


def fetch_fugui_candidate_from_akshare(query, fetcher, ak_provider):
    """Fetch one stock by name and return auto-filled Fugui strategy fields from AKShare."""
    provider_was_injected = ak_provider is not None
    if ak_provider is None:
        try:
            import akshare as ak_provider
        except ImportError as error:
            raise UpstreamError("akshare") from error
    if provider_was_injected:
        code_name_frame = call_logged_data_api(
            "AKShare",
            "stock_info_a_code_name",
            ak_provider.stock_info_a_code_name,
            query=query,
        )
        code_name_rows = _akshare_rows(code_name_frame)
    else:
        code_name_rows = _cached_akshare_rows(
            _AKSHARE_CODE_NAME_CACHE,
            AKSHARE_CODE_NAME_CACHE_TTL_SECONDS,
            lambda: call_logged_data_api(
                "AKShare",
                "stock_info_a_code_name",
                ak_provider.stock_info_a_code_name,
                query=query,
            ),
        )
    candidate = _fugui_candidate_from_akshare_code_name(code_name_rows, query)
    spot_row = _fugui_quote_row_from_tencent(candidate["code"], fetcher)
    profile_frame = call_logged_data_api(
        "AKShare",
        "stock_profile_cninfo",
        lambda: ak_provider.stock_profile_cninfo(symbol=candidate["code"]),
        code=candidate["code"],
        name=candidate["name"],
    )
    profile_row = _fugui_profile_row(_akshare_rows(profile_frame), candidate["code"])
    dividend_frame = call_logged_data_api(
        "AKShare",
        "stock_history_dividend_detail",
        lambda: ak_provider.stock_history_dividend_detail(symbol=candidate["code"], indicator="分红"),
        code=candidate["code"],
        name=candidate["name"],
    )
    dividend_rows = _akshare_rows(dividend_frame)
    treasury = _cached_fugui_treasury(fetcher)
    return normalize_fugui_candidate_from_akshare(candidate, spot_row, profile_row, dividend_rows, treasury)


def fetch_fugui_candidate_from_tushare(query, fetcher, tushare_provider=None):
    """Fetch one stock by name and return auto-filled Fugui strategy fields from Tushare."""
    from tushare_client import TushareClient, TushareClientError, a_share_ts_code, frame_to_rows

    dashboard_env_path = Path(__file__).resolve().parents[1] / ".env"
    client = TushareClient(
        pro=tushare_provider,
        extra_env_paths=(dashboard_env_path,),
        logger=write_proxy_log,
    )
    try:
        stock_basic_frame = client.stock_basic(use_cache=tushare_provider is None)
    except TushareClientError as error:
        if error.source == "tushare-token":
            write_proxy_log("CONFIG_MISSING", provider="Tushare", key="TUSHARE_TOKEN")
        raise UpstreamError(error.source) from error
    except Exception as error:
        raise UpstreamError("tushare") from error
    stock_rows = frame_to_rows(stock_basic_frame)
    candidate = _fugui_candidate_from_tushare_stock_basic(stock_rows, query)
    ts_code = a_share_ts_code(candidate["code"])
    try:
        daily_basic_frame = client.daily_basic(ts_code=ts_code, use_cache=tushare_provider is None)
    except TushareClientError as error:
        raise UpstreamError(error.source) from error
    except Exception as error:
        raise UpstreamError("tushare") from error
    daily_rows = frame_to_rows(daily_basic_frame)
    treasury = _cached_fugui_treasury(fetcher)
    return normalize_fugui_candidate_from_tushare(candidate, daily_rows, treasury)


def fetch_fugui_candidate(name, fetcher=None, ak_provider=None, tushare_provider=None, provider="akshare"):
    """Fetch one stock by name and return auto-filled Fugui strategy fields."""
    if fetcher is None:
        fetcher = fetch_upstream
    query = str(name or "").strip()
    if not query or len(query) > 30:
        raise RouteError("invalid name")
    selected_provider = _fugui_provider(provider)
    write_proxy_log("FUGUI_REQUEST", provider=selected_provider, name=query)
    if selected_provider == "tushare":
        return fetch_fugui_candidate_from_tushare(query, fetcher, tushare_provider)
    return fetch_fugui_candidate_from_akshare(query, fetcher, ak_provider)


def fetch_stock_dividend_yield(secid, tushare_provider=None):
    """Fetch latest TTM dividend yield from Tushare daily_basic.dv_ttm."""
    from tushare_client import TushareClient, TushareClientError, a_share_ts_code, frame_to_rows

    code = _stock_code_from_secid(secid)
    dashboard_env_path = Path(__file__).resolve().parents[1] / ".env"
    client = TushareClient(
        pro=tushare_provider,
        extra_env_paths=(dashboard_env_path,),
        logger=write_proxy_log,
    )
    try:
        daily_basic_frame = client.daily_basic(
            ts_code=a_share_ts_code(code),
            use_cache=tushare_provider is None,
        )
    except TushareClientError as error:
        if error.source == "tushare-token":
            write_proxy_log("CONFIG_MISSING", provider="Tushare", key="TUSHARE_TOKEN")
        raise UpstreamError(error.source) from error
    except Exception as error:
        raise UpstreamError("tushare") from error
    rows = frame_to_rows(daily_basic_frame)
    if not rows:
        raise UpstreamError("tushare-daily-basic")
    row = rows[0]
    dividend_yield = _finite_number(_akshare_value(row, "dv_ttm"))
    if dividend_yield is None:
        raise UpstreamError("tushare-daily-basic")
    trade_date = str(_akshare_value(row, "trade_date") or "").strip()
    return {
        "data": {
            "secid": secid,
            "code": code,
            "dividendYieldTtm": round(dividend_yield, 2),
            "tradeDate": trade_date or None,
        },
        "proxySource": "Tushare daily_basic.dv_ttm",
    }


def prewarm_fugui_reference_data(fetcher=None):
    """Warm shared Fugui strategy reference data without blocking the dashboard."""
    if fetcher is None:
        fetcher = fetch_upstream
    try:
        import akshare as ak_provider
        _cached_akshare_rows(
            _AKSHARE_CODE_NAME_CACHE,
            AKSHARE_CODE_NAME_CACHE_TTL_SECONDS,
            ak_provider.stock_info_a_code_name,
        )
        _cached_fugui_treasury(fetcher)
        print("富贵策略公共数据已预热。")
    except Exception as error:
        print(f"富贵策略公共数据预热失败：{error}")


def _build_tencent_stock_quote_url(secid):
    symbol = _tencent_stock_symbol(secid)
    return _build_url(
        "https://ifzq.gtimg.cn/appstock/app/minute/query",
        {"code": symbol},
    )


def _tencent_stock_symbol(secid):
    secid = _stock_secid(secid)
    market, code = secid.split(".", 1)
    return f"{'sz' if market == '0' else 'sh'}{code}"


def normalize_tencent_stock_quote(payload, secid):
    """Normalize the fixed Tencent quote array used as the stock fallback."""
    symbol = _tencent_stock_symbol(secid)
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


def upstream_error_fields(error):
    """Record useful transport diagnostics without URLs, headers or credentials."""
    reason = getattr(error, "reason", error)
    return {
        "error": type(error).__name__,
        "reason_type": type(reason).__name__,
        "errno": getattr(reason, "errno", None),
        "http_status": error.code if isinstance(error, HTTPError) else None,
    }


def fetch_upstream(url, source):
    """Fetch one allowlisted upstream response with bounded resources."""
    host = urlparse(url).hostname or ""
    write_proxy_log("API_CALL", source=source, url=url)
    if host.endswith("csindex.com.cn"):
        referer = "https://www.csindex.com.cn/"
    elif host.endswith("finance.yahoo.com"):
        referer = "https://finance.yahoo.com/"
    else:
        referer = "https://quote.eastmoney.com/"
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
        # urlopen's global opener keeps the proxy settings from its first request.
        # Rebuild here so a long-running dashboard follows system proxy changes.
        with build_opener().open(request, timeout=12) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("response too large")
        encoding = "gb18030" if host == "vip.stock.finance.sina.com.cn" else "utf-8-sig"
        payload = parse_json_payload(body, encoding=encoding)
        write_proxy_log("API_OK", source=source, bytes=len(body), host=host)
        return payload
    except (HTTPError, URLError, TimeoutError, OSError, RemoteDisconnected, ValueError, json.JSONDecodeError) as error:
        write_proxy_log("API_FAIL", source=source, host=host, **upstream_error_fields(error))
        raise UpstreamError(source) from error


def fetch_upstream_text(url, source):
    """Fetch one allowlisted upstream text response with bounded resources."""
    host = urlparse(url).hostname or ""
    if host != "youzhiyouxing.cn":
        raise RouteError("invalid upstream host")
    write_proxy_log("API_CALL", source=source, url=url)
    request = Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
            "Referer": "https://youzhiyouxing.cn/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        },
    )
    try:
        with build_opener().open(request, timeout=12) as response:
            body = response.read(2_000_000 + 1)
        if len(body) > 2_000_000:
            raise ValueError("response too large")
        text = body.decode("utf-8", errors="replace")
        write_proxy_log("API_OK", source=source, bytes=len(body), host=host)
        return text
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        write_proxy_log("API_FAIL", source=source, host=host, **upstream_error_fields(error))
        raise UpstreamError(source) from error


def normalize_html_text(value):
    text = html.unescape(str(value))
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _percent_for_band(text, label):
    match = re.search(rf"{label}\s+(\d+(?:\.\d+)?)%", text)
    return float(match.group(1)) if match else None


def parse_youzhiyouxing_temperature(page_text):
    """Parse the public Youzhiyouxing market-temperature page."""
    text = normalize_html_text(page_text)
    updated_match = re.search(r"温度更新时间[:：]\s*([0-9年月日:\s]+)", text)
    block_match = re.search(
        r"全市场温度.*?(\d{1,3})°\s*(低估|中估|高估)\s*(温度(?:上升|下降|持平|不变))?",
        text,
    )
    if block_match is None:
        raise UpstreamError("youzhiyouxing-temperature")
    temperature = int(block_match.group(1))
    if temperature < 0 or temperature > 100:
        raise UpstreamError("youzhiyouxing-temperature")
    return {
        "data": {
            "temperature": temperature,
            "band": block_match.group(2),
            "trend": block_match.group(3) or "",
            "updatedText": updated_match.group(1).strip() if updated_match else "",
            "probabilities": {
                "low": _percent_for_band(text, "低估"),
                "mid": _percent_for_band(text, "中估"),
                "high": _percent_for_band(text, "高估"),
            },
            "sourceUrl": YOUZHIYOUXING_TEMPERATURE_URL,
        },
        "proxySource": "有知有行公开温度计",
    }


def fetch_youzhiyouxing_temperature(fetcher=fetch_upstream_text):
    text = fetcher(YOUZHIYOUXING_TEMPERATURE_URL, "youzhiyouxing-temperature")
    if not isinstance(text, str):
        raise UpstreamError("youzhiyouxing-temperature")
    return parse_youzhiyouxing_temperature(text)


def normalize_nasdaq100_chart(payload):
    chart = payload.get("chart") if isinstance(payload, dict) else None
    results = chart.get("result") if isinstance(chart, dict) else None
    if not isinstance(results, list) or not results:
        raise UpstreamError("nasdaq100")
    result = results[0]
    meta = result.get("meta") if isinstance(result, dict) else None
    indicators = result.get("indicators") if isinstance(result, dict) else None
    quotes = indicators.get("quote") if isinstance(indicators, dict) else None
    quote = quotes[0] if isinstance(quotes, list) and quotes else None
    closes = quote.get("close") if isinstance(quote, dict) else None
    if not isinstance(meta, dict) or not isinstance(closes, list):
        raise UpstreamError("nasdaq100")
    close_values = [
        float(value)
        for value in closes
        if isinstance(value, (int, float)) and math.isfinite(float(value)) and float(value) > 0
    ]
    current = meta.get("regularMarketPrice")
    if not isinstance(current, (int, float)) or not math.isfinite(float(current)) or float(current) <= 0:
        if not close_values:
            raise UpstreamError("nasdaq100")
        current = close_values[-1]
    current = float(current)
    high_point = max([current, *close_values]) if close_values else current
    quote_timestamp = meta.get("regularMarketTime")
    updated_at = int(quote_timestamp) if isinstance(quote_timestamp, (int, float)) else None
    updated_text = (
        datetime.fromtimestamp(updated_at, timezone.utc)
        .astimezone(timezone(timedelta(hours=8)))
        .strftime("%Y-%m-%d %H:%M")
        if updated_at else ""
    )
    drawdown = (current / high_point - 1) * 100 if high_point > 0 else 0
    return {
        "data": {
            "symbol": "^NDX",
            "name": "纳斯达克100指数",
            "currentPoint": round(current, 2),
            "highPoint": round(high_point, 2),
            "drawdownPercent": round(drawdown, 2),
            "updatedAt": updated_at,
            "updatedText": updated_text,
            "sourceUrl": "https://finance.yahoo.com/quote/%5ENDX/",
        },
        "proxySource": "Yahoo Finance",
    }


def fetch_nasdaq100_snapshot(fetcher=fetch_upstream):
    if fetcher is fetch_upstream:
        try:
            if __package__:
                from .nasdaq_westock import fetch_chart
            else:
                from nasdaq_westock import fetch_chart
            chart = fetch_chart(resolve_node_executable())
            snapshot = normalize_nasdaq100_chart(chart)
            snapshot["proxySource"] = "westock-data / 腾讯自选股"
            data = snapshot["data"]
            data.update(nasdaq100_daily_metrics(chart, data["currentPoint"]))
            data["returnHistory"] = nasdaq100_return_history(chart, "westock-data / 腾讯自选股（NDX）")
            data.update(sourceUrl="https://gu.qq.com/usNDX", updatedText=data["marketDate"] + "（美股交易日）",
                        updatedAt=None, highPointLabel="近2000个交易日最高收盘点",
                        peTtm=None, pePercentile10y=None,
                        valuationNote="PE-TTM及近十年分位待验证：WeStock未提供有效指数估值；独立估值源尚未通过日期和口径核验",
                        valuationSourceUrl="https://www.getstockcheck.com/zh/index/NDX.GI/")
            return snapshot
        except (ImportError, OSError, ValueError, KeyError, IndexError, subprocess.SubprocessError) as error:
            write_proxy_log("API_FAIL", source="westock-nasdaq100", error=type(error).__name__)
    snapshot = fetch_yahoo_nasdaq100_snapshot(fetcher)
    snapshot["data"]["quoteNote"] = "Yahoo Finance备用行情" if fetcher is fetch_upstream else "Yahoo Finance"
    return snapshot


def fetch_yahoo_nasdaq100_snapshot(fetcher=fetch_upstream):
    snapshot = normalize_nasdaq100_chart(fetcher(NASDAQ100_CHART_URL, "nasdaq100"))
    data = snapshot["data"]
    data.update(dayChangePercent=None, weekChangePercent=None, monthChangePercent=None,
                ma200=None, ma200DeviationPercent=None, yearDrawdownPercent=None,
                marketDate=None, peTtm=None, pePercentile10y=None,
                valuationNote="行情源不提供指数PE-TTM及同口径近十年估值序列，待验证")
    try:
        daily = fetcher(NASDAQ100_CHART_URL.replace("range=max", "range=2y"), "nasdaq100")
        data.update(nasdaq100_daily_metrics(daily, data["currentPoint"]))
        data["returnHistory"] = nasdaq100_return_history(daily, "Yahoo Finance（NDX，近两年日线）")
        daily_closes = daily["chart"]["result"][0]["indicators"]["quote"][0]["close"]
        data["highPoint"] = round(max([data["highPoint"], *[
            value for value in daily_closes
            if isinstance(value, (int, float)) and math.isfinite(value) and value > 0
        ]]), 2)
        data["drawdownPercent"] = round((data["currentPoint"] / data["highPoint"] - 1) * 100, 2)
    except (UpstreamError, ValueError, TypeError, KeyError, IndexError):
        data["dailyMetricsNote"] = "日线数据获取失败或不足，涨跌幅、均线及年内回撤待验证"
    return snapshot


def nasdaq100_return_history(payload, source):
    result = payload["chart"]["result"][0]
    meta = result["meta"]
    if meta.get("dataGranularity") != "1d":
        raise ValueError("daily bars required")
    zone = timezone(timedelta(seconds=meta.get("gmtoffset", -18000)))
    as_of = datetime.fromtimestamp(meta["regularMarketTime"], zone).date().isoformat()
    closes = result["indicators"]["quote"][0]["close"]
    prices = {}
    for stamp, close in zip(result.get("timestamp", []), closes):
        if not isinstance(close, (int, float)) or isinstance(close, bool) or not math.isfinite(close) or close <= 0:
            continue
        day = datetime.fromtimestamp(stamp, zone).date().isoformat()
        if day <= as_of:
            prices[day] = close
    points = sorted(prices.items())
    if len(points) < 2:
        raise ValueError("insufficient daily history")
    rows = []
    for year in sorted({int(day[:4]) for day, _ in points}):
        annual = [(day, close) for day, close in points if int(day[:4]) == year]
        first, last = annual[0][0], annual[-1][0]
        partial = first == points[0][0] and (int(first[5:7]) > 1 or int(first[8:]) > 7)
        status = "样本首年" if partial else "年内" if year == int(as_of[:4]) else "完整年度"
        peak, drawdown = annual[0][1], 0
        for _, close in annual:
            peak = max(peak, close)
            drawdown = min(drawdown, (close / peak - 1) * 100)
        months = []
        for month in range(1, 13):
            monthly = [(day, close) for day, close in annual if int(day[5:7]) == month]
            previous = [(day, close) for day, close in annual if int(day[5:7]) == month - 1]
            base = annual[0] if month == int(first[5:7]) else previous[-1] if previous else None
            entry = {"month": month, "value": None, "maxDrawdown": None, "status": "未开始" if f"{year}-{month:02d}" > as_of[:7] else "数据不足"}
            if len(monthly) >= 2:
                month_peak, month_drawdown = monthly[0][1], 0
                for _, close in monthly:
                    month_peak = max(month_peak, close)
                    month_drawdown = min(month_drawdown, (close / month_peak - 1) * 100)
                entry["maxDrawdown"] = month_drawdown
            if monthly and base:
                entry.update(value=(monthly[-1][1] / base[1] - 1) * 100,
                             startDate=base[0], endDate=monthly[-1][0],
                             status="月内累计" if last[:7] == as_of[:7] and month == int(last[5:7]) else "已统计")
            months.append(entry)
        if any(item["value"] is None for item in months[int(first[5:7])-1:int(last[5:7])]):
            status = "样本不足"
        rows.append({"year": year, "startDate": first, "endDate": last,
                     "annualReturn": (annual[-1][1] / annual[0][1] - 1) * 100,
                     "maxDrawdown": drawdown, "status": status, "monthlyReturns": months})
    return {"rows": rows, "firstDate": points[0][0], "lastDate": points[-1][0], "source": source,
            "returnConvention": "纳斯达克100指数价格收益：每年首个可用交易日收盘价至末个可用交易日收盘价；仅覆盖可用日线样本，首年可能不完整，不含分红再投资及汇率影响，非ETF收益",
            "drawdownConvention": "年内最大回撤按可用日收盘价相对此前峰值计算"}


def nasdaq100_daily_metrics(payload, current):
    result = payload["chart"]["result"][0]
    meta = result["meta"]
    if meta.get("dataGranularity") != "1d":
        raise ValueError("daily bars required")
    market_zone = timezone(timedelta(seconds=meta.get("gmtoffset", -18000)))
    as_of = datetime.fromtimestamp(meta["regularMarketTime"], market_zone).date()
    values = result["indicators"]["quote"][0]["close"]
    rows = {}
    for stamp, value in zip(result.get("timestamp", []), values):
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            continue
        day = datetime.fromtimestamp(stamp, market_zone).date()
        if day <= as_of:
            rows[day] = float(value)
    if not rows:
        raise ValueError("no dated daily closes")
    prior = sorted((day, value) for day, value in rows.items() if day < as_of)
    week_start = as_of - timedelta(days=as_of.weekday())
    month_start = as_of.replace(day=1)
    year_start = as_of.replace(month=1, day=1)

    def change_before(boundary):
        before = [value for day, value in prior if day < boundary]
        return round((current / before[-1] - 1) * 100, 2) if before else None

    # Include the current session once, replacing its daily bar if already present.
    closes = [value for _, value in prior] + [current]
    ma = sum(closes[-200:]) / 200 if len(closes) >= 200 else None
    year_values = [value for day, value in prior if day >= year_start] + [current]
    covered_year = any(day < year_start for day, _ in prior)
    return {
        "marketDate": as_of.isoformat(),
        "dayChangePercent": change_before(as_of),
        "weekChangePercent": change_before(week_start),
        "monthChangePercent": change_before(month_start),
        "ma200": round(ma, 2) if ma else None,
        "ma200DeviationPercent": round((current / ma - 1) * 100, 2) if ma else None,
        "yearDrawdownPercent": round((current / max(year_values) - 1) * 100, 2) if covered_year else None,
    }


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
        data = payload.get("data") if isinstance(payload, dict) else None
        rows = data.get("klines", []) if isinstance(data, dict) else []
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
        count = min(640 if secid == "0.159941" else 2000, remaining)
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


def market_turnover_error(source):
    messages = {
        "tushare-token": "未配置 Tushare Token，请设置 TUSHARE_TOKEN 环境变量，并从同一终端重新启动面板。",
        "tushare-dependency": "当前 Python 缺少 Tushare 依赖，请按 README 安装后重新启动面板。",
        "tushare-permission": "Tushare 未授权此次请求，请检查 Token 及 daily_info 接口权限。",
        "market-turnover-empty": "Tushare 未返回可配对的沪深成交额，请稍后刷新。",
    }
    status = 503 if source in {"tushare-token", "tushare-dependency", "tushare-permission"} else 502
    return status, messages.get(source, "Tushare 成交额取数失败，请稍后刷新；详细错误分类见 data/proxy.log。")


def fetch_market_turnover(client=None, now=None):
    from tushare_client import TushareClient, TushareClientError

    now = now or datetime.now(timezone(timedelta(hours=8)))
    today = now.date()
    start = today.replace(year=today.year - 1, day=min(today.day, 28)) if today.month == 2 else today.replace(year=today.year - 1)
    client = client or TushareClient(
        extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
        logger=write_proxy_log,
    )
    markets = {}
    try:
        for code in ("SH_MARKET", "SZ_MARKET"):
            rows = client.call("daily_info", ts_code=code, start_date=start.isoformat(), end_date=today.isoformat())
            dates = {}
            for row in rows:
                if row.get("ts_code") != code:
                    continue
                try:
                    day = datetime.strptime(str(row.get("trade_date")).replace("-", ""), "%Y%m%d").date()
                    amount = float(row.get("amount"))
                except (TypeError, ValueError):
                    continue
                if start <= day <= today and math.isfinite(amount) and amount > 0:
                    # Only completed daily statistics belong in historical extrema.
                    if day == today and (now.hour, now.minute) < (15, 30):
                        continue
                    dates[day.isoformat()] = amount
            markets[code] = dates
    except TushareClientError as error:
        source = "tushare-dependency" if isinstance(error.__cause__, ImportError) else error.source
        raise UpstreamError(source) from error
    shared = markets["SH_MARKET"].keys() & markets["SZ_MARKET"].keys()
    if not shared:
        raise UpstreamError("market-turnover-empty")
    return {
        "points": [{"date": day, "amount": round(markets["SH_MARKET"][day] + markets["SZ_MARKET"][day], 2)} for day in sorted(shared)],
        "today": today.isoformat(), "startDate": start.isoformat(),
        "incompleteDays": len(markets["SH_MARKET"].keys() ^ markets["SZ_MARKET"].keys()),
        "unit": "亿元", "scope": "沪深股票",
        "source": "Tushare daily_info · SH_MARKET + SZ_MARKET",
        "sourceUrl": "https://tushare.pro/document/2?doc_id=215",
    }


def fetch_market_margin(query=None, client=None, market_margin_tool=None):
    from mcp_server import get_market_margin
    from tushare_client import TushareClient, TushareClientError

    args = {}
    query = query or {}
    allowed = {"trade_date", "start_date", "end_date", "exchange_id", "limit", "_"}
    unknown = {key for key, value in query.items() if key not in allowed and any(str(item).strip() for item in value)}
    if unknown:
        raise RouteError("invalid margin query")
    for key in ("trade_date", "start_date", "end_date", "exchange_id", "limit"):
        value = _one(query, key, "")
        if value:
            args[key] = value
    if not any(key in args for key in ("trade_date", "start_date", "end_date")):
        today = datetime.now(timezone(timedelta(hours=8))).date()
        args["start_date"] = (today - timedelta(days=120)).isoformat()
        args["end_date"] = today.isoformat()
    try:
        payload = (market_margin_tool or get_market_margin)(
            client or TushareClient(
                extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
                logger=write_proxy_log,
            ),
            args,
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-margin")) from error
    return {
        **payload,
        "proxySource": "Tushare margin via tushare-data",
    }


def fetch_us_treasury_yield(query=None, client=None, us_treasury_tool=None):
    from mcp_server import get_us_treasury_yield
    from tushare_client import TushareClient, TushareClientError

    args = {}
    query = query or {}
    allowed = {"date", "start_date", "end_date", "limit", "_"}
    unknown = {key for key, value in query.items() if key not in allowed and any(str(item).strip() for item in value)}
    if unknown:
        raise RouteError("invalid us treasury query")
    for key in ("date", "start_date", "end_date", "limit"):
        value = _one(query, key, "")
        if value:
            args[key] = value
    if "date" not in args and not any(key in args for key in ("start_date", "end_date")):
        today = datetime.now(timezone(timedelta(hours=8))).date()
        args["start_date"] = (today - timedelta(days=120)).isoformat()
        args["end_date"] = today.isoformat()
    try:
        payload = (us_treasury_tool or get_us_treasury_yield)(
            client or TushareClient(
                extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
                logger=write_proxy_log,
            ),
            args,
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-us-tycr")) from error
    return {
        **payload,
        "proxySource": "Tushare us_tycr via tushare-data",
    }


def fetch_us_dollar_index(query=None, client=None, us_dollar_tool=None):
    from mcp_server import get_us_dollar_index
    from tushare_client import TushareClient, TushareClientError

    args = {}
    query = query or {}
    allowed = {"ts_code", "trade_date", "start_date", "end_date", "limit", "_"}
    unknown = {key for key, value in query.items() if key not in allowed and any(str(item).strip() for item in value)}
    if unknown:
        raise RouteError("invalid us dollar index query")
    for key in ("ts_code", "trade_date", "start_date", "end_date", "limit"):
        value = _one(query, key, "")
        if value:
            args[key] = value
    if "trade_date" not in args and not any(key in args for key in ("start_date", "end_date")):
        today = datetime.now(timezone(timedelta(hours=8))).date()
        args["start_date"] = (today - timedelta(days=120)).isoformat()
        args["end_date"] = today.isoformat()
    try:
        payload = (us_dollar_tool or get_us_dollar_index)(
            client or TushareClient(
                extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
                logger=write_proxy_log,
            ),
            args,
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-fx-daily")) from error
    return {
        **payload,
        "proxySource": "Tushare fx_daily via tushare-data",
    }


def fetch_usd_jpy(query=None, client=None, usd_jpy_tool=None):
    from mcp_server import get_usd_jpy_exchange_rate
    from tushare_client import TushareClient, TushareClientError

    args = {}
    query = query or {}
    allowed = {"ts_code", "trade_date", "start_date", "end_date", "risk_threshold", "limit", "_"}
    unknown = {key for key, value in query.items() if key not in allowed and any(str(item).strip() for item in value)}
    if unknown:
        raise RouteError("invalid usd jpy query")
    for key in ("ts_code", "trade_date", "start_date", "end_date", "risk_threshold", "limit"):
        value = _one(query, key, "")
        if value:
            args[key] = value
    if "trade_date" not in args and not any(key in args for key in ("start_date", "end_date")):
        today = datetime.now(timezone(timedelta(hours=8))).date()
        args["start_date"] = (today - timedelta(days=120)).isoformat()
        args["end_date"] = today.isoformat()
    try:
        payload = (usd_jpy_tool or get_usd_jpy_exchange_rate)(
            client or TushareClient(
                extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",),
                logger=write_proxy_log,
            ),
            args,
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-fx-daily")) from error
    return {
        **payload,
        "proxySource": "Tushare USDJPY fx_daily via tushare-data",
    }


def _finite_non_negative_number(value):
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError
    return number


def normalize_portfolio_payload(payload):
    """Validate and normalize local personal portfolio data."""
    if isinstance(payload, list):
        payload = {"holdings": payload}
    if not isinstance(payload, dict):
        raise ValueError

    holdings = payload.get("holdings", [])
    tracking_items = payload.get("trackingItems", [])
    if (
        not isinstance(holdings, list)
        or len(holdings) > 200
        or not isinstance(tracking_items, list)
        or len(tracking_items) > 200
    ):
        raise ValueError

    normalized_holdings = []
    for item in holdings:
        if not isinstance(item, dict):
            raise ValueError
        holding_id = str(item.get("id", ""))[:80]
        code = str(item.get("code", ""))[:12]
        name = str(item.get("name", ""))[:30]
        status = str(item.get("status", "持有"))
        note = str(item.get("note", ""))[:240]
        quantity = _finite_non_negative_number(item.get("quantity", 0))
        cost = _finite_non_negative_number(item.get("cost", 0))
        price = _finite_non_negative_number(item.get("price", 0))
        updated_at = int(item.get("updatedAt", 0))
        if (
            not holding_id
            or not code
            or not name
            or status not in PORTFOLIO_STATUSES
            or updated_at < 0
        ):
            raise ValueError
        normalized_holdings.append({
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

    normalized_tracking_items = []
    for item in tracking_items:
        if not isinstance(item, dict):
            raise ValueError
        tracking_id = str(item.get("id", ""))[:80]
        code = str(item.get("code", ""))[:12]
        name = str(item.get("name", ""))[:30]
        status = str(item.get("status", "观察"))
        updated_at = int(item.get("updatedAt", 0))
        if (
            not tracking_id
            or not name
            or status not in PORTFOLIO_STATUSES
            or updated_at < 0
        ):
            raise ValueError
        normalized_tracking_items.append({
            "id": tracking_id,
            "code": code,
            "name": name,
            "status": status,
            "thesis": str(item.get("thesis", ""))[:300],
            "riskLine": str(item.get("riskLine", ""))[:220],
            "nextAction": str(item.get("nextAction", ""))[:80],
            "reviewCondition": str(item.get("reviewCondition", ""))[:220],
            "updatedAt": updated_at,
        })

    return {
        "holdings": normalized_holdings,
        "trackingItems": normalized_tracking_items,
    }


def _safe_diary_slug(value, fallback="unknown"):
    slug = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(value or "")).strip()
    slug = re.sub(r"\s+", "", slug)
    slug = slug.strip(".")
    return (slug or fallback)[:60]


def normalize_review_diary_payload(payload):
    """Validate a review diary entry before writing a local Markdown file."""
    if not isinstance(payload, dict):
        raise ValueError
    code = str(payload.get("code", "")).strip()[:12]
    name = str(payload.get("name", "")).strip()[:30]
    status = str(payload.get("status", "")).strip()[:12]
    content = str(payload.get("content", "")).strip()
    tracking_id = str(payload.get("trackingId", "")).strip()[:80]
    if not name or not content or len(content) > 3000:
        raise ValueError
    if code and not re.fullmatch(r"[\w.-]{1,12}", code, re.ASCII):
        raise ValueError
    return {
        "trackingId": tracking_id,
        "code": code,
        "name": name,
        "status": status if status in PORTFOLIO_STATUSES else "",
        "content": content,
    }


def append_review_diary_entry(payload, diary_dir, now=None):
    """Append a dated review diary entry to one Markdown file per target."""
    normalized = normalize_review_diary_payload(payload)
    timestamp = now or datetime.now(timezone(timedelta(hours=8)))
    date_text = timestamp.strftime("%Y-%m-%d")
    time_text = timestamp.strftime("%H:%M")
    code_slug = _safe_diary_slug(normalized["code"], "no-code")
    name_slug = _safe_diary_slug(normalized["name"], "unknown")
    filename = f"{code_slug}-{name_slug}-复盘日记.md"
    target_dir = Path(diary_dir).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = (target_dir / filename).resolve()
    target_file.relative_to(target_dir)
    if target_file.exists():
        prefix = "\n\n"
    else:
        title_code = f"（{normalized['code']}）" if normalized["code"] else ""
        prefix = (
            f"# {normalized['name']}{title_code}复盘日记\n\n"
            "## 基本信息\n\n"
            f"- 标的：{normalized['name']}\n"
            f"- 代码：{normalized['code'] or '未填写'}\n\n"
        )
    status_line = f"- 跟踪状态：{normalized['status']}\n" if normalized["status"] else ""
    entry = (
        f"{prefix}## {date_text}\n\n"
        f"- 记录时间：{date_text} {time_text}（Asia/Shanghai）\n"
        f"{status_line}"
        f"- 来源：A股大盘面板 / 持仓跟踪 / 复盘日记\n\n"
        f"{normalized['content']}\n"
    )
    with target_file.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(entry)
    return {
        "date": date_text,
        "path": target_file.relative_to(target_dir.parents[1]).as_posix(),
        "obsidianUrl": obsidian_open_url(target_file),
    }


def obsidian_open_url(path):
    """Build an Obsidian URI for opening a local vault file."""
    return f"obsidian://open?path={quote(str(Path(path).resolve()), safe='')}"


def list_review_diaries(diary_dir):
    """Return local review diary summaries with individual dated entries."""
    target_dir = Path(diary_dir).resolve()
    if not target_dir.is_dir():
        return {"count": 0, "entryCount": 0, "items": []}
    items = []
    total_entries = 0
    for diary_file in target_dir.glob("*-复盘日记.md"):
        try:
            diary_file.resolve().relative_to(target_dir)
            text = diary_file.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError, ValueError):
            continue
        title_match = re.search(r"^#\s+(.+?)(?:（([^）]+)）)?复盘日记\s*$", text, re.MULTILINE)
        name = re.search(r"^- 标的：(.+)$", text, re.MULTILINE)
        code = re.search(r"^- 代码：(.+)$", text, re.MULTILINE)
        sections = list(re.finditer(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$", text, re.MULTILINE))
        if not sections:
            continue
        item_name = name.group(1).strip() if name else (title_match.group(1).strip() if title_match else diary_file.stem.replace("-复盘日记", ""))
        item_code = code.group(1).strip() if code and code.group(1).strip() != "未填写" else (title_match.group(2).strip() if title_match and title_match.group(2) else "")
        relative_path = diary_file.relative_to(target_dir.parents[1]).as_posix()
        obsidian_url = obsidian_open_url(diary_file)
        entries = []
        for index, section in enumerate(sections):
            body_end = sections[index + 1].start() if index + 1 < len(sections) else len(text)
            section_body = text[section.end():body_end]
            time_match = re.search(r"^- 记录时间：\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})", section_body, re.MULTILINE)
            status_match = re.search(r"^- 跟踪状态：(.+)$", section_body, re.MULTILINE)
            content = re.sub(r"^- (?:记录时间|跟踪状态|来源)：.*$", "", section_body, flags=re.MULTILINE).strip()
            content = re.sub(r"\s+", " ", content)
            entries.append({
                "date": section.group(1),
                "time": time_match.group(1) if time_match else "",
                "status": status_match.group(1).strip()[:12] if status_match else "",
                "excerpt": (content[:117] + "…") if len(content) > 118 else content,
                "name": item_name[:30],
                "code": item_code[:12],
                "path": relative_path,
                "obsidianUrl": obsidian_url,
            })
        entries.sort(key=lambda entry: (entry["date"], entry["time"], entry["name"]), reverse=True)
        latest_entry = entries[0]
        total_entries += len(entries)
        items.append({
            "name": item_name[:30],
            "code": item_code[:12],
            "entryCount": len(sections),
            "latestDate": latest_entry["date"],
            "latestTime": latest_entry["time"],
            "latestStatus": latest_entry["status"],
            "excerpt": latest_entry["excerpt"],
            "path": relative_path,
            "obsidianUrl": obsidian_url,
            "entries": entries,
        })
    items.sort(key=lambda item: (item["latestDate"], item["latestTime"], item["name"]), reverse=True)
    return {"count": len(items), "entryCount": total_entries, "items": items}


def _normalize_dashboard_href(value):
    href = unquote(str(value or "").strip()).replace("\\", "/")
    while href.startswith("../"):
        href = href[3:]
    return href.lstrip("/")


def delete_bbxm_featured_post(payload, vault_root):
    """Delete one BBXM daily source post from the allowlisted automation folder."""
    if not isinstance(payload, dict):
        raise ValueError
    relative_path = _normalize_dashboard_href(payload.get("href", ""))
    parts = relative_path.split("/")
    monthly_layout = (
        len(parts) == 6
        and re.fullmatch(r"\d{4}", parts[3])
        and re.fullmatch(r"(?:0[1-9]|1[0-2])", parts[4])
        and re.fullmatch(rf"{parts[3]}-{parts[4]}-\d{{2}}_\d{{6}}_.+\.md", parts[5])
    )
    daily_layout = (
        len(parts) == 6
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[3])
        and parts[4] == "冰冰小美"
    )
    if (
        len(parts) != 6
        or parts[0] != "sources"
        or parts[1] != "automations"
        or parts[2] != "BBXM每日汇总"
        or not (monthly_layout or daily_layout)
    ):
        raise ValueError
    filename = parts[5]
    if (
        not filename.endswith(".md")
        or filename in {"summary.md", "操作.md"}
        or "_解读" in filename
        or "/" in filename
        or "\\" in filename
    ):
        raise ValueError
    root = (Path(vault_root) / "sources" / "automations" / "BBXM每日汇总").resolve()
    target_file = (Path(vault_root) / relative_path).resolve()
    target_file.relative_to(root)
    if not target_file.is_file():
        raise FileNotFoundError
    target_file.unlink()
    return {"deleted": True, "path": target_file.relative_to(Path(vault_root).resolve()).as_posix()}


def _todo_quadrant_from_flags(important, urgent):
    if important == "是" and urgent == "是":
        return "重要且紧急"
    if important == "是" and urgent != "是":
        return "重要不紧急"
    if important != "是" and urgent == "是":
        return "紧急不重要"
    return "不重要且不紧急"


def _normalize_todo_text(value, max_length):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:max_length]


def _normalize_todo_action_payload(payload, expected_action):
    if not isinstance(payload, dict):
        raise ValueError
    action = str(payload.get("action", expected_action)).strip()
    if action != expected_action:
        raise ValueError
    if expected_action == "create":
        title = _normalize_todo_text(payload.get("title", ""), 72)
        if not title:
            raise ValueError
        quadrant = str(payload.get("quadrant", "")).strip() or TODO_QUADRANTS[0]
        if quadrant not in TODO_QUADRANT_FLAGS:
            raise ValueError
        status = str(payload.get("status", "")).strip() or TODO_STATUSES[0]
        if status not in TODO_STATUSES:
            raise ValueError
        return {
            "action": action,
            "title": title,
            "detail": _normalize_todo_text(payload.get("detail", ""), 150),
            "quadrant": quadrant,
            "status": status,
        }
    todo_id = str(payload.get("id", "")).strip()
    if not re.fullmatch(r"TODO-\d{3,}", todo_id):
        raise ValueError
    normalized = {"id": todo_id, "action": action}
    if expected_action == "move":
        quadrant = str(payload.get("quadrant", "")).strip()
        if quadrant not in TODO_QUADRANT_FLAGS:
            raise ValueError
        normalized["quadrant"] = quadrant
    if expected_action == "status":
        status = str(payload.get("status", "")).strip()
        if status not in TODO_STATUSES:
            raise ValueError
        normalized["status"] = status
    return normalized


def _todo_today_string(now=None):
    if isinstance(now, datetime):
        value = now if now.tzinfo else now.replace(tzinfo=timezone(timedelta(hours=8)))
        return value.astimezone(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    if isinstance(now, date):
        return now.strftime("%Y-%m-%d")
    return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")


def _normalize_todo_date_text(value):
    text = str(value or "").strip()
    match = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
    if not match:
        return ""
    year, month, day = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def _normalize_todo_json_item(item, index):
    if not isinstance(item, dict):
        return None
    title = _normalize_todo_text(item.get("title", item.get("需求事项", "")), 72)
    if not title:
        return None
    todo_id = str(item.get("id", item.get("需求编号", ""))).strip()
    if not re.fullmatch(r"TODO-\d{3,}", todo_id):
        todo_id = f"TODO-{index + 1:03d}"
    quadrant = str(item.get("quadrant", item.get("四象限标签", ""))).strip()
    if quadrant not in TODO_QUADRANT_FLAGS:
        important = str(item.get("important", item.get("重要性", ""))).strip()
        urgent = str(item.get("urgent", item.get("紧急性", ""))).strip()
        quadrant = _todo_quadrant_from_flags(important, urgent)
    status = str(item.get("status", item.get("状态", ""))).strip()
    if status not in TODO_STATUSES:
        status = TODO_STATUSES[0]
    normalized = {
        "id": todo_id,
        "title": title,
        "detail": _normalize_todo_text(item.get("detail", item.get("说明", "")), 150),
        "quadrant": quadrant,
        "status": status,
        "source": _normalize_todo_text(item.get("source", item.get("来源/备注", "")), 56),
        "createdAt": _normalize_todo_date_text(item.get("createdAt", item.get("创建时间", item.get("updatedAt", "")))),
        "updatedAt": _normalize_todo_date_text(item.get("updatedAt", item.get("更新时间", ""))),
    }
    due_date = _normalize_todo_date_text(item.get("dueDate", item.get("截止日期", "")))
    if due_date:
        normalized["dueDate"] = due_date
    owner = _normalize_todo_text(item.get("owner", item.get("负责人", "")), 18)
    if owner:
        normalized["owner"] = owner
    for key in ("completedAt", "archivedAt"):
        archived_date = _normalize_todo_date_text(item.get(key, ""))
        if archived_date:
            normalized[key] = archived_date
    archive_reason = _normalize_todo_text(item.get("archiveReason", ""), 40)
    if archive_reason:
        normalized["archiveReason"] = archive_reason
    return normalized


def _load_todo_json(todo_data_path):
    if not todo_data_path.is_file():
        return {"version": 1, "updatedAt": "", "items": [], "archive": []}
    payload = json.loads(todo_data_path.read_text(encoding="utf-8"))
    raw_items = payload if isinstance(payload, list) else payload.get("items", []) if isinstance(payload, dict) else []
    raw_archive = payload.get("archive", payload.get("archivedItems", [])) if isinstance(payload, dict) else []
    if not isinstance(raw_items, list):
        raise ValueError
    if not isinstance(raw_archive, list):
        raw_archive = []
    items = []
    archive = []
    for index, item in enumerate(raw_items):
        normalized = _normalize_todo_json_item(item, index)
        if normalized:
            if normalized.get("status") == "已完成":
                archived = dict(normalized)
                archived.setdefault("completedAt", archived.get("updatedAt") or archived.get("createdAt"))
                archived.setdefault("archivedAt", archived.get("completedAt", ""))
                archived.setdefault("archiveReason", "status-completed")
                archive.append(archived)
            else:
                items.append(normalized)
    for index, item in enumerate(raw_archive):
        normalized = _normalize_todo_json_item(item, len(items) + index)
        if normalized:
            normalized["status"] = "已完成"
            normalized.setdefault("completedAt", normalized.get("updatedAt") or normalized.get("createdAt"))
            normalized.setdefault("archivedAt", normalized.get("completedAt", ""))
            normalized.setdefault("archiveReason", "status-completed")
            archive.append(normalized)
    return {
        "version": 1,
        "updatedAt": _normalize_todo_date_text(payload.get("updatedAt", "")) if isinstance(payload, dict) else "",
        "items": items,
        "archive": archive,
    }


def _save_todo_json(todo_data_path, payload):
    todo_data_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = todo_data_path.with_name(f".{todo_data_path.name}.tmp")
    try:
        temporary_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(todo_data_path)
    except Exception:
        try:
            temporary_path.unlink()
        except OSError:
            pass
        raise


def _todo_counts_from_items(items):
    counts = {quadrant: 0 for quadrant in TODO_QUADRANTS}
    for item in items:
        quadrant = item.get("quadrant", "")
        if quadrant in counts and item.get("title"):
            counts[quadrant] += 1
    return counts


def _next_todo_json_id(items):
    maximum = 0
    for item in items:
        match = re.fullmatch(r"TODO-(\d+)", str(item.get("id", "")))
        if match:
            maximum = max(maximum, int(match.group(1)))
    return f"TODO-{maximum + 1:03d}"


def _find_todo_json_item(items, todo_id):
    for index, item in enumerate(items):
        if item.get("id") == todo_id:
            return index, item
    raise FileNotFoundError


def apply_todo_json_action(payload, todo_data_path, expected_action, now=None):
    """Create, move, update status, or delete one dashboard todo item in JSON."""
    normalized = _normalize_todo_action_payload(payload, expected_action)
    todo_data_path = Path(todo_data_path).resolve()
    today = _todo_today_string(now)
    with TODO_DATA_LOCK:
        data = _load_todo_json(todo_data_path)
        items = data["items"]
        archive = data.get("archive", [])

        if expected_action == "create":
            item = {
                "id": _next_todo_json_id([*items, *archive]),
                "title": normalized["title"],
                "detail": normalized["detail"],
                "quadrant": normalized["quadrant"],
                "status": normalized["status"],
                "source": TODO_CREATE_SOURCE,
                "createdAt": today,
                "updatedAt": today,
            }
            if normalized["status"] == "已完成":
                item["completedAt"] = today
                item["archivedAt"] = today
                item["archiveReason"] = "status-completed"
                archive.append(item)
                result_action = "archived"
            else:
                items.append(item)
                result_action = "created"
        else:
            item_index, item = _find_todo_json_item(items, normalized["id"])
            if expected_action == "delete":
                item = items.pop(item_index)
                result_action = "deleted"
            elif expected_action == "status":
                item["status"] = normalized["status"]
                item["updatedAt"] = today
                if normalized["status"] == "已完成":
                    item = items.pop(item_index)
                    item["completedAt"] = today
                    item["archivedAt"] = today
                    item["archiveReason"] = "status-completed"
                    archive.append(item)
                    result_action = "archived"
                else:
                    result_action = "status-updated"
            elif expected_action == "move":
                item["quadrant"] = normalized["quadrant"]
                item["updatedAt"] = today
                result_action = "moved"
            else:
                raise ValueError

        data["items"] = items
        data["archive"] = archive
        data["updatedAt"] = today
        _save_todo_json(todo_data_path, data)
        counts = _todo_counts_from_items(items)

    return {
        "id": item["id"],
        "title": item["title"],
        "action": result_action,
        "quadrant": item.get("quadrant", ""),
        "status": item.get("status", ""),
        "archived": result_action == "archived",
        "completedAt": item.get("completedAt", ""),
        "archivedAt": item.get("archivedAt", ""),
        "item": dict(item) if result_action == "archived" else None,
        "counts": counts,
        "total": sum(counts.values()),
        "archiveTotal": len(archive),
        "updatedAt": today,
    }


def _tracking_items_for_rerender(portfolio_file):
    try:
        payload = json.loads(Path(portfolio_file).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    if not isinstance(payload, dict):
        raise ValueError
    items = payload.get("trackingItems", [])
    if not isinstance(items, list) or len(items) > 200:
        raise ValueError
    normalized = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()[:30]
        code = re.sub(r"\D", "", str(item.get("code", "")))[:6]
        if name:
            normalized.append({"name": name, "code": code})
    return normalized


def _compact_target_name(value):
    return re.sub(r"\s+", "", str(value or "").strip())


def _report_date_key(path):
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?", path.name)
    if not match:
        return ""
    hour = match.group(4) or "00"
    minute = match.group(5) or "00"
    return "".join(match.group(index) for index in (1, 2, 3)) + hour + minute


def _is_equity_research_filename(path):
    name = path.name
    return (
        name.endswith(".md")
        and ("机构级决策研报" in name or "机构级研报" in name)
        and "资金面" not in name
    )


def _report_match_score(path, item):
    name = _compact_target_name(item.get("name"))
    code = item.get("code", "")
    filename = _compact_target_name(path.stem)
    score = 0
    if name and name in filename:
        score += 100
    if code and code in filename:
        score += 80
    if score:
        return score
    try:
        head = path.read_text(encoding="utf-8", errors="ignore")[:20000]
    except OSError:
        return 0
    compact_head = _compact_target_name(head)
    if name and name in compact_head:
        score += 40
    if code and code in head:
        score += 30
    return score


def find_tracking_report_markdown(item, targets_dir):
    candidates = []
    for path in Path(targets_dir).glob("*.md"):
        if not _is_equity_research_filename(path):
            continue
        score = _report_match_score(path, item)
        if score:
            candidates.append((score, _report_date_key(path), path))
    if not candidates:
        return None
    return sorted(candidates, key=lambda entry: (entry[0], entry[1], entry[2].name), reverse=True)[0][2]


def find_tracking_report_html(markdown_path, automations_dir, item):
    automations_dir = Path(automations_dir)
    exact_matches = list(automations_dir.rglob(f"{markdown_path.stem}.html"))
    if exact_matches:
        return sorted(exact_matches, key=lambda path: (_report_date_key(path), path.as_posix()), reverse=True)[0]
    candidates = []
    for path in automations_dir.rglob("*.html"):
        if "机构级决策研报" not in path.name or "资金面" in path.name:
            continue
        score = _report_match_score(path, item)
        if score:
            candidates.append((score, _report_date_key(path), path))
    if not candidates:
        return None
    matched_path = sorted(candidates, key=lambda entry: (entry[0], entry[1], entry[2].as_posix()), reverse=True)[0][2]
    return matched_path.parent / f"{markdown_path.stem}.html"


def resolve_node_executable(preferred=None):
    if preferred:
        return str(preferred)
    node = shutil.which("node")
    if node:
        return node
    bundled = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "node" / "bin" / "node.exe"
    if bundled.exists():
        return str(bundled)
    return "node"


def _vault_relative(path, vault_root):
    return Path(path).resolve().relative_to(Path(vault_root).resolve()).as_posix()


def rerender_tracking_reports(tracking_items, vault_root, renderer_path=None, node_executable=None, timeout_seconds=120, logger=None):
    vault_root = Path(vault_root).resolve()
    targets_dir = (vault_root / "workbench" / "targets").resolve()
    automations_dir = (vault_root / "sources" / "automations").resolve()
    renderer = Path(
        renderer_path or vault_root / ".agents" / "skills" / "bbxm-equity-research" / "scripts" / "render-report-html.cjs"
    ).resolve()
    node = resolve_node_executable(node_executable)
    updated = []
    skipped = []
    failed = []
    if not renderer.is_file():
        raise RuntimeError("report renderer unavailable")
    for index, item in enumerate(tracking_items, start=1):
        item_started_at = monotonic()
        if logger:
            logger(
                "TRACKING_REPORT_RERENDER_ITEM_START",
                index=index,
                total=len(tracking_items),
                name=item.get("name", ""),
                code=item.get("code", ""),
            )
        markdown_path = find_tracking_report_markdown(item, targets_dir)
        if markdown_path is None:
            skipped.append({"name": item.get("name", ""), "code": item.get("code", ""), "reason": "markdown not found"})
            if logger:
                logger(
                    "TRACKING_REPORT_RERENDER_ITEM_SKIP",
                    index=index,
                    total=len(tracking_items),
                    name=item.get("name", ""),
                    code=item.get("code", ""),
                    reason="markdown not found",
                )
            continue
        html_path = find_tracking_report_html(markdown_path, automations_dir, item)
        if html_path is None:
            skipped.append({
                "name": item.get("name", ""),
                "code": item.get("code", ""),
                "markdown": _vault_relative(markdown_path, vault_root),
                "reason": "html not found",
            })
            if logger:
                logger(
                    "TRACKING_REPORT_RERENDER_ITEM_SKIP",
                    index=index,
                    total=len(tracking_items),
                    name=item.get("name", ""),
                    code=item.get("code", ""),
                    markdown=_vault_relative(markdown_path, vault_root),
                    reason="html not found",
                )
            continue
        try:
            markdown_path.resolve().relative_to(targets_dir)
            html_path.resolve().relative_to(automations_dir)
            if logger:
                logger(
                    "TRACKING_REPORT_RERENDER_ITEM_RUN",
                    index=index,
                    total=len(tracking_items),
                    name=item.get("name", ""),
                    code=item.get("code", ""),
                    markdown=_vault_relative(markdown_path, vault_root),
                    html=_vault_relative(html_path, vault_root),
                )
            result = subprocess.run(
                [
                    node,
                    str(renderer),
                    "--input",
                    str(markdown_path),
                    "--output",
                    str(html_path),
                    "--vault-root",
                    str(vault_root),
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
            )
        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
            failed.append({
                "name": item.get("name", ""),
                "code": item.get("code", ""),
                "markdown": _vault_relative(markdown_path, vault_root),
                "html": _vault_relative(html_path, vault_root),
                "error": type(error).__name__,
            })
            if logger:
                logger(
                    "TRACKING_REPORT_RERENDER_ITEM_FAIL",
                    index=index,
                    total=len(tracking_items),
                    name=item.get("name", ""),
                    code=item.get("code", ""),
                    markdown=_vault_relative(markdown_path, vault_root),
                    html=_vault_relative(html_path, vault_root),
                    error=type(error).__name__,
                )
            continue
        if result.returncode != 0:
            error_text = (result.stderr or result.stdout or "renderer failed")[-500:]
            failed.append({
                "name": item.get("name", ""),
                "code": item.get("code", ""),
                "markdown": _vault_relative(markdown_path, vault_root),
                "html": _vault_relative(html_path, vault_root),
                "error": error_text,
            })
            if logger:
                logger(
                    "TRACKING_REPORT_RERENDER_ITEM_FAIL",
                    index=index,
                    total=len(tracking_items),
                    name=item.get("name", ""),
                    code=item.get("code", ""),
                    markdown=_vault_relative(markdown_path, vault_root),
                    html=_vault_relative(html_path, vault_root),
                    error=error_text,
                )
            continue
        updated.append({
            "name": item.get("name", ""),
            "code": item.get("code", ""),
            "markdown": _vault_relative(markdown_path, vault_root),
            "html": _vault_relative(html_path, vault_root),
        })
        if logger:
            logger(
                "TRACKING_REPORT_RERENDER_ITEM_OK",
                index=index,
                total=len(tracking_items),
                name=item.get("name", ""),
                code=item.get("code", ""),
                markdown=_vault_relative(markdown_path, vault_root),
                html=_vault_relative(html_path, vault_root),
                seconds=round(monotonic() - item_started_at, 3),
            )
    return {
        "total": len(tracking_items),
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
    }


def open_dividend_workbook(vault_root):
    root = Path(vault_root).resolve()
    workbook = (root / DIVIDEND_WORKBOOK_PATH).resolve()
    try:
        workbook.relative_to(root)
    except ValueError:
        raise FileNotFoundError("未找到中证红利每日信号.xlsx")
    if not workbook.is_file():
        raise FileNotFoundError("未找到中证红利每日信号.xlsx")
    if sys.platform == "win32":
        os.startfile(str(workbook))
    else:
        command = ["open", "-b", "com.microsoft.Excel"] if sys.platform == "darwin" else ["xdg-open"]
        subprocess.run([*command, str(workbook)], check=True, capture_output=True, timeout=10)
    return {"opened": True, "file": DIVIDEND_WORKBOOK_PATH.as_posix()}


def dividend_strategy_store():
    package_name = "dashboard_dividend_runtime"
    if package_name not in sys.modules:
        package = types.ModuleType(package_name)
        package.__path__ = [str(Path(__file__).resolve().parents[3] / ".agents/skills/zzhl-dividend-signal/scripts")]
        sys.modules[package_name] = package
    return importlib.import_module(package_name + ".strategy_store")


def read_dividend_backtest_data(vault_root, refresh_history=False, fetcher=None):
    """Read saved Excel; backtest requests refresh prices before returning data."""
    workbook = Path(vault_root) / DIVIDEND_WORKBOOK_PATH
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(workbook) as package:
        if sum(item.file_size for item in package.infolist()) > MAX_RESPONSE_BYTES:
            raise ValueError("Excel文件过大")
        strings = []
        if "xl/sharedStrings.xml" in package.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(package.read("xl/sharedStrings.xml"))]
        sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
        rows, row_numbers = [], []
        for source_row in sheet.findall("m:sheetData/m:row", ns):
            row = []
            for cell in source_row.findall("m:c", ns):
                column = 0
                letters = re.match(r"[A-Z]+", cell.get("r", ""))
                if not letters:
                    raise ValueError("Excel单元格位置无效")
                for letter in letters[0]:
                    column = column * 26 + ord(letter) - 64
                while len(row) < column:
                    row.append(None)
                inline, value = cell.find("m:is", ns), cell.find("m:v", ns)
                if cell.find("m:f", ns) is not None and (value is None or value.text is None):
                    raise ValueError("Excel公式没有计算缓存，请先在Excel中计算并保存")
                if cell.get("t") == "e":
                    raise ValueError("Excel包含错误单元格，请先修复后重试")
                text = "".join(inline.itertext()) if inline is not None else value.text if value is not None else None
                row[column - 1] = strings[int(text)] if cell.get("t") == "s" else text
            rows.append(row)
            row_numbers.append(int(source_row.get("r", len(rows))))
    history_path = workbook.parent / "中证红利指数日线.json"
    update = None
    if refresh_history:
        headers = rows[0] if rows else []
        try:
            date_column = headers.index("index_date__index_valuation_date")
        except ValueError as error:
            raise ValueError("Excel缺少指数估值日期字段") from error
        required_dates = {iso_date(row[date_column]) for row in rows[1:] if len(row) > date_column}
        required_dates.discard("")
        history, update = refresh_index_history(history_path, required_dates, fetcher or fetch_upstream, write_proxy_log)
    else:
        history = json.loads(history_path.read_text(encoding="utf-8-sig"))
    points = []
    for item in history.get("data", []):
        day, close = str(item.get("tradeDate", "")), item.get("close")
        if re.fullmatch(r"\d{8}", day) and isinstance(close, (int, float)) and not isinstance(close, bool) and math.isfinite(close) and close > 0:
            points.append({"date": f"{day[:4]}-{day[4:6]}-{day[6:8]}", "close": close})
    return {"schemaVersion": 1, "rows": rows, "rowNumbers": row_numbers, "indexPoints": points,
            "workbookUpdatedAt": datetime.fromtimestamp(workbook.stat().st_mtime, timezone.utc).isoformat(),
            "indexUpdate": update, "indexHistoryMeta": index_history_metadata(history_path, history, update)}


def read_dividend_view_data(vault_root):
    data = read_dividend_backtest_data(vault_root)
    payload = json.loads((Path(vault_root) / DIVIDEND_WORKBOOK_PATH.parent / "评分记录.json").read_text(encoding="utf-8-sig"))
    headers = data["rows"][0]
    history = []
    for values in data["rows"][2:]:
        row = dict(zip(headers, values))
        day, value = iso_date(row.get("index_date__index_valuation_date")), number(row.get("akshare_dividend_yield_2"))
        if day and value is not None:
            history.append({"date": day, "recordDate": iso_date(row.get("run_date__record_date")), "value": value, "headline": row.get("headline_signal") or ""})
    return {"schemaVersion": 1, "payload": payload, "yieldHistory": history, "indexHistory": data["indexPoints"], "indexHistoryMeta": data["indexHistoryMeta"]}


def read_dividend_task_monitor(vault_root):
    # Share validation with the daily runner; reading this endpoint never starts a task.
    dividend_strategy_store()
    module = importlib.import_module("dashboard_dividend_runtime.run_monitor")
    return module.monitor_payload(Path(vault_root) / DIVIDEND_WORKBOOK_PATH.parent)


def create_server(
    host="127.0.0.1",
    port=DEFAULT_PORT,
    fetcher=fetch_upstream,
    dashboard_path=None,
    portfolio_path=None,
    review_diary_dir=None,
    renderer_path=None,
    node_executable=None,
    dividend_strategy_path=None,
):
    """Create a loopback-only dashboard server with fixed proxy routes."""
    artifact = Path(dashboard_path or Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html").resolve()
    portfolio_file = Path(
        portfolio_path or artifact.parent / "data" / "portfolio.json"
    ).resolve()
    dividend_settings_file = Path(dividend_strategy_path or artifact.parents[2] / dividend_strategy_store().SETTINGS_RELATIVE_PATH).resolve()
    todo_data_file = (artifact.parent / "data" / "需求清单" / "todo.json").resolve()
    vault_root = artifact.parents[2]
    review_diary_dir = Path(
        review_diary_dir or vault_root / "workbench" / "journal"
    ).resolve()
    file_roots = {
        "/data/": (artifact.parent / "data").resolve(),
        "/sources/": (vault_root / "sources").resolve(),
        "/wiki/": (vault_root / "wiki").resolve(),
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
            try:
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                origin = self.headers.get("Origin", "")
                if origin in {"http://127.0.0.1:49888", "http://localhost:49888"}:
                    self.send_header("Access-Control-Allow-Origin", origin)
                    self.send_header("Vary", "Origin")
                self.end_headers()
                if body:
                    self.wfile.write(body)
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError) as error:
                write_proxy_log(
                    "CLIENT_DISCONNECT",
                    route=getattr(self, "path", ""),
                    status=status,
                    error=type(error).__name__,
                )

        def send_json(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self._send_bytes(status, body, "application/json; charset=utf-8")

        def send_dashboard(self):
            try:
                body = artifact.read_bytes()
            except OSError:
                return self.send_json(500, {"error": "dashboard artifact unavailable"})
            self._send_bytes(200, body, "text/html; charset=utf-8")
            launch_token = getattr(self.server, "browser_launch_token", None)
            if launch_token and parse_qs(urlparse(self.path).query).get("launch") == [launch_token]:
                write_proxy_log("BROWSER_PAGE_REQUESTED", path=urlparse(self.path).path,
                                launch=launch_token, result="dashboard-served")
                self.server.browser_page_requested.set()

        def send_dividend_strategy(self):
            try:
                settings = dividend_strategy_store().read_settings(dividend_settings_file)
            except (OSError, ValueError, TypeError):
                return self.send_json(500, {"error": "每日策略配置无法读取，请检查配置文件"})
            return self.send_json(200, settings)

        def save_dividend_strategy(self):
            origin = self.headers.get("Origin", "")
            port = self.server.server_address[1]
            if origin and origin not in {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}:
                return self.send_json(403, {"error": "请从本地看板应用每日策略"})
            if urlparse(self.path).query or self.headers.get_content_type() != "application/json":
                return self.send_json(400, {"error": "每日策略请求格式无效"})
            try:
                payload = self.read_todo_item_payload()
                if not isinstance(payload, dict) or set(payload) != {"strategy", "expectedRevision"}:
                    raise ValueError("每日策略请求格式无效")
                store = dividend_strategy_store()
                scoring = importlib.import_module(store.__package__ + ".scoring")
                saved = save_and_recalculate(payload["strategy"], payload["expectedRevision"], dividend_settings_file, vault_root, store, scoring, read_dividend_backtest_data)
            except dividend_strategy_store().StrategyConflict as error:
                return self.send_json(409, {"error": str(error), "settings": dividend_strategy_store().read_settings(dividend_settings_file)})
            except (ValueError, TypeError, KeyError, IndexError, UnicodeDecodeError, zipfile.BadZipFile, ET.ParseError) as error:
                return self.send_json(400, {"error": str(error) or "每日策略参数无效"})
            except OSError:
                return self.send_json(500, {"error": "保存并重算失败，原配置与数据已保留；请确认Excel文件可写后重试"})
            return self.send_json(200, saved)

        def send_portfolio(self):
            try:
                payload = normalize_portfolio_payload(
                    json.loads(portfolio_file.read_text(encoding="utf-8"))
                )
            except FileNotFoundError:
                payload = {"holdings": [], "trackingItems": []}
            except (OSError, ValueError, json.JSONDecodeError):
                return self.send_json(500, {"error": "portfolio data unavailable"})
            return self.send_json(200, payload)

        def send_review_diaries(self):
            try:
                payload = list_review_diaries(review_diary_dir)
            except OSError:
                return self.send_json(500, {"error": "review diaries unavailable"})
            return self.send_json(200, payload)

        def save_portfolio(self):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "invalid content length"})
            if content_length <= 0 or content_length > 262_144:
                return self.send_json(400, {"error": "invalid portfolio payload"})
            try:
                saved = normalize_portfolio_payload(
                    json.loads(self.rfile.read(content_length).decode("utf-8"))
                )
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

        def save_review_diary(self):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "invalid content length"})
            if content_length <= 0 or content_length > 16_384:
                return self.send_json(400, {"error": "invalid review diary payload"})
            try:
                saved = append_review_diary_entry(
                    json.loads(self.rfile.read(content_length).decode("utf-8")),
                    review_diary_dir,
                )
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                return self.send_json(400, {"error": "invalid review diary payload"})
            return self.send_json(200, saved)

        def rerender_tracking_reports(self):
            try:
                tracking_items = _tracking_items_for_rerender(portfolio_file)
                write_proxy_log(
                    "TRACKING_REPORT_RERENDER_START",
                    total=len(tracking_items),
                    portfolio=portfolio_file,
                )
                result = rerender_tracking_reports(
                    tracking_items,
                    vault_root,
                    renderer_path=renderer_path,
                    node_executable=node_executable,
                    logger=write_proxy_log,
                )
            except (OSError, RuntimeError, TypeError, ValueError, json.JSONDecodeError) as error:
                write_proxy_log(
                    "TRACKING_REPORT_RERENDER_FAIL",
                    error=type(error).__name__,
                )
                return self.send_json(500, {"error": "tracking report rerender failed"})
            write_proxy_log(
                "TRACKING_REPORT_RERENDER_OK",
                total=result["total"],
                updated=len(result["updated"]),
                skipped=len(result["skipped"]),
                failed=len(result["failed"]),
            )
            return self.send_json(200, result)

        def delete_featured_post(self):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "invalid content length"})
            if content_length <= 0 or content_length > 16_384:
                return self.send_json(400, {"error": "invalid featured post payload"})
            try:
                deleted = delete_bbxm_featured_post(
                    json.loads(self.rfile.read(content_length).decode("utf-8")),
                    vault_root,
                )
            except FileNotFoundError:
                return self.send_json(404, {"error": "featured post not found"})
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                return self.send_json(400, {"error": "invalid featured post payload"})
            return self.send_json(200, deleted)

        def read_todo_item_payload(self):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise ValueError
            if content_length <= 0 or content_length > 16_384:
                raise ValueError
            return json.loads(self.rfile.read(content_length).decode("utf-8"))

        def mutate_todo_item(self, expected_action, payload=None):
            try:
                if payload is None:
                    payload = self.read_todo_item_payload()
                result = apply_todo_json_action(
                    payload,
                    todo_data_file,
                    expected_action,
                )
            except FileNotFoundError:
                return self.send_json(404, {"error": "todo item not found"})
            except (TypeError, ValueError, json.JSONDecodeError, UnicodeDecodeError):
                return self.send_json(400, {"error": "invalid todo item payload"})
            except OSError:
                return self.send_json(500, {"error": "todo data update failed"})
            return self.send_json(200, result)

        def send_todo_items(self):
            try:
                with TODO_DATA_LOCK:
                    payload = _load_todo_json(todo_data_file)
            except (OSError, ValueError, json.JSONDecodeError, UnicodeDecodeError):
                return self.send_json(500, {"error": "todo data read failed"})
            return self.send_json(200, payload)

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
            if not requested_file.is_file() and prefix == "/data/":
                requested_name = Path(decoded_path).name
                requested_encoded_name = request_path.rsplit("/", 1)[-1]
                requested_monitor_match = re.match(
                    r"^(\d{6})-.+-(\d{4}-\d{2}-\d{2})\.md$",
                    requested_encoded_name,
                )
                requested_file = next(
                    (
                        candidate.resolve()
                        for candidate in root.iterdir()
                        if candidate.is_file()
                        and (
                            candidate.name == requested_name
                            or quote(candidate.name) == requested_encoded_name
                            or (
                                requested_monitor_match
                                and candidate.name.startswith(f"{requested_monitor_match.group(1)}-")
                                and candidate.name.endswith(f"-{requested_monitor_match.group(2)}.md")
                            )
                        )
                    ),
                    requested_file,
                )
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
            if parsed.path == "/api/dividend-strategy":
                return self.send_dividend_strategy()
            if parsed.path == "/api/dividend-task-monitor":
                if parsed.query:
                    return self.send_json(400, {"error": "任务监控只允许读取当前固定任务"})
                try:
                    return self.send_json(200, read_dividend_task_monitor(vault_root))
                except (OSError, ValueError, KeyError, TypeError) as error:
                    return self.send_json(422, {"error": f"任务监控读取失败：{error}"})
            if parsed.path == "/api/dividend-view-data":
                if parsed.query:
                    return self.send_json(400, {"error": "查看页只允许读取当前固定文件"})
                try:
                    return self.send_json(200, read_dividend_view_data(vault_root))
                except (OSError, ValueError, TypeError, KeyError, IndexError, zipfile.BadZipFile, ET.ParseError) as error:
                    return self.send_json(422, {"error": f"查看页数据读取失败：{error}"})
            if parsed.path == "/api/dividend-backtest-data":
                if parsed.query:
                    return self.send_json(400, {"error": "回测只允许读取当前固定Excel文件"})
                try:
                    payload = read_dividend_backtest_data(vault_root, refresh_history=True, fetcher=fetcher)
                except FileNotFoundError:
                    return self.send_json(404, {"error": "缺少当前Excel或本地指数日线文件"})
                except (OSError, ValueError, KeyError, IndexError, TypeError, zipfile.BadZipFile, ET.ParseError) as error:
                    return self.send_json(422, {"error": f"回测数据读取失败：{error}",
                                                "indexHistoryMeta": index_history_metadata(Path(vault_root) / DIVIDEND_WORKBOOK_PATH.parent / "中证红利指数日线.json")})
                return self.send_json(200, payload)
            if parsed.path == "/api/portfolio":
                return self.send_portfolio()
            if parsed.path == "/api/todos":
                return self.send_todo_items()
            if parsed.path == "/api/review-diaries":
                return self.send_review_diaries()
            if parsed.path.startswith("/data/") or parsed.path.startswith("/sources/") or parsed.path.startswith("/wiki/") or parsed.path.startswith("/workbench/"):
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
                elif parsed.path == "/api/stock-lookup":
                    payload = fetch_stock_lookup(_one(query, "name"))
                elif parsed.path == "/api/stock-quote":
                    secid = _one(query, "secid")
                    payload = fetch_stock_quote(secid, fetcher)
                elif parsed.path == "/api/stock-close-performance":
                    secid = _one(query, "secid")
                    payload = fetch_stock_close_performance(secid)
                elif parsed.path == "/api/stock-dividend-yield":
                    secid = _one(query, "secid")
                    payload = fetch_stock_dividend_yield(secid)
                elif parsed.path == "/api/market":
                    build_upstream_url(parsed.path, query)
                    payload = fetch_market_snapshot(fetcher)
                elif parsed.path == "/api/market-turnover":
                    if set(query) - {"_"}:
                        raise RouteError("invalid market turnover query")
                    payload = fetch_market_turnover()
                elif parsed.path == "/api/margin":
                    payload = fetch_market_margin(query)
                elif parsed.path == "/api/us-treasury-yield":
                    payload = fetch_us_treasury_yield(query)
                elif parsed.path == "/api/us-dollar-index":
                    payload = fetch_us_dollar_index(query)
                elif parsed.path == "/api/usd-jpy":
                    payload = fetch_usd_jpy(query)
                elif parsed.path == "/api/youzhiyouxing-temperature":
                    payload = fetch_youzhiyouxing_temperature(
                        fetch_upstream_text if fetcher is fetch_upstream else fetcher
                    )
                elif parsed.path == "/api/nasdaq100":
                    payload = fetch_nasdaq100_snapshot(fetcher)
                elif parsed.path == "/api/fugui-candidate":
                    payload = fetch_fugui_candidate(
                        _one(query, "name"),
                        fetcher,
                        provider=_one(query, "provider", "akshare"),
                    )
                else:
                    upstream_url = build_upstream_url(parsed.path, query)
                    payload = fetcher(upstream_url, source)
                return self.send_json(200, payload)
            except RouteError as error:
                return self.send_json(400, {"error": str(error)})
            except UpstreamError as error:
                write_proxy_log("UPSTREAM_FAIL", route=parsed.path, source=error.source)
                if parsed.path == "/api/market-turnover":
                    status, message = market_turnover_error(error.source)
                    return self.send_json(status, {"error": message, "source": error.source})
                return self.send_json(502, {"error": "upstream request failed", "source": error.source})
            except Exception as error:
                write_proxy_log("INTERNAL_FAIL", route=parsed.path, source=source, error=type(error).__name__)
                return self.send_json(500, {"error": "internal proxy error", "source": source})

        def do_OPTIONS(self):
            parsed = urlparse(self.path)
            origin = self.headers.get("Origin", "")
            if parsed.path not in {"/api/todos", "/api/todo-item"} or origin not in {
                "http://127.0.0.1:49888",
                "http://localhost:49888",
            }:
                return self.send_json(404, {"error": "not found"})
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_PUT(self):
            parsed = urlparse(self.path)
            if parsed.path != "/api/portfolio":
                return self.send_json(404, {"error": "not found"})
            return self.save_portfolio()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path == "/api/dividend-strategy":
                return self.save_dividend_strategy()
            if parsed.path == "/api/open-dividend-source":
                origin = self.headers.get("Origin", "")
                port = self.server.server_address[1]
                if origin and origin not in {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}:
                    return self.send_json(403, {"error": "请从本地看板打开信号源"})
                if parsed.query or self.headers.get_content_type() != "application/json":
                    return self.send_json(400, {"error": "invalid open source request"})
                try:
                    if self.read_todo_item_payload() != {}:
                        raise ValueError
                except (ValueError, UnicodeDecodeError):
                    return self.send_json(400, {"error": "invalid open source request"})
                try:
                    result = open_dividend_workbook(vault_root)
                except FileNotFoundError as error:
                    return self.send_json(404, {"error": str(error)})
                except (OSError, subprocess.SubprocessError):
                    message = "无法打开信号源，请确认 Microsoft Excel 已安装并可启动" if sys.platform == "darwin" else "无法打开信号源，请检查系统默认表格应用"
                    return self.send_json(500, {"error": message})
                return self.send_json(200, result)
            if parsed.path == "/api/review-diary":
                return self.save_review_diary()
            if parsed.path == "/api/tracking-rerender-reports":
                return self.rerender_tracking_reports()
            if parsed.path == "/api/todo-item":
                try:
                    payload = self.read_todo_item_payload()
                except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                    return self.send_json(400, {"error": "invalid todo item payload"})
                action = str(payload.get("action", "move")).strip() if isinstance(payload, dict) else ""
                expected_action = "create" if action == "create" else "move"
                return self.mutate_todo_item(expected_action, payload)
            return self.send_json(404, {"error": "not found"})

        def do_PATCH(self):
            parsed = urlparse(self.path)
            if parsed.path == "/api/todo-item":
                return self.mutate_todo_item("status")
            return self.send_json(404, {"error": "not found"})

        def do_DELETE(self):
            parsed = urlparse(self.path)
            if parsed.path == "/api/featured-post":
                return self.delete_featured_post()
            if parsed.path == "/api/todo-item":
                return self.mutate_todo_item("delete")
            return self.send_json(404, {"error": "not found"})

        def log_message(self, message_format, *args):
            sys.stderr.write("proxy: " + message_format % args + "\n")

    return ThreadingHTTPServer((host, port), DashboardHandler)


def open_dashboard_browser(url):
    """Use Launch Services on macOS; report browser launch failures explicitly."""
    if sys.platform == "darwin":
        write_proxy_log("BROWSER_OPEN_ATTEMPT", method="macos-open", url=url)
        try:
            subprocess.run(["/usr/bin/open", url], check=True, timeout=10,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            write_proxy_log("BROWSER_OPEN_ACCEPTED", method="macos-open", url=url, returncode=0)
            print(f"已请求默认浏览器打开：{url}")
            return True
        except (OSError, subprocess.SubprocessError) as error:
            detail = getattr(error, "stderr", None)
            if isinstance(detail, bytes):
                detail = detail.decode("utf-8", errors="replace")
            write_proxy_log("BROWSER_OPEN_ERROR", method="macos-open", url=url,
                            error_type=type(error).__name__, error=str(error),
                            returncode=getattr(error, "returncode", None),
                            detail=" ".join(detail.split()) if detail else None)
            write_proxy_log("BROWSER_OPEN_FALLBACK", method="python-webbrowser", url=url)
    write_proxy_log("BROWSER_OPEN_ATTEMPT", method="python-webbrowser", url=url)
    try:
        opened = webbrowser.open(url, new=2, autoraise=True)
    except (OSError, webbrowser.Error) as error:
        write_proxy_log("BROWSER_OPEN_ERROR", method="python-webbrowser", url=url,
                        error_type=type(error).__name__, error=str(error))
        opened = False
    if opened:
        write_proxy_log("BROWSER_OPEN_ACCEPTED", method="python-webbrowser", url=url, result=True)
        print(f"已请求浏览器打开：{url}")
    else:
        write_proxy_log("BROWSER_OPEN_FAILED", method="python-webbrowser", url=url, result=False)
        print(f"未能自动打开浏览器，请手动打开：{url}")
    return opened


def regular_chrome_command(url):
    """Target the everyday Chrome profile, rather than another automation instance."""
    executable = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    profile_root = Path.home() / "Library/Application Support/Google/Chrome"
    if not executable.is_file() or not profile_root.is_dir():
        return None
    try:
        preferences = Path.home() / "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist"
        handlers = plistlib.loads(preferences.read_bytes()).get("LSHandlers", [])
        default_http = next((item.get("LSHandlerRoleAll", "") for item in handlers
                             if item.get("LSHandlerURLScheme") == "http"), "")
        if default_http.lower() != "com.google.chrome":
            return None
    except (OSError, ValueError, TypeError, AttributeError):
        return None
    profile = "Default"
    try:
        local_state = json.loads((profile_root / "Local State").read_text(encoding="utf-8"))
        candidate = local_state.get("profile", {}).get("last_used", "Default")
        if isinstance(candidate, str) and re.fullmatch(r"Default|Profile [0-9]+", candidate):
            profile = candidate
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return [str(executable), f"--user-data-dir={profile_root}",
            f"--profile-directory={profile}", "--new-window", url]


def open_and_confirm_dashboard(server):
    host, port = server.server_address
    url = f"http://{host}:{port}/?launch={server.browser_launch_token}"
    command = regular_chrome_command(url) if sys.platform == "darwin" else None
    if command:
        write_proxy_log("BROWSER_OPEN_ATTEMPT", method="regular-chrome-profile", url=url,
                        window="new", profile=command[2].split("=", 1)[1])
        try:
            PROXY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with (PROXY_LOG_PATH.parent / "browser-launch.log").open("ab") as browser_log:
                subprocess.Popen(command, stdout=browser_log, stderr=browser_log,
                                 start_new_session=True)
        except OSError as error:
            write_proxy_log("BROWSER_OPEN_ERROR", method="regular-chrome-profile",
                            error_type=type(error).__name__, error=str(error))
        else:
            if server.browser_page_requested.wait(10):
                write_proxy_log("BROWSER_OPEN_CONFIRMED", method="regular-chrome-profile", url=url,
                                evidence="dashboard-page-request")
                print("日常 Chrome 已请求到面板页面，已指定新窗口打开。", flush=True)
                return True
        write_proxy_log("BROWSER_OPEN_FALLBACK", method="default-browser", url=url)
    open_dashboard_browser(url)
    if server.browser_page_requested.wait(4):
        write_proxy_log("BROWSER_OPEN_CONFIRMED", method="default-browser", url=url,
                        evidence="dashboard-page-request")
        return True
    write_proxy_log("BROWSER_OPEN_UNCONFIRMED", method="final", url=url)
    print(f"未收到本次启动的页面访问确认，请手动打开：http://{host}:{port}/", flush=True)
    return False


def serve_dashboard(server, todo_action_server):
    previous_handlers = {}
    exit_code = 0
    todo_thread = None

    def stop_service(signum, frame):
        write_proxy_log("SERVICE_SIGNAL", signal=signal.Signals(signum).name,
                        pid=os.getpid(), parent_pid=os.getppid())
        raise SystemExit(128 + signum)

    try:
        for signum in (signal.SIGTERM, signal.SIGHUP):
            previous_handlers[signum] = signal.signal(signum, stop_service)
        write_proxy_log("SERVICE_START", pid=os.getpid(), parent_pid=os.getppid(),
                        python=sys.executable, port=server.server_address[1],
                        todo_port=todo_action_server.server_address[1])
        todo_thread = Thread(target=todo_action_server.serve_forever, daemon=True)
        todo_thread.start()
        Thread(target=prewarm_fugui_reference_data, daemon=True).start()
        Thread(target=open_and_confirm_dashboard, args=(server,), daemon=True).start()
        server.serve_forever()
    except KeyboardInterrupt:
        exit_code = 130
        write_proxy_log("SERVICE_SIGNAL", signal="SIGINT", pid=os.getpid(), parent_pid=os.getppid())
    except SystemExit as error:
        exit_code = error.code if isinstance(error.code, int) else 1
    except BaseException as error:
        exit_code = 1
        write_proxy_log("SERVICE_ERROR", error=type(error).__name__)
        raise
    finally:
        # shutdown() must not run on the main server's own serving thread.
        if todo_thread is not None and todo_thread.is_alive():
            todo_action_server.shutdown()
        todo_action_server.server_close()
        server.server_close()
        write_proxy_log("SERVICE_STOP", pid=os.getpid(), exit_code=exit_code)
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)
    return exit_code


def main():
    try:
        server = create_server()
        todo_action_server = create_server(port=TODO_ACTION_PORT)
    except OSError as error:
        print(f"本地端口 {DEFAULT_PORT} / {TODO_ACTION_PORT} 启动失败：{error}")
        print("请关闭旧的大盘面板启动窗口，或结束占用这些端口的本地程序后重试。")
        try:
            server.server_close()
        except (NameError, OSError):
            pass
        return 1
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    print(f"A 股大盘面板已启动：{url}")
    print(f"需求清单轻量服务已启动：http://{host}:{TODO_ACTION_PORT}/")
    print("关闭此窗口或按 Ctrl+C 可停止本地数据服务。")
    server.browser_launch_token = os.urandom(12).hex()
    server.browser_page_requested = Event()
    return serve_dashboard(server, todo_action_server)


if __name__ == "__main__":
    sys.exit(main())
