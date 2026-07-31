"""Local same-origin data proxy for the A-share market dashboard."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.client import RemoteDisconnected
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import html
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
from threading import Thread
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen
import webbrowser


VENDOR_PYTHON_PATH = Path(__file__).resolve().parents[1] / "vendor" / "python"
if VENDOR_PYTHON_PATH.exists():
    sys.path.append(str(VENDOR_PYTHON_PATH))
TUSHARE_CLIENT_PATH = Path(__file__).resolve().parents[2] / "tushare-data" / "scripts"
if TUSHARE_CLIENT_PATH.exists() and str(TUSHARE_CLIENT_PATH) not in sys.path:
    sys.path.append(str(TUSHARE_CLIENT_PATH))

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
    "/api/stock-quote": "stock-quote",
    "/api/youzhiyouxing-temperature": "youzhiyouxing-temperature",
    "/api/nasdaq100": "nasdaq100",
    "/api/fugui-candidate": "fugui-candidate",
    "/api/review-diary": "review-diary",
    "/api/tracking-rerender-reports": "tracking-rerender-reports",
    "/api/featured-post": "featured-post",
}
YOUZHIYOUXING_TEMPERATURE_URL = "https://youzhiyouxing.cn/data"
NASDAQ100_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?range=max&interval=1d"
PORTFOLIO_STATUSES = {"持有", "观察", "计划加仓", "计划减仓"}
DEFAULT_PORT = 49888
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
        with urlopen(request, timeout=12) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("response too large")
        encoding = "gb18030" if host == "vip.stock.finance.sina.com.cn" else "utf-8-sig"
        payload = parse_json_payload(body, encoding=encoding)
        write_proxy_log("API_OK", source=source, bytes=len(body), host=host)
        return payload
    except (HTTPError, URLError, TimeoutError, OSError, RemoteDisconnected, ValueError, json.JSONDecodeError) as error:
        write_proxy_log("API_FAIL", source=source, host=host, error=type(error).__name__)
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
        with urlopen(request, timeout=12) as response:
            body = response.read(2_000_000 + 1)
        if len(body) > 2_000_000:
            raise ValueError("response too large")
        text = body.decode("utf-8", errors="replace")
        write_proxy_log("API_OK", source=source, bytes=len(body), host=host)
        return text
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        write_proxy_log("API_FAIL", source=source, host=host, error=type(error).__name__)
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
    return normalize_nasdaq100_chart(fetcher(NASDAQ100_CHART_URL, "nasdaq100"))


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
            client or TushareClient(logger=write_proxy_log),
            args,
        )
    except TushareClientError as error:
        raise UpstreamError(getattr(error, "source", "tushare-margin")) from error
    return {
        **payload,
        "proxySource": "Tushare margin via tushare-data",
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
    }


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
    if (
        len(parts) != 6
        or parts[0] != "sources"
        or parts[1] != "automations"
        or parts[2] != "BBXM每日汇总"
        or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[3])
        or parts[4] != "冰冰小美"
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


def create_server(
    host="127.0.0.1",
    port=DEFAULT_PORT,
    fetcher=fetch_upstream,
    dashboard_path=None,
    portfolio_path=None,
    review_diary_dir=None,
    renderer_path=None,
    node_executable=None,
):
    """Create a loopback-only dashboard server with fixed proxy routes."""
    artifact = Path(dashboard_path or Path(__file__).resolve().parents[1] / "a-share-market-dashboard.html").resolve()
    portfolio_file = Path(
        portfolio_path or artifact.parent / "data" / "portfolio.json"
    ).resolve()
    vault_root = artifact.parents[2]
    review_diary_dir = Path(
        review_diary_dir or vault_root / "workbench" / "targets"
    ).resolve()
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
            try:
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
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
            return self._send_bytes(200, body, "text/html; charset=utf-8")

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
                elif parsed.path == "/api/margin":
                    payload = fetch_market_margin(query)
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
                return self.send_json(502, {"error": "upstream request failed", "source": error.source})
            except Exception as error:
                write_proxy_log("INTERNAL_FAIL", route=parsed.path, source=source, error=type(error).__name__)
                return self.send_json(500, {"error": "internal proxy error", "source": source})

        def do_PUT(self):
            parsed = urlparse(self.path)
            if parsed.path != "/api/portfolio":
                return self.send_json(404, {"error": "not found"})
            return self.save_portfolio()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path == "/api/review-diary":
                return self.save_review_diary()
            if parsed.path == "/api/tracking-rerender-reports":
                return self.rerender_tracking_reports()
            return self.send_json(404, {"error": "not found"})

        def do_DELETE(self):
            parsed = urlparse(self.path)
            if parsed.path == "/api/featured-post":
                return self.delete_featured_post()
            return self.send_json(404, {"error": "not found"})

        def log_message(self, message_format, *args):
            sys.stderr.write("proxy: " + message_format % args + "\n")

    return ThreadingHTTPServer((host, port), DashboardHandler)


def main():
    try:
        server = create_server()
    except OSError as error:
        print(f"固定端口 {DEFAULT_PORT} 启动失败：{error}")
        print("请关闭旧的大盘面板启动窗口，或结束占用该端口的本地程序后重试。")
        return
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    print(f"A 股大盘面板已启动：{url}")
    print("关闭此窗口或按 Ctrl+C 可停止本地数据服务。")
    Thread(target=prewarm_fugui_reference_data, daemon=True).start()
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止本地数据服务……")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
