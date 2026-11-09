"""Dashboard payload adapters; all provider requests live in tushare-data."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

SHARED_SCRIPTS = Path(__file__).resolve().parents[2] / "tushare-data" / "scripts"
if str(SHARED_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SHARED_SCRIPTS))

from tushare_client import TushareClient, TushareClientError
from tushare_market_data import MarketData

SOURCE_URL = "https://tushare.pro/"
CN = timezone(timedelta(hours=8))
CODES = {"1.000001": "000001.SH", "1.000300": "000300.SH",
         "1.000985": "000985.CSI", "0.159941": "159941.SZ"}


def market_data(client=None):
    return MarketData(client or TushareClient(
        extra_env_paths=(Path(__file__).resolve().parents[1] / ".env",)))


def iso_day(value):
    return datetime.strptime(str(value).replace("-", ""), "%Y%m%d").date().isoformat()


def closed_cn_date(now=None):
    local = (now or datetime.now(CN)).astimezone(CN)
    return local.date() - timedelta(days=(local.hour, local.minute) < (15, 30))


def price_history(code, start, end=None, adjustment="none", api=None, now=None):
    end = min(iso_day(end), closed_cn_date(now).isoformat()) if end else closed_cn_date(now).isoformat()
    tool = "get_fund_daily" if code in ("159941.SZ", "515450.SH") else "get_index_daily"
    result = (api or market_data()).query(tool, ts_code=code, start_date=start,
                                        end_date=end, adjustment=adjustment)
    if not result["rows"]:
        raise TushareClientError("tushare-empty", "no completed daily prices")
    return result


def kline_payload(secid, limit=3000, api=None, now=None):
    code = CODES[secid]
    end = closed_cn_date(now)
    # Trading-day limit needs a wider calendar window; the service chunks requests.
    start = max("2015-06-01" if code == "159941.SZ" else "1990-01-01",
                (end - timedelta(days=limit * 2 + 60)).isoformat())
    data = price_history(code, start, end.isoformat(), "qfq" if code == "159941.SZ" else "none", api, now)
    rows = data["rows"][-limit:]
    if len(rows) < 250:
        raise TushareClientError("tushare-empty", "fewer than 250 daily prices")
    return {"data": {"klines": [",".join(map(str, [iso_day(r["trade_date"]), r["open"],
            r["close"], r["high"], r["low"], r.get("vol", "")])) for r in rows]},
            "proxySource": "Tushare " + data["dataset"] + " via tushare-data",
            "frequency": "daily", "adjustment": data["adjustment"],
            "anchorDate": data.get("anchor_date"), "sourceUrl": SOURCE_URL}


def csi_dividend_payload(start, end, api=None, now=None):
    data = price_history("000922.CSI", start, end, api=api, now=now)
    return {"data": [{"indexCode": "000922", "tradeDate": r["trade_date"],
                      "close": r["close"]} for r in data["rows"]],
            "source": "Tushare index_daily via tushare-data", "sourceUrl": SOURCE_URL}


def etf_prices(adjustment, now, api=None):
    data = price_history("515450.SH", "2020-01-01", adjustment=adjustment or "none", api=api, now=now)
    return {iso_day(r["trade_date"]): {"date": iso_day(r["trade_date"]), "close": r["close"]}
            for r in data["rows"]}


LIQUIDITY_SERIES = {
    "cn_south": ("get_southbound_flow", None, "net_buy_yi", "hk"),
    "us_DGS10": ("get_us_treasury_curve", None, "y10", "us"),
    "us_DGS2": ("get_us_treasury_curve", None, "y2", "us"),
    "us_SP500": ("get_global_index_daily", "SPX", "close", "us"),
    "cn_margin": ("get_market_margin_history", None, "financing_balance_yi", "cn"),
    "cn_margin_net": ("get_market_margin_history", None, "financing_net_buy_yi", "cn"),
    "cn_margin_ratio": ("get_market_margin_ratio", None, "financing_ratio_pct", "cn"),
    "cn_shibor": ("get_shibor", None, "on", "cn"),
    "cn_CSI300": ("get_index_daily", "000300.SH", "close", "cn"),
}


def liquidity_adapters(today=None, api=None):
    try:
        from .liquidity_data import shared_fetch, closed_daily_points
    except ImportError:
        from liquidity_data import shared_fetch, closed_daily_points
    end = today or datetime.now(CN).date()
    start = end - timedelta(days=800)
    service = api or market_data()

    def query(key):
        tool, code = key
        return service.query(tool, start_date=start.isoformat(), end_date=end.isoformat(), ts_code=code)

    query_once = shared_fetch(query)

    def series(spec):
        tool, code, field, market = spec
        data = query_once((tool, code))
        points = [{"date": iso_day(r.get("trade_date", r.get("date"))), "value": r[field]}
                  for r in data["rows"] if r.get("complete", True) and r.get(field) is not None]
        return closed_daily_points(points, market), "Tushare " + data["dataset"] + " via tushare-data", SOURCE_URL

    return {key: [lambda spec=spec: series(spec)] for key, spec in LIQUIDITY_SERIES.items()}
