"""Yahoo chart Python interface: fixed symbols, dated prices, no credentials."""

from copy import deepcopy
from datetime import date, datetime, time as daytime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from threading import Lock
import time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

BASE = "https://query1.finance.yahoo.com/v8/finance/chart/"
SOURCE = "Yahoo Finance chart"
CACHE_DIR = Path(__file__).resolve().parents[1] / "data/Yahoo/cache"
SYMBOLS = {
    "^NDX": ("INDEX", "USD", "America/New_York"),
    "^VIX": ("INDEX", "USD", "America/Chicago"),
    "DX-Y.NYB": ("INDEX", "USD", "America/New_York"),
    "CNY=X": ("CURRENCY", "CNY", "Europe/London"),
    "JPY=X": ("CURRENCY", "JPY", "Europe/London"),
    "000922.SS": ("INDEX", "CNY", "Asia/Shanghai"),
}
LIQUIDITY_KEYS = {"us_VIX", "us_DXY_HISTORY", "us_DXY"}
RISK_SYMBOLS = {"pending-capital-0": ("DX-Y.NYB", "美元指数DXY", "点"),
                "pending-capital-1": ("CNY=X", "美元兑人民币市场汇率", "元"),
                "pending-capital-2": ("JPY=X", "美元兑日元市场汇率", "日元")}
_MEMORY = {}
_LOCK = Lock()


class YahooDataError(ValueError):
    """Fixed diagnostics only; never serialize raw network exception text."""


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def source_url(symbol):
    return "https://finance.yahoo.com/quote/" + quote(symbol, safe="") + "/history/"


def symbol_identity(symbol):
    if symbol in SYMBOLS:
        return SYMBOLS[symbol]
    if re.fullmatch(r"(?:[569]\d{5}\.SS|[0123]\d{5}\.SZ)", symbol):
        return "EQUITY", "CNY", "Asia/Shanghai"
    raise YahooDataError("unsupported_symbol")


def request_json(url):
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urlopen(request, timeout=15) as response:
            body = response.read(10_000_001)
        if len(body) > 10_000_000:
            raise YahooDataError("response_too_large")
        return json.loads(body)
    except YahooDataError:
        raise
    except Exception:
        raise YahooDataError("yahoo_request_failed") from None


def parse_chart(payload, symbol, now=None):
    """Check identity and daily granularity before any downstream calculations."""
    now = now or datetime.now(timezone.utc)
    expected_type, currency, zone_name = symbol_identity(symbol)
    chart = payload.get("chart", {}) if isinstance(payload, dict) else {}
    if not isinstance(chart, dict):
        raise YahooDataError("invalid_chart_result")
    results = chart.get("result")
    if chart.get("error") or not isinstance(results, list) or len(results) != 1:
        raise YahooDataError("invalid_chart_result")
    result = results[0]
    if not isinstance(result, dict):
        raise YahooDataError("invalid_chart_result")
    meta = result.get("meta", {})
    if not isinstance(meta, dict):
        raise YahooDataError("invalid_chart_metadata")
    if (meta.get("symbol") != symbol or meta.get("instrumentType") != expected_type
            or meta.get("currency") != currency or meta.get("exchangeTimezoneName") != zone_name
            or meta.get("dataGranularity") != "1d"):
        raise YahooDataError("chart_identity_or_frequency_mismatch")
    stamp, price = meta.get("regularMarketTime"), meta.get("regularMarketPrice")
    if not finite(stamp) or stamp <= 0 or stamp > now.timestamp() + 120 or not finite(price) or price <= 0:
        raise YahooDataError("invalid_quote_or_timestamp")
    indicators = result.get("indicators", {})
    if not isinstance(indicators, dict) or not isinstance(result.get("events", {}), dict):
        raise YahooDataError("invalid_chart_fields")
    quotes = indicators.get("quote", [])
    stamps = result.get("timestamp", [])
    if not isinstance(quotes, list) or len(quotes) != 1 or not isinstance(quotes[0], dict) or not isinstance(stamps, list):
        raise YahooDataError("missing_daily_bars")
    closes = quotes[0].get("close", [])
    if not isinstance(closes, list) or len(closes) != len(stamps):
        raise YahooDataError("misaligned_daily_bars")
    zone = ZoneInfo(zone_name)
    points = {}
    for timestamp, close in zip(stamps, closes):
        if not finite(timestamp) or timestamp <= 0:
            raise YahooDataError("invalid_bar_timestamp")
        if timestamp > now.timestamp() + 120 or close is None:
            continue
        if not finite(close) or close <= 0:
            raise YahooDataError("invalid_close")
        day = datetime.fromtimestamp(timestamp, zone).date().isoformat()
        if day in points and points[day]["close"] != close:
            raise YahooDataError("conflicting_daily_bars")
        points[day] = {"date": day, "close": close, "timestamp": timestamp}
    if not points:
        raise YahooDataError("empty_daily_prices")
    return {"meta": deepcopy(meta), "daily": [points[d] for d in sorted(points)],
            "events": deepcopy(result.get("events", {})), "symbol": symbol,
            "source": SOURCE, "sourceUrl": source_url(symbol), "chartPayload": deepcopy(payload)}


def completed_points(chart, now=None):
    now = now or datetime.now(timezone.utc)
    meta = chart["meta"]
    zone = ZoneInfo(meta["exchangeTimezoneName"])
    local = now.astimezone(zone)
    regular = meta.get("currentTradingPeriod", {}).get("regular", {})
    end = regular.get("end")
    start = regular.get("start")
    current_date = datetime.fromtimestamp(start, zone).date() if finite(start) else None
    # Yahoo bars use the exchange-local session date. Never treat a bar's opening
    # timestamp as proof that its closing price is final.
    today_complete = bool(current_date == local.date() and finite(end) and now.timestamp() >= end + 900)
    return [p for p in chart["daily"] if p["date"] < local.date().isoformat()
            or (p["date"] == local.date().isoformat() and today_complete)]


class YahooChartClient:
    def __init__(self, fetcher=request_json):
        self.fetcher = fetcher

    def chart(self, symbol, *, range="2y", start_date=None, now=None, use_cache=True):
        symbol_identity(symbol)
        now = now or datetime.now(timezone.utc)
        params = {"interval": "1d", "events": "div,splits"}
        if start_date:
            start = date.fromisoformat(start_date)
            end = now.date() + timedelta(days=1)
            params.update(period1=int(datetime.combine(start, daytime(), timezone.utc).timestamp()),
                          period2=int(datetime.combine(end, daytime(), timezone.utc).timestamp()))
        else:
            if range not in ("1d", "2y"):
                raise YahooDataError("unsupported_range")
            params["range"] = range
        url = BASE + quote(symbol, safe="") + "?" + urlencode(params)
        cache_key = url
        cached = None
        if use_cache and self.fetcher is request_json:
            with _LOCK:
                cached = _MEMORY.get(cache_key)
        hit = cached is not None and time.monotonic() - cached[0] < 60
        raw = deepcopy(cached[1]) if hit else self.fetcher(url)
        parsed = parse_chart(raw, symbol, now)
        fetched_at = cached[2] if hit else datetime.now(timezone.utc).isoformat()
        if use_cache and self.fetcher is request_json and not hit:
            with _LOCK:
                _MEMORY[cache_key] = (time.monotonic(), deepcopy(raw), fetched_at)
        parsed["fetchedAt"] = fetched_at
        return parsed


def daily_chart_payload(chart, now=None):
    points = completed_points(chart, now)
    if len(points) < 2:
        raise YahooDataError("insufficient_completed_history")
    result = deepcopy(chart["chartPayload"])
    node = result["chart"]["result"][0]
    node["timestamp"] = [p["timestamp"] for p in points]
    node["indicators"]["quote"] = [{"close": [p["close"] for p in points]}]
    # Historical statistics stop at the last completed session. Live quote
    # changes and MA use the separate original quote metadata.
    node["meta"]["regularMarketTime"] = points[-1]["timestamp"]
    node["meta"]["regularMarketPrice"] = points[-1]["close"]
    return result


def stock_quote(secid, client=None, now=None):
    if not re.fullmatch(r"[01]\.\d{6}", secid):
        raise YahooDataError("invalid_secid")
    market, code = secid.split(".")
    symbol = code + (".SS" if market == "1" else ".SZ")
    chart = (client or YahooChartClient()).chart(symbol, range="1d", now=now)
    meta = chart["meta"]
    previous = meta.get("chartPreviousClose")
    if not finite(previous) or previous <= 0:
        raise YahooDataError("missing_previous_close")
    price = meta["regularMarketPrice"]
    return {"data": {"secid": secid, "code": code, "name": meta.get("longName") or meta.get("shortName") or code,
                     "price": price, "prevClose": previous, "changePercent": (price / previous - 1) * 100,
                     "quoteTimestamp": int(meta["regularMarketTime"])},
            "proxySource": SOURCE + "（参考报价，可能延迟）", "sourceUrl": chart["sourceUrl"]}


def dividend_events(now=None, client=None):
    now = now or datetime.now(timezone.utc)
    chart = (client or YahooChartClient()).chart("515450.SS", start_date="2020-01-01", now=now)
    dividends = chart["events"].get("dividends")
    if not isinstance(dividends, dict) or not dividends:
        raise YahooDataError("no_verified_dividend_events")
    events = {}
    for event in dividends.values():
        stamp, cash = event.get("date"), event.get("amount")
        if not finite(stamp) or not finite(cash) or cash <= 0:
            raise YahooDataError("invalid_dividend_event")
        day = datetime.fromtimestamp(stamp, ZoneInfo("Asia/Shanghai")).date().isoformat()
        if stamp > now.timestamp():
            continue
        if day in events and events[day]["cashPerShare"] != cash:
            raise YahooDataError("conflicting_dividend_events")
        events[day] = {"exDate": day, "cashPerShare": cash, "payDate": None}
    if not events:
        raise YahooDataError("no_past_dividend_events")
    return [events[d] for d in sorted(events)]


def liquidity_adapters(client=None, now=None):
    service = client or YahooChartClient()
    def series(symbol, live=False):
        chart = service.chart(symbol, now=now)
        if live:
            meta = chart["meta"]
            day = datetime.fromtimestamp(meta["regularMarketTime"], ZoneInfo(meta["exchangeTimezoneName"])).date().isoformat()
            points = [{"date": day, "value": meta["regularMarketPrice"]}]
        else:
            points = [{"date": p["date"], "value": p["close"]} for p in completed_points(chart, now)]
        return points, SOURCE + " · " + symbol + ("（参考报价，可能延迟）" if live else " · 日收盘"), chart["sourceUrl"]
    return {"us_VIX": [lambda: series("^VIX")], "us_DXY_HISTORY": [lambda: series("DX-Y.NYB")],
            "us_DXY": [lambda: series("DX-Y.NYB", True)]}


def risk_readings(client=None, now=None, cache_dir=CACHE_DIR):
    service = client or YahooChartClient()
    output = {}
    for key, (symbol, name, unit) in RISK_SYMBOLS.items():
        path = Path(cache_dir) / (key + ".json")
        try:
            original = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(original, dict) or original.get("id") != key or original.get("source") != SOURCE:
                original = {}
        except (OSError, ValueError):
            original = {}
        try:
            chart = service.chart(symbol, now=now)
            points = completed_points(chart, now)
            if len(points) < 2:
                raise YahooDataError("insufficient_completed_history")
            last, prior = points[-1], points[-2]
            age = ((now or datetime.now(timezone.utc)).date() - date.fromisoformat(last["date"])).days
            result = {"id": key, "name": name, "value": last["close"], "previous": prior["close"],
                      "date": last["date"], "previousDate": prior["date"], "unit": unit,
                      "source": SOURCE, "code": symbol, "fetchedAt": chart["fetchedAt"],
                      "status": "ok" if age <= 7 else "stale", "error": "" if age <= 7 else "最新交易日较早"}
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
                    temporary = handle.name
                    json.dump(result, handle, ensure_ascii=False, allow_nan=False)
                os.replace(temporary, path)
            finally:
                if temporary and os.path.exists(temporary):
                    os.unlink(temporary)
        except Exception:
            result = {**original, "id": key, "name": name, "source": SOURCE, "code": symbol,
                      "unit": unit, "status": "stale" if original.get("value") is not None else "missing",
                      "error": "Yahoo行情更新失败，保留原日期；稍后重试。"}
        output[key] = result
    return output
