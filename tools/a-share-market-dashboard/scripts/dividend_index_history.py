"""Refresh fixed CSI 000922 prices before backtests, preserving valid local history."""
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import shutil
from tempfile import NamedTemporaryFile
from threading import Lock
from urllib.parse import urlencode
from uuid import uuid4

HISTORY_LOCK = Lock()
SOURCE = "中证指数官网 index-perf(000922)"
BASE_URL = "https://www.csindex.com.cn/csindex-home/perf/index-perf"


def validated_rows(payload, strict=False):
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ValueError("指数日线响应缺少data列表")
    result = {}
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("指数日线包含无效记录")
        day, close = str(item.get("tradeDate", "")), item.get("close")
        try:
            parsed_day = datetime.strptime(day, "%Y%m%d").strftime("%Y%m%d")
        except ValueError as error:
            raise ValueError("指数日线包含无效交易日期") from error
        if parsed_day != day or isinstance(close, bool) or not isinstance(close, (float, int)) or not math.isfinite(close) or close <= 0:
            raise ValueError("指数日线包含无效日期或收盘价")
        if item.get("indexCode", "000922") != "000922" or (strict and item.get("indexCode") != "000922"):
            raise ValueError("指数日线代码不是000922")
        if day in result and result[day]["close"] != close:
            raise ValueError("指数日线同日收盘价冲突")
        result[day] = item
    return result


def status_path(path):
    path = Path(path)
    return path.with_name(path.stem + "更新状态.json")


def save_update_status(path, update, logger):
    temporary = None
    try:
        destination = status_path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent,
                                suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(update, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, destination)
    except OSError as error:
        logger("DIVIDEND_HISTORY_STATUS_WRITE_FAILED", error=str(error))
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def index_history_metadata(path, history=None, update=None):
    try:
        if history is None:
            history = json.loads(Path(path).read_text(encoding="utf-8-sig"))
        rows = validated_rows(history)
        if update is None:
            try:
                candidate = json.loads(status_path(path).read_text(encoding="utf-8"))
                update = candidate if candidate.get("fetchedAt") == history.get("fetchedAt") else None
            except (OSError, ValueError, AttributeError):
                update = None
        last = max(rows, default="")
        return {"source": history.get("source") or "来源待确认", "sourceUrl": history.get("sourceUrl", ""),
                "cutoffDate": f"{last[:4]}-{last[4:6]}-{last[6:8]}" if last else "",
                "fetchedAt": history.get("fetchedAt", ""),
                "status": (update or {}).get("status", "saved"),
                "lastAttemptAt": (update or {}).get("lastAttemptAt", ""),
                "message": (update or {}).get("message", "已有本地日线，尚无自动更新结果。")}
    except (OSError, ValueError, TypeError, AttributeError):
        return {"source": "来源待确认", "cutoffDate": "", "fetchedAt": "",
                "status": "missing", "message": "日线信息不可用，请重新回测更新。"}


def refresh_index_history(path, required_dates, fetcher, logger):
    required = {day.replace("-", "") for day in required_dates}
    if not required:
        raise ValueError("Excel没有有效估值日期，无法更新日线")
    with HISTORY_LOCK:
        path = Path(path)
        original = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {"data": []}
        previous = validated_rows(original)
        start, end = min(required), max(required)
        url = BASE_URL + "?" + urlencode({"indexCode": "000922", "startDate": start, "endDate": end})
        logger("DIVIDEND_HISTORY_UPDATE", start=start, end=end)
        try:
            fetched = validated_rows(fetcher(url, "csindex-dividend-history"), strict=True)
            fetched = {day: row for day, row in fetched.items() if start <= day <= end}
            if not fetched:
                raise ValueError("官网未返回所需区间的指数日线")
            merged = {**previous, **fetched}
            missing = [end] if end not in merged else []
            if missing:
                raise ValueError("仍缺估值日收盘价：" + "、".join(missing[:5]))
        except (OSError, RuntimeError, ValueError) as error:
            logger("DIVIDEND_HISTORY_UPDATE_FAILED", error=str(error))
            missing = [end] if end not in previous or min(previous, default=end) > start else []
            update = {"status": "failed" if missing else "cached", "throughDate": end,
                      "lastAttemptAt": datetime.now(timezone.utc).isoformat(),
                      "fetchedAt": original.get("fetchedAt", ""),
                      "message": "更新失败，价格不足，回测已停止。" if missing else "更新失败，已使用覆盖回测区间的本地价格。"}
            save_update_status(path, update, logger)
            if missing:
                raise ValueError("指数日线自动更新失败，仍缺日期 " + "、".join(missing[:5]) + "；请检查网络或稍后重试（原日线已保留）") from error
            return original, update
        stamp = datetime.now(timezone.utc).isoformat()
        updated = {**original, "source": SOURCE, "sourceUrl": url, "fetchedAt": stamp,
                   "data": [merged[day] for day in sorted(merged)]}
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and updated["data"] != original.get("data"):
            backup_dir = path.parent / "备份" / "指数日线"
            backup_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup_dir / (datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid4().hex[:8] + ".json"))
        temporary = None
        try:
            with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as handle:
                temporary = Path(handle.name)
                json.dump(updated, handle, ensure_ascii=False, indent=2, allow_nan=False)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
        logger("DIVIDEND_HISTORY_UPDATED", through=end, rows=len(merged), added=len(merged.keys() - previous.keys()))
        update = {"status": "updated", "throughDate": end, "fetchedAt": stamp,
                  "lastAttemptAt": stamp, "message": "更新成功，已覆盖本次回测截止日。"}
        save_update_status(path, update, logger)
        return updated, update
