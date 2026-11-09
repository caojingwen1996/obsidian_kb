"""Lixinger Nasdaq-100 valuation, isolated from quote and legacy Wind caches."""

from datetime import date, datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
from threading import Lock
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://open.lixinger.com/api/us/index/fundamental"
DOC = "https://www.lixinger.com/api/open-api/html-doc/us/index/fundamental"
CODE = ".NDX"
METRICS = ("pe_ttm.mcw", "pe_ttm.y10.mcw.cvpos")
CACHE = ROOT / "data" / "市场总览" / "lixinger-nasdaq-valuation.json"
LOCK = Lock()
NOTE = "理杏仁 · 纳斯达克100 · 总市值加权 PE-TTM；近10年分位由理杏仁同口径提供。"


class LixingerError(ValueError):
    """Only fixed, non-sensitive messages may be returned to the dashboard."""


def read_token():
    token = os.environ.get("LIXINGER_TOKEN", "").strip()
    if token:
        return token
    try:
        for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.strip().removeprefix("export ").partition("=")
            if sep and key.strip() == "LIXINGER_TOKEN":
                return value.strip().strip("\"'")
    except OSError:
        pass
    return ""


def post_json(payload):
    request = Request(API, data=json.dumps(payload).encode("utf-8"),
                      headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=15) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise LixingerError("理杏仁响应超出大小限制")
    return json.loads(raw)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def normalize(payload, start, end):
    if not isinstance(payload, dict) or payload.get("code") != 1:
        raise LixingerError("理杏仁请求未成功，请检查 Token 和美股指数基本面权限")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise LixingerError("理杏仁返回格式异常")
    candidates = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("stockCode") != CODE:
            raise LixingerError("理杏仁返回的指数代码不符")
        try:
            day = date.fromisoformat(str(row["date"])[:10]).isoformat()
        except (ValueError, KeyError):
            raise LixingerError("理杏仁返回日期无效") from None
        if not start <= day <= end or day in candidates:
            raise LixingerError("理杏仁返回日期超界或重复")
        candidates[day] = row
    if not candidates:
        raise LixingerError("理杏仁近30天未返回纳斯达克100估值数据")
    day = max(candidates)
    row = candidates[day]
    pe, percentile = (row.get(key) for key in METRICS)
    if not finite(pe) or pe <= 0:
        raise LixingerError("理杏仁最新日期未返回有效 PE-TTM")
    valid_percentile = finite(percentile) and 0 <= percentile <= 1
    return {"peTtm": pe, "pePercentile10y": percentile * 100 if valid_percentile else None,
            "valuationDate": day, "valuationSourceUrl": DOC, "valuationSource": "理杏仁",
            "valuationBasis": "pe_ttm.mcw/y10.mcw.cvpos", "stockCode": CODE,
            "status": "ok" if valid_percentile else "partial",
            "valuationNote": NOTE + ("" if valid_percentile else " 该日十年分位缺失，未使用其他窗口替代。")}


def get_nasdaq_valuation(end_date=None, *, token=None, transport=None, cache_path=CACHE,
                         force=False, now=None):
    """Return PE and 0–100 percentile; failures retain only this provider's dated cache."""
    now = now or datetime.now(timezone.utc)
    end = date.fromisoformat(end_date) if end_date else now.astimezone(timezone(timedelta(hours=8))).date()
    start = end - timedelta(days=30)
    token = read_token() if token is None else token
    path = Path(cache_path)
    with LOCK:
        previous = {}
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if (cached.get("stockCode") == CODE and cached.get("valuationSource") == "理杏仁"
                    and cached.get("valuationBasis") == "pe_ttm.mcw/y10.mcw.cvpos"
                    and finite(cached.get("peTtm")) and cached["peTtm"] > 0
                    and date.fromisoformat(cached["valuationDate"]) <= end):
                previous = cached
                age = (now - datetime.fromisoformat(cached["fetchedAt"])).total_seconds()
                if not force and token and 0 <= age < 3600 and cached.get("queryEnd") == end.isoformat():
                    return {**cached, "cacheHit": True}
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            previous = {}
        try:
            if not token:
                raise LixingerError("未配置理杏仁 LIXINGER_TOKEN，估值尚未取数")
            payload = (transport or post_json)({"token": token, "stockCodes": [CODE],
                "startDate": start.isoformat(), "endDate": end.isoformat(), "metricsList": list(METRICS)})
            result = normalize(payload, start.isoformat(), end.isoformat())
            result.update(fetchedAt=now.isoformat(), queryEnd=end.isoformat())
            if (end - date.fromisoformat(result["valuationDate"])).days > 7:
                result["status"] = "stale"
                result["valuationNote"] += " 估值日期距查询截止日超过7天。"
            result["valuationNote"] += " 数据日期：" + result["valuationDate"] + "。"
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(".tmp")
                temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                temporary.replace(path)
            except OSError:
                result["valuationNote"] += " 本地缓存未能保存。"
            return result
        except Exception as error:
            # Upstream error bodies can echo tokens; never expose their text or request bodies.
            message = str(error) if isinstance(error, LixingerError) else "理杏仁连接或响应异常，本次估值更新失败"
            return {**previous, "status": "stale" if previous else "missing", "error": message,
                    "valuationSource": "理杏仁", "valuationSourceUrl": DOC,
                    "valuationNote": (NOTE + " 数据日期：" + previous["valuationDate"] + "。 " if previous else "")
                    + message + ("；保留理杏仁上次数据，非最新估值。" if previous else "。")}
