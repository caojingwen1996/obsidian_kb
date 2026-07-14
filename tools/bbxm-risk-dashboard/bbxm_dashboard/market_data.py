import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd

from .errors import DashboardDataError


def _default_providers():
    return [
        ("sina", lambda: ak.stock_zh_index_daily(symbol="sh000001")),
        ("tencent", lambda: ak.stock_zh_index_daily_tx(symbol="sh000001")),
    ]


def _normalise(frame: pd.DataFrame) -> list[dict]:
    lowered = {str(column).lower(): column for column in frame.columns}
    if "date" not in lowered or "close" not in lowered:
        raise ValueError(f"行情字段不完整：{list(frame.columns)}")

    clean = frame[[lowered["date"], lowered["close"]]].copy()
    clean.columns = ["date", "close"]
    clean["date"] = pd.to_datetime(clean["date"], errors="raise").dt.strftime(
        "%Y-%m-%d"
    )
    clean["close"] = pd.to_numeric(clean["close"], errors="raise")
    clean = (
        clean.dropna()
        .drop_duplicates("date", keep="last")
        .sort_values("date")
    )
    if clean.empty:
        raise ValueError("行情结果为空")
    return [
        {"date": row.date, "close": round(float(row.close), 4)}
        for row in clean.itertuples(index=False)
    ]


def get_index_series(cache_path: Path, providers=None) -> dict:
    errors = []
    for provider_name, fetch in providers or _default_providers():
        try:
            rows = _normalise(fetch())
            updated_at = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(
                timespec="seconds"
            )
            payload = {
                "symbol": "sh000001",
                "provider": provider_name,
                "updated_at": updated_at,
                "rows": rows,
            }
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = cache_path.with_suffix(".tmp")
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False),
                encoding="utf-8",
            )
            temporary.replace(cache_path)
            return {**payload, "source": "live", "warning": None}
        except Exception as exc:
            errors.append(f"{provider_name}: {exc}")

    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        return {
            **cached,
            "source": "cache",
            "warning": "；".join(errors),
        }
    raise DashboardDataError(
        "market_unavailable",
        "上证指数获取失败且没有本地缓存",
        [{"errors": errors}],
    )
