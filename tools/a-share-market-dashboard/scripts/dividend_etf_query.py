"""515450 ETF prices and trailing cash distributions, separate from its index."""
from copy import deepcopy
from datetime import datetime, time, timedelta
import json
import re
from threading import Lock
from time import monotonic
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from .yahoo_data import dividend_events, source_url as yahoo_source_url
    from .shared_market_data import etf_prices, SOURCE_URL
    from .dividend_signal_query import QuoteTables, SHANGHAI, save_snapshot, validated_prices
except ImportError:
    from yahoo_data import dividend_events, source_url as yahoo_source_url
    from shared_market_data import etf_prices, SOURCE_URL
    from dividend_signal_query import QuoteTables, SHANGHAI, save_snapshot, validated_prices

CODE = "515450"
SYMBOL = "sh515450"
NAME = "南方标普中国A股大盘红利低波50ETF"
KLINE_URL = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
DISTRIBUTION_URL = "https://fundf10.eastmoney.com/fhsp_515450.html"
FUND_URL = "https://fund.eastmoney.com/515450.html"


def fetch_text(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=8) as response:
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise ValueError("ETF来源响应过大")
    return body.decode("utf-8-sig")


def parse_prices(payload, adjustment, now):
    node = payload.get("data", {}).get(SYMBOL, {})
    quote = node.get("qt", {}).get(SYMBOL, [])
    if len(quote) < 3 or quote[2] != CODE or "红利" not in quote[1]:
        raise ValueError("ETF行情身份不是515450")
    key = "qfqday" if adjustment == "qfq" else "day"
    rows = node.get(key)
    if not isinstance(rows, list) or not rows:
        raise ValueError("未取得ETF指定复权口径的日线")
    points = []
    for row in rows:
        if not isinstance(row, list) or len(row) < 3:
            raise ValueError("ETF日线列不完整")
        points.append({"date": row[0], "close": float(row[2])})
    prices = validated_prices(points, now)
    if now.time() < time(15, 15):
        prices.pop(now.date().isoformat(), None)
    if not prices:
        raise ValueError("尚无ETF已收盘日线")
    return prices


def parse_distributions(document, now):
    if not re.search(r"515450.{0,120}基金|基金.{0,120}515450", document):
        raise ValueError("ETF分红页面身份无法核验")
    parser = QuoteTables()
    parser.feed(document)
    events = {}
    found = False
    for table in parser.tables:
        if not table or table[0] != ["年份", "权益登记日", "除息日", "每10份分红", "分红发放日"]:
            continue
        found = True
        for row in table[1:]:
            if len(row) != 5:
                raise ValueError("ETF分红表列数不完整")
            ex_date = datetime.strptime(row[2], "%Y-%m-%d").date()
            pay_date = datetime.strptime(row[4], "%Y-%m-%d").date()
            amount = re.fullmatch(r"每10份派现金([0-9]+(?:\.[0-9]+)?)元", row[3])
            if not amount or ex_date.weekday() >= 5 or pay_date < ex_date:
                raise ValueError("ETF分红日期或金额无效")
            if ex_date > now.date():
                continue
            event = {"exDate": row[2], "payDate": row[4], "cashPerShare": float(amount[1]) / 10}
            if event["cashPerShare"] <= 0 or (row[2] in events and events[row[2]] != event):
                raise ValueError("ETF分红金额无效或同日冲突")
            events[row[2]] = event
    if not found or not events:
        raise ValueError("未取得ETF可核验的分红表，不能按零分红处理")
    return [events[day] for day in sorted(events)]


def trailing_distribution_yield(events, point, source_url=DISTRIBUTION_URL):
    end = datetime.strptime(point["date"], "%Y-%m-%d").date()
    start = end - timedelta(days=365)
    relevant = [e for e in events if start.isoformat() < e["exDate"] <= end.isoformat()]
    cash = round(sum(e["cashPerShare"] for e in relevant), 8)
    return {"basis": "fund-distribution-yield-ttm", "date": point["date"],
            "dividendYield": cash / point["close"] * 100, "cashPerShare": cash,
            "price": point["close"], "priceBasis": "unadjusted-close",
            "windowStartExclusive": start.isoformat(), "eventCount": len(relevant),
            "sourceUrl": source_url}


class DividendEtfQuery:
    def __init__(self, dashboard_dir, fetcher=fetch_text, price_loader=etf_prices, distribution_loader=dividend_events):
        self.path = dashboard_dir / "data/红利信号/南方红利低波50ETF.json"
        self.fetcher = fetcher
        self.price_loader = price_loader
        self.distribution_loader = distribution_loader
        self.lock = Lock()
        self.cached, self.expires = None, 0

    def query(self):
        with self.lock:
            if self.cached is not None and monotonic() < self.expires:
                return deepcopy(self.cached)
            now = datetime.now(SHANGHAI)
            stamp = now.isoformat(timespec="seconds")
            original = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {
                "schemaVersion": 1, "instrumentId": CODE, "instrumentKind": "etf", "name": NAME,
                "source": "腾讯行情", "sourceUrl": FUND_URL, "priceBasis": "qfq",
                "daily": [], "records": [], "valuation": None, "distributions": [],
            }
            if original.get("instrumentId") != CODE or original.get("priceBasis") != "qfq":
                raise ValueError("ETF本地缓存身份或复权口径不一致")
            validated_prices(original.get("daily", []), now)
            result = deepcopy(original)
            try:
                prices = self.price_loader("qfq", now)
                raw = self.price_loader("none", now)
                last_day = max(prices)
                if last_day not in raw:
                    raise ValueError("ETF复权与未复权收盘日期不一致")
                # Replace the entire adjusted series; old cached scales must not be merged.
                result.update(daily=[prices[day] for day in sorted(prices)],
                              lastPoint={**raw[last_day], "instrumentId": CODE, "kind": "etf-close"},
                              historyCoverage="available-history", fetchedAt=stamp, checkedAt=stamp,
                              source="Tushare fund_daily + fund_adj via tushare-data", sourceUrl=SOURCE_URL)
                result["sourceStatus"] = {"status": "updated", "lastAttemptAt": stamp,
                    "daily": f"已读取{len(prices)}条ETF前复权日线；最新收盘{last_day}。",
                    "task": "查看本页时每分钟查询，服务缓存60秒；未配置独立定时任务。"}
            except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
                result["sourceStatus"] = {**result.get("sourceStatus", {}),
                    "status": "cached" if original.get("daily") else "missing", "lastAttemptAt": stamp,
                    "error": f"ETF行情更新失败：{error}",
                    "daily": "保留已保存ETF日线及原日期。" if original.get("daily") else "尚未取得ETF日线。"}
            try:
                events = self.distribution_loader(now)
                result.update(distributions=events, distributionsFetchedAt=stamp,
                              distributionsSource="Yahoo Finance chart · 515450.SS",
                              distributionsSourceUrl=yahoo_source_url("515450.SS"))
                result["sourceStatus"]["valuation"] = "近365天已除息现金分红合计 / ETF未复权收盘价；非跟踪指数股息率。"
                result["sourceStatus"].pop("distributionError", None)
                result["valuation"] = trailing_distribution_yield(events, result["lastPoint"], yahoo_source_url("515450.SS")) if result.get("lastPoint") else None
            except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
                result["sourceStatus"]["distributionError"] = f"ETF分红更新失败：{error}"
                # Never carry an older denominator forward under a new valuation date.
                result["valuation"] = original.get("valuation")
            if result.get("daily"):
                save_snapshot(self.path, result, backup_name="南方ETF接入前.json")
            self.cached, self.expires = deepcopy(result), monotonic() + 60
            return result
