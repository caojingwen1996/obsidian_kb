"""Local same-origin data proxy for the A-share market dashboard."""

from datetime import datetime
import re
from urllib.parse import urlencode


ALLOWED_SECIDS = {"1.000001", "1.000300", "1.000985"}
ALLOWED_INDEX_CODES = {"000300", "000985"}


class RouteError(ValueError):
    """Raised when a local proxy route or parameter is not allowlisted."""


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
