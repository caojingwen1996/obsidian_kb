"""Code-based dividend data query; MarketScreener prices are never dividend yields."""
from copy import deepcopy
from datetime import datetime, time
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import shutil
from tempfile import NamedTemporaryFile
from threading import Lock
from time import monotonic
from urllib.error import HTTPError
from urllib.request import Request, build_opener
from zoneinfo import ZoneInfo

MARKETSCREENER_URL = "https://www.marketscreener.com/quote/index/S-P-CHINA-A-SHARE-LARGECA-57289507/quotes/"
INDEX_NAME = "S&P CHINA A-SHARE LARGECAP LOW VOLATILITY HIGH DIVIDEND 50 (CNY)"
SHANGHAI = ZoneInfo("Asia/Shanghai")


def resolve_code(code):
    if code not in ("000922", "SPCLLHCP", "515450"):
        raise ValueError("不支持的代码；可用：000922、515450（ETF）、SPCLLHCP（历史指数）")
    return code


class QuoteTables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings, self.tables = [], []
        self.heading = None
        self.table = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "h1":
            self.heading = []
        elif tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("th", "td") and self.row is not None:
            self.cell = []

    def handle_data(self, value):
        if self.heading is not None:
            self.heading.append(value)
        if self.cell is not None:
            self.cell.append(value)

    def handle_endtag(self, tag):
        if tag == "h1" and self.heading is not None:
            self.headings.append(" ".join("".join(self.heading).split()))
            self.heading = None
        elif tag in ("th", "td") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def validated_prices(rows, now):
    result = {}
    for row in rows:
        day, close = row.get("date"), row.get("close")
        if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            raise ValueError("行情日期格式无效")
        parsed = datetime.strptime(day, "%Y-%m-%d").date()
        if parsed > now.date() or parsed.weekday() >= 5:
            raise ValueError("行情含未来日期或周末日期")
        if isinstance(close, bool) or not isinstance(close, (int, float)) or not math.isfinite(close) or close <= 0:
            raise ValueError("行情收盘价无效")
        if row.get("instrumentId", "SPCLLHCP") != "SPCLLHCP":
            raise ValueError("缓存指数身份不一致")
        if day in result and result[day]["close"] != close:
            raise ValueError("同日收盘价冲突")
        result[day] = {"date": day, "close": close}
    return result


def parse_marketscreener_quotes(document, now=None):
    """Read the dated 'Last' row, not the undated live quote or sidebar indices."""
    now = (now or datetime.now(SHANGHAI)).astimezone(SHANGHAI)
    parser = QuoteTables()
    parser.feed(document)
    if not any(h.upper() in (INDEX_NAME, "QUOTES " + INDEX_NAME) for h in parser.headings):
        raise ValueError("MarketScreener页面指数身份无法核验（可能为访问限制页）")
    points = []
    for table in parser.tables:
        for index, header in enumerate(table):
            dates = [(i, cell) for i, cell in enumerate(header) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", cell)]
            if len(dates) < 2:
                continue
            for row in table[index + 1:]:
                if not row or row[0] != "Last":
                    continue
                for column, day in dates:
                    if column >= len(row):
                        raise ValueError("MarketScreener行情表列数不完整")
                    value = row[column].replace(",", "").replace("\u00a0", "")
                    points.append({"date": day, "close": float(value)})
                break
    prices = validated_prices(points, now)
    # Do not label a currently trading day's point as a completed daily close.
    if now.time() < time(15, 15):
        prices.pop(now.date().isoformat(), None)
    if not prices:
        raise ValueError("MarketScreener未返回可核验的已收盘日线")
    return [prices[day] for day in sorted(prices)]


def fetch_marketscreener():
    request = Request(MARKETSCREENER_URL, headers={
        "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        with build_opener().open(request, timeout=8) as response:
            body = response.read(4_000_001)
        if len(body) > 4_000_000:
            raise ValueError("MarketScreener响应过大")
        return body.decode("utf-8-sig")
    except HTTPError as error:
        raise RuntimeError(f"MarketScreener HTTP {error.code}，未取得新行情") from error


def save_snapshot(path, payload, backup_name="标普接入前.json"):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        if path.exists():
            backup = path.parent / "备份" / backup_name
            backup.parent.mkdir(exist_ok=True)
            if not backup.exists():
                shutil.copy2(path, backup)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


class DividendSignalQuery:
    def __init__(self, dashboard_dir, csi_reader, fetcher=fetch_marketscreener, etf_fetcher=None):
        try:
            from .dividend_etf_query import DividendEtfQuery
        except ImportError:
            from dividend_etf_query import DividendEtfQuery
        self.etf = DividendEtfQuery(Path(dashboard_dir), **({"fetcher": etf_fetcher} if etf_fetcher else {}))
        self.path = Path(dashboard_dir) / "data/红利信号/标普红利低波50.json"
        self.csi_reader, self.fetcher = csi_reader, fetcher
        self.lock = Lock()
        self.expires, self.cached = 0, None

    def query(self, code):
        instrument = resolve_code(code)
        if instrument == "515450":
            return self.etf.query()
        if instrument == "000922":
            view = self.csi_reader()
            latest = view.get("payload", {}).get("latest") or {}
            value = latest.get("input", {}).get("dividendYield")
            valuation = {"basis": "index-dividend-yield", "dividendYield": value,
                         "date": latest.get("dates", {}).get("index"), "sourceUrl": "https://www.csindex.com.cn/"} if value is not None else None
            return {**view, "instrumentId": instrument, "source": "日线：" + view.get("indexHistoryMeta", {}).get("source", "已保存历史") + "；股息率：中证原口径",
                    "sourceUrl": "https://www.csindex.com.cn/", "daily": view["indexHistory"],
                    "valuation": valuation, "records": view.get("payload", {}).get("records", []),
                    "sourceStatus": {"status": "saved", "daily": "读取已保存中证红利采集产物；页面日线刷新通过Tushare共享Python接口"}}
        with self.lock:
            if self.cached is not None and monotonic() < self.expires:
                return deepcopy(self.cached)
            now = datetime.now(SHANGHAI)
            original = json.loads(self.path.read_text(encoding="utf-8-sig")) if self.path.exists() else {
                "schemaVersion": 1, "instrumentId": instrument, "source": "MarketScreener", "sourceUrl": MARKETSCREENER_URL,
                "daily": [], "valuation": None, "records": [],
            }
            if original.get("schemaVersion") != 1 or original.get("instrumentId") != instrument:
                raise ValueError("本地标普指数数据身份不一致")
            previous = validated_prices(original.get("daily", []), now)
            result = deepcopy(original)
            attempted_at = now.isoformat(timespec="seconds")
            try:
                fresh = parse_marketscreener_quotes(self.fetcher(), now)
                for point in fresh:
                    previous[point["date"]] = point
                result.update({"source": "MarketScreener", "sourceUrl": MARKETSCREENER_URL,
                    "daily": [previous[day] for day in sorted(previous)], "checkedAt": attempted_at,
                    "historyCoverage": "partial-history" if original.get("historyCoverage") == "partial-history" else "recent-window", "fetchedAt": attempted_at})
                result["lastPoint"] = {**result["daily"][-1], "instrumentId": instrument, "kind": "marketscreener-close"}
                result["sourceStatus"] = {"status": "updated", "lastAttemptAt": attempted_at,
                    "daily": "已读取MarketScreener近期收盘表；非完整历史，暂不用于年度统计或历史回测。",
                    "valuation": "MarketScreener行情页未提供可核验的指数股息率" if not result.get("valuation") else "保留独立来源的指数股息率",
                    "task": "按页面查询更新行情；尚无本标的每日股息率采集与评分任务。"}
                save_snapshot(self.path, result)
            except (OSError, ValueError, RuntimeError) as error:
                result = deepcopy(original)
                result["sourceStatus"] = {**result.get("sourceStatus", {}),
                    "status": "cached" if previous or original.get("lastPoint") else "missing",
                    "lastAttemptAt": attempted_at, "requestedSource": "MarketScreener",
                    "error": str(error), "daily": f"MarketScreener更新失败：{error}；保留已保存数据及原日期。"}
            self.cached, self.expires = deepcopy(result), monotonic() + 60
            return result
