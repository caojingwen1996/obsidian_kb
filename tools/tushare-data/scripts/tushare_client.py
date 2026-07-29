"""Reusable Tushare client with validation, retries, rate limits, and cache."""

from datetime import datetime
from pathlib import Path
import hashlib
import json
import math
import os
import re
import sys
from threading import Lock
from time import monotonic, sleep, time


TOOLS_DIR = Path(__file__).resolve().parents[2]
TUSHARE_DATA_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = TOOLS_DIR.parent
CACHE_DIR = TUSHARE_DATA_DIR / ".cache"
VENDOR_PATHS = (
    TUSHARE_DATA_DIR / "vendor" / "python",
    TOOLS_DIR / "a-share-market-dashboard" / "vendor" / "python",
)
TOKEN_KEYS = ("TUSHARE_TOKEN", "TUSHARE_PRO_TOKEN")
DEFAULT_RATE_LIMIT_PER_MINUTE = 120
DEFAULT_CACHE_TTL_SECONDS = 300
CACHE_VERSION = 2


for vendor_path in VENDOR_PATHS:
    if vendor_path.exists() and str(vendor_path) not in sys.path:
        sys.path.append(str(vendor_path))


DATASETS = {
    "stock_basic": {
        "fields": ("ts_code", "symbol", "name", "area", "industry", "market", "exchange", "list_date", "list_status"),
        "allowed_params": {"ts_code", "name", "exchange", "list_status", "fields"},
        "required_params": set(),
        "defaults": {
            "exchange": "",
            "list_status": "L",
            "fields": "ts_code,symbol,name,area,industry,market,exchange,list_date,list_status",
        },
        "date_fields": {"list_date"},
    },
    "daily": {
        "fields": ("ts_code", "trade_date", "open", "high", "low", "close", "pre_close", "change", "pct_chg", "vol", "amount"),
        "allowed_params": {"ts_code", "trade_date", "start_date", "end_date", "fields"},
        "required_params": {"ts_code"},
        "defaults": {"fields": "ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,vol,amount"},
        "date_fields": {"trade_date", "start_date", "end_date"},
    },
    "daily_basic": {
        "fields": (
            "ts_code", "trade_date", "close", "turnover_rate", "turnover_rate_f", "volume_ratio",
            "pe", "pe_ttm", "pb", "ps_ttm", "dv_ratio", "dv_ttm", "total_mv", "circ_mv",
        ),
        "allowed_params": {"ts_code", "trade_date", "start_date", "end_date", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,trade_date,close,turnover_rate,turnover_rate_f,volume_ratio,pe,pe_ttm,pb,ps_ttm,dv_ratio,dv_ttm,total_mv,circ_mv"
        },
        "date_fields": {"trade_date", "start_date", "end_date"},
    },
    "moneyflow": {
        "fields": (
            "ts_code", "trade_date",
            "buy_sm_vol", "buy_sm_amount", "sell_sm_vol", "sell_sm_amount",
            "buy_md_vol", "buy_md_amount", "sell_md_vol", "sell_md_amount",
            "buy_lg_vol", "buy_lg_amount", "sell_lg_vol", "sell_lg_amount",
            "buy_elg_vol", "buy_elg_amount", "sell_elg_vol", "sell_elg_amount",
            "net_mf_vol", "net_mf_amount",
        ),
        "allowed_params": {"ts_code", "trade_date", "start_date", "end_date", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,trade_date,buy_sm_vol,buy_sm_amount,sell_sm_vol,sell_sm_amount,buy_md_vol,buy_md_amount,sell_md_vol,sell_md_amount,buy_lg_vol,buy_lg_amount,sell_lg_vol,sell_lg_amount,buy_elg_vol,buy_elg_amount,sell_elg_vol,sell_elg_amount,net_mf_vol,net_mf_amount"
        },
        "date_fields": {"trade_date", "start_date", "end_date"},
    },
    "margin_detail": {
        "fields": (
            "trade_date", "ts_code", "name", "rzye", "rqye", "rzmre", "rqyl",
            "rzche", "rqchl", "rqmcl", "rzrqye",
        ),
        "allowed_params": {"ts_code", "trade_date", "start_date", "end_date", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "trade_date,ts_code,name,rzye,rqye,rzmre,rqyl,rzche,rqchl,rqmcl,rzrqye"
        },
        "date_fields": {"trade_date", "start_date", "end_date"},
    },
    "income": {
        "fields": (
            "ts_code", "ann_date", "f_ann_date", "end_date", "report_type", "comp_type",
            "basic_eps", "total_revenue", "revenue", "oper_cost", "n_income_attr_p",
        ),
        "allowed_params": {"ts_code", "ann_date", "start_date", "end_date", "period", "report_type", "comp_type", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,basic_eps,total_revenue,revenue,oper_cost,n_income_attr_p"
        },
        "date_fields": {"ann_date", "f_ann_date", "end_date", "start_date", "period"},
    },
    "balancesheet": {
        "fields": (
            "ts_code", "ann_date", "f_ann_date", "end_date", "report_type", "comp_type",
            "money_cap", "inventories", "accounts_receiv", "total_assets", "total_liab", "total_hldr_eqy_exc_min_int",
        ),
        "allowed_params": {"ts_code", "ann_date", "start_date", "end_date", "period", "report_type", "comp_type", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,money_cap,inventories,accounts_receiv,total_assets,total_liab,total_hldr_eqy_exc_min_int"
        },
        "date_fields": {"ann_date", "f_ann_date", "end_date", "start_date", "period"},
    },
    "cashflow": {
        "fields": (
            "ts_code", "ann_date", "f_ann_date", "end_date", "report_type", "comp_type",
            "n_cashflow_act", "n_cashflow_inv_act", "n_cash_flows_fnc_act",
        ),
        "allowed_params": {"ts_code", "ann_date", "start_date", "end_date", "period", "report_type", "comp_type", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,n_cashflow_act,n_cashflow_inv_act,n_cash_flows_fnc_act"
        },
        "date_fields": {"ann_date", "f_ann_date", "end_date", "start_date", "period"},
    },
    "dividend": {
        "fields": (
            "ts_code", "end_date", "ann_date", "div_proc", "stk_div", "stk_bo_rate", "stk_co_rate",
            "cash_div", "cash_div_tax", "record_date", "ex_date", "pay_date", "imp_ann_date",
        ),
        "allowed_params": {"ts_code", "ann_date", "record_date", "ex_date", "imp_ann_date", "fields"},
        "required_params": {"ts_code"},
        "defaults": {
            "fields": "ts_code,end_date,ann_date,div_proc,stk_div,stk_bo_rate,stk_co_rate,cash_div,cash_div_tax,record_date,ex_date,pay_date,imp_ann_date"
        },
        "date_fields": {"end_date", "ann_date", "record_date", "ex_date", "pay_date", "imp_ann_date"},
    },
    "index_weight": {
        "fields": ("index_code", "con_code", "trade_date", "weight"),
        "allowed_params": {"index_code", "trade_date", "start_date", "end_date", "fields"},
        "required_params": {"index_code"},
        "defaults": {"fields": "index_code,con_code,trade_date,weight"},
        "date_fields": {"trade_date", "start_date", "end_date"},
    },
}


class TushareClientError(RuntimeError):
    """Raised when the reusable Tushare client cannot return valid data."""

    def __init__(self, source, message=None, details=None):
        super().__init__(message or source)
        self.source = source
        self.details = details or {}


class RateLimiter:
    """Small in-process fixed-window limiter for local tools."""

    def __init__(self, per_minute=DEFAULT_RATE_LIMIT_PER_MINUTE):
        self.per_minute = max(1, int(per_minute))
        self._lock = Lock()
        self._calls = []

    def wait(self):
        with self._lock:
            now = monotonic()
            window_start = now - 60
            self._calls = [item for item in self._calls if item >= window_start]
            if len(self._calls) >= self.per_minute:
                delay = 60 - (now - self._calls[0])
                if delay > 0:
                    sleep(delay)
                now = monotonic()
                window_start = now - 60
                self._calls = [item for item in self._calls if item >= window_start]
            self._calls.append(monotonic())


_RATE_LIMITER = RateLimiter(int(os.environ.get("TUSHARE_RATE_LIMIT_PER_MINUTE", DEFAULT_RATE_LIMIT_PER_MINUTE)))


def token_from_env_file(env_path):
    try:
        for line in Path(env_path).read_text(encoding="utf-8-sig").splitlines():
            match = re.match(r"\s*(?:export\s+)?(TUSHARE_TOKEN|TUSHARE_PRO_TOKEN)\s*=\s*(.*?)\s*$", line)
            if match:
                token = match.group(2).strip().strip('"').strip("'")
                if token:
                    return token
    except OSError:
        return None
    return None


def resolve_token(extra_env_paths=()):
    for key in TOKEN_KEYS:
        token = os.environ.get(key)
        if token:
            return token

    env_paths = [
        TUSHARE_DATA_DIR / ".env",
        *[Path(path) for path in extra_env_paths],
        REPO_ROOT / ".env",
    ]
    seen = set()
    for env_path in env_paths:
        resolved = str(env_path)
        if resolved in seen:
            continue
        seen.add(resolved)
        if env_path.exists():
            token = token_from_env_file(env_path)
            if token:
                return token
    raise TushareClientError("tushare-token", "missing Tushare token")


def _is_missing(value):
    try:
        return bool(math.isnan(value))
    except (TypeError, ValueError):
        return False


def normalize_date(value):
    if value is None or _is_missing(value):
        return None
    text = str(value).strip()
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    return text


def tushare_date(value):
    if value is None or value == "":
        return value
    text = str(value).strip()
    if re.fullmatch(r"\d{8}", text):
        return text
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text.replace("-", "")
    raise TushareClientError("tushare-date", "date must be YYYYMMDD or YYYY-MM-DD", {"value": text})


def normalize_value(value, field=None, date_fields=frozenset()):
    if value is None or _is_missing(value):
        return None
    if field in date_fields:
        return normalize_date(value)
    if hasattr(value, "item"):
        try:
            return value.item()
        except (TypeError, ValueError):
            pass
    return value


def normalize_rows(rows, date_fields=frozenset()):
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append({
            str(key): normalize_value(value, str(key), date_fields)
            for key, value in row.items()
        })
    return normalized


def frame_to_rows(frame, date_fields=frozenset()):
    try:
        records = frame.to_dict("records")
    except AttributeError as error:
        raise TushareClientError("tushare-frame", "Tushare returned an invalid table") from error
    return normalize_rows(records if isinstance(records, list) else [], date_fields)


def plain_code_from_ts_code(ts_code):
    match = re.match(r"^(\d{6})\.", str(ts_code or ""))
    return match.group(1) if match else str(ts_code or "").strip()[:6]


def a_share_ts_code(code):
    digits = str(code or "").strip()
    if re.fullmatch(r"\d{6}\.(SH|SZ|BJ)", digits, flags=re.I):
        return digits.upper()
    if not re.fullmatch(r"\d{6}", digits):
        raise TushareClientError("tushare-code", "invalid A-share code", {"code": code})
    if digits.startswith(("6", "9")):
        return f"{digits}.SH"
    if digits.startswith(("0", "2", "3")):
        return f"{digits}.SZ"
    if digits.startswith(("4", "8")):
        return f"{digits}.BJ"
    raise TushareClientError("tushare-code", "unsupported A-share code", {"code": code})


def normalize_index_code(code):
    text = str(code or "").strip().upper()
    if re.fullmatch(r"\d{6}\.(SH|SZ|CSI|CNI)", text):
        return text
    if not re.fullmatch(r"\d{6}", text):
        raise TushareClientError("tushare-code", "invalid index code", {"code": code})
    if text.startswith(("0", "9")):
        return f"{text}.SH"
    if text.startswith(("3", "8")):
        return f"{text}.SZ"
    return text


def _fields_to_text(fields):
    if fields is None:
        return None
    if isinstance(fields, str):
        return fields
    if isinstance(fields, (list, tuple)):
        return ",".join(str(item).strip() for item in fields if str(item).strip())
    raise TushareClientError("tushare-fields", "fields must be a string or list")


def _cache_key(method, params):
    payload = json.dumps(
        {"version": CACHE_VERSION, "method": method, "params": params},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cache_path(method, params):
    return CACHE_DIR / f"{method}-{_cache_key(method, params)}.json"


def _read_cache(method, params, ttl_seconds):
    path = _cache_path(method, params)
    if ttl_seconds <= 0 or not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    timestamp = float(payload.get("timestamp", 0))
    if time() - timestamp > ttl_seconds:
        return None
    return payload.get("rows")


def _write_cache(method, params, rows):
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _cache_path(method, params).write_text(
            json.dumps({"timestamp": time(), "rows": rows}, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        pass


def _looks_like_permission_error(error):
    text = str(error).lower()
    return any(keyword in text for keyword in ("权限", "permission", "积分", "points", "token"))


def validate_params(method, params):
    if method not in DATASETS:
        raise TushareClientError("tushare-method", "unsupported Tushare dataset", {"method": method})
    config = DATASETS[method]
    merged = {**config["defaults"], **(params or {})}
    unknown = set(merged) - config["allowed_params"]
    if unknown:
        raise TushareClientError("tushare-params", "unsupported parameter", {"unknown": sorted(unknown)})
    missing = [key for key in config["required_params"] if not merged.get(key)]
    if missing:
        raise TushareClientError("tushare-params", "missing required parameter", {"missing": missing})
    if "fields" in merged:
        merged["fields"] = _fields_to_text(merged["fields"])
    if "ts_code" in merged:
        merged["ts_code"] = a_share_ts_code(merged["ts_code"])
    if "index_code" in merged:
        merged["index_code"] = normalize_index_code(merged["index_code"])
    for key in ("trade_date", "start_date", "end_date"):
        if key in merged and merged[key]:
            merged[key] = tushare_date(merged[key])
    for key in ("ann_date", "period", "record_date", "ex_date", "imp_ann_date"):
        if key in merged and merged[key]:
            merged[key] = tushare_date(merged[key])
    return merged


class TushareClient:
    """Wrapper around Tushare Pro APIs used by local tools and MCP."""

    def __init__(
        self,
        token=None,
        pro=None,
        extra_env_paths=(),
        logger=None,
        cache_ttl_seconds=DEFAULT_CACHE_TTL_SECONDS,
        retries=2,
        retry_delay_seconds=1.0,
        rate_limiter=None,
    ):
        self._token = token
        self._pro = pro
        self._extra_env_paths = tuple(extra_env_paths)
        self._logger = logger
        self.cache_ttl_seconds = int(cache_ttl_seconds)
        self.retries = max(0, int(retries))
        self.retry_delay_seconds = float(retry_delay_seconds)
        self.rate_limiter = rate_limiter or _RATE_LIMITER

    def _log(self, event, **fields):
        if self._logger:
            self._logger(event, provider="Tushare", **fields)

    def pro(self):
        if self._pro is not None:
            return self._pro
        token = self._token or resolve_token(self._extra_env_paths)
        try:
            import tushare as tushare_provider
        except ImportError as error:
            self._log("DATA_FAIL", method="import", error=type(error).__name__)
            raise TushareClientError("tushare", "tushare package is not installed") from error
        self._log("DATA_CALL", method="pro_api")
        try:
            self._pro = tushare_provider.pro_api(token)
        except Exception as error:
            self._log("DATA_FAIL", method="pro_api", error=type(error).__name__)
            raise
        self._log("DATA_OK", method="pro_api")
        return self._pro

    def call_frame(self, method, use_cache=True, **params):
        valid_params = validate_params(method, params)
        config = DATASETS[method]
        cached_rows = _read_cache(method, valid_params, self.cache_ttl_seconds) if use_cache else None
        if cached_rows is not None:
            self._log("CACHE_HIT", method=method)
            return cached_rows
        pro = self.pro()
        last_error = None
        for attempt in range(self.retries + 1):
            self.rate_limiter.wait()
            self._log("DATA_CALL", method=method, attempt=attempt + 1, **valid_params)
            try:
                frame = getattr(pro, method)(**valid_params)
                rows = frame_to_rows(frame, config["date_fields"])
                _write_cache(method, valid_params, rows)
                self._log("DATA_OK", method=method, rows=len(rows))
                return rows
            except Exception as error:
                last_error = error
                self._log("DATA_FAIL", method=method, attempt=attempt + 1, error=type(error).__name__)
                if attempt < self.retries:
                    sleep(self.retry_delay_seconds * (2 ** attempt))
        source = "tushare-permission" if _looks_like_permission_error(last_error) else "tushare"
        raise TushareClientError(
            source,
            "Tushare API call failed",
            {"method": method, "message": str(last_error)},
        ) from last_error

    def call(self, method, **kwargs):
        return self.call_frame(method, **kwargs)

    def stock_basic(self, fields=None, exchange="", list_status="L", use_cache=True):
        rows = self.call_frame(
            "stock_basic",
            exchange=exchange,
            list_status=list_status,
            fields=fields or DATASETS["stock_basic"]["defaults"]["fields"],
            use_cache=use_cache,
        )
        return RowsFrame(rows)

    def daily(self, ts_code, fields=None, use_cache=True, **date_params):
        rows = self.call_frame(
            "daily",
            ts_code=ts_code,
            fields=fields or DATASETS["daily"]["defaults"]["fields"],
            use_cache=use_cache,
            **date_params,
        )
        return RowsFrame(rows)

    def daily_basic(self, ts_code, fields=None, use_cache=True, **date_params):
        rows = self.call_frame(
            "daily_basic",
            ts_code=ts_code,
            fields=fields or DATASETS["daily_basic"]["defaults"]["fields"],
            use_cache=use_cache,
            **date_params,
        )
        return RowsFrame(rows)

    def stock_basic_rows(self, **kwargs):
        return frame_to_rows(self.stock_basic(**kwargs), DATASETS["stock_basic"]["date_fields"])

    def daily_basic_rows(self, **kwargs):
        return frame_to_rows(self.daily_basic(**kwargs), DATASETS["daily_basic"]["date_fields"])

    def check_permission(self, method, **params):
        try:
            rows = self.call_frame(method, use_cache=False, **params)
        except TushareClientError as error:
            if error.source in {"tushare-permission", "tushare-token"}:
                return {
                    "allowed": False,
                    "source": error.source,
                    "message": str(error),
                    "details": error.details,
                }
            raise
        except Exception as error:
            text = str(error)
            allowed = not any(keyword in text for keyword in ("权限", "permission", "积分", "token"))
            return {"allowed": allowed, "error": type(error).__name__, "message": text}
        return {"allowed": True, "rows": len(rows)}


class RowsFrame:
    """Tiny DataFrame-compatible wrapper for existing local dashboard code."""

    def __init__(self, rows):
        self.rows = rows

    def to_dict(self, orient):
        if orient != "records":
            raise ValueError("unsupported orient")
        return self.rows
