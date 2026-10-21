#!/usr/bin/env python
"""Check CSI Dividend Index dividend-yield signal and write local records."""

from __future__ import annotations

import argparse
import csv
import gzip
import html
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable
from urllib import parse, request

try:
    from .run_monitor import RunMonitor, local_now
except ImportError:
    from run_monitor import RunMonitor, local_now

try:
    from .scoring import load_strategy, score_input, confirm_records, grade_for_score, finite, COMPONENT_LABELS
except ImportError:
    from scoring import load_strategy, score_input, confirm_records, grade_for_score, finite, COMPONENT_LABELS


INDEX_CODE = "000922"
INDEX_DAILY_SYMBOL = "sh000922"
INDEX_INCEPTION_DATE = "20080526"
CSI_TR_SYMBOL = "H00922"
TRADING_DAYS_PER_YEAR = 244
MIN_PERCENTILE_WINDOW_ROWS = 2000
CSINDEX_PERFORMANCE_URL = "https://www.csindex.com.cn/csindex-home/perf/index-perf"
LIXINGER_INDEX_PATH = "sh/000922/922"
LIXINGER_PUBLIC_URL = (
    "https://www.lixinger.com/equity/index/detail/"
    f"{LIXINGER_INDEX_PATH}/fundamental/valuation/dyr?metrics-type=mcw"
)
TENCENT_QUOTE_URL = "http://qt.gtimg.cn/q=sh000922"


@dataclass
class LixingerPercentile:
    date: str
    dividend_yield: float
    percentile_10y: float | None
    percentile_80_value: float | None
    source: str
    note: str


@dataclass
class IntradayQuote:
    date: str
    change_percent: float | None
    source: str
    note: str


@dataclass
class IndexValuation:
    date: str
    dividend_yield: float
    source: str
    note: str


@dataclass
class IndexPerformance:
    date: str
    start_date: str
    ytd_return: float
    ytd_max_drawdown: float
    source: str
    note: str


@dataclass
class AnnualPerformance:
    year: int
    start_date: str
    end_date: str
    annual_return: float
    max_drawdown: float
    status: str
    monthly_returns: list[dict] = field(default_factory=list)


@dataclass
class BondYield:
    date: str
    yield_10y: float
    source: str
    note: str


@dataclass
class Signal:
    run_date: str
    run_time: str
    index_date: str
    bond_date: str
    akshare_dividend_yield_2: float
    ytd_return: float
    ytd_max_drawdown: float
    intraday_quote_date: str
    intraday_change_percent: str
    lixinger_date: str
    lixinger_dividend_yield: str
    lixinger_percentile_10y: str
    lixinger_percentile_80_value: str
    lixinger_source: str
    bond_10y_yield: float
    spread: float
    percentile_signal: str
    absolute_signal: str
    spread_signal: str
    headline_signal: str
    source_note: str
    annual_performance: list[AnnualPerformance] = field(default_factory=list)
    annual_performance_source: str = ""
    percentile_value: float | None = None
    scoring: dict = field(default_factory=dict)
    trading_dates: list[str] = field(default_factory=list)
    strategy: dict = field(default_factory=dict)


CSV_HEADER_LABELS = {
    "run_date": "run_date__record_date",
    "run_time": "run_time__record_time",
    "index_date": "index_date__index_valuation_date",
    "bond_date": "bond_date__china_10y_yield_date",
    "lixinger_date": "lixinger_date__percentile_source_date",
}

CSV_CHINESE_LABELS = {
    "run_date": "记录日期",
    "index_date": "指数估值日期",
    "akshare_dividend_yield_2": "指数股息率口径(%)",
    "ytd_return": "全年收益率(%)",
    "ytd_max_drawdown": "年内最大回撤(%)",
    "intraday_change_percent": "当天涨跌幅(%)",
    "bond_date": "中国10年国债收益率日期",
    "bond_10y_yield": "中国10年国债收益率(%)",
    "spread": "股债利差:股息率2-10年国债收益率(百分点)",
    "percentile_signal": "历史分位点触发",
    "absolute_signal": "绝对股息率触发",
    "spread_signal": "股债利差触发",
    "headline_signal": "综合结论",
    "lixinger_date": "理杏仁估值日期",
    "lixinger_dividend_yield": "理杏仁市值加权股息率(%)",
    "lixinger_percentile_10y": "理杏仁近10年股息率分位(%)",
    "lixinger_percentile_80_value": "理杏仁近10年80%分位点(%)",
    "lixinger_source": "理杏仁数据源状态",
}

CSV_FIELD_ORDER = [
    "run_date",
    "index_date",
    "akshare_dividend_yield_2",
    "ytd_return",
    "ytd_max_drawdown",
    "intraday_change_percent",
    "bond_date",
    "bond_10y_yield",
    "spread",
    "percentile_signal",
    "absolute_signal",
    "spread_signal",
    "headline_signal",
    "lixinger_date",
    "lixinger_dividend_yield",
    "lixinger_percentile_10y",
    "lixinger_percentile_80_value",
    "lixinger_source",
]

SCORE_FIELD_LABELS = {
    "strategy_version": "评分策略版本", "composite_score": "综合分",
    "composite_grade": "综合等级", "score_lower": "综合分下界", "score_upper": "综合分上界",
    "percentile_score": "历史分位得分", "absolute_score": "绝对股息率得分", "ratio_score": "股债倍数得分",
    "percentile_contribution": "历史分位贡献", "absolute_contribution": "绝对股息率贡献", "ratio_contribution": "股债倍数贡献",
    "score_quality": "评分数据质量", "confirmation_status": "连续确认状态",
}
CSV_FIELD_ORDER += list(SCORE_FIELD_LABELS)
CSV_CHINESE_LABELS.update(SCORE_FIELD_LABELS)

EXCEL_BOLD_FIELDS = {
    "percentile_signal",
    "absolute_signal",
    "spread_signal",
}
EXCEL_HIGHLIGHT_FILL = "FFF2CC"
EXCEL_HEADER_FILL = "1F4E78"
EXCEL_LABEL_FILL = "D9EAF7"
EXCEL_BORDER_COLOR = "D9E2F3"

SIGNAL_LEVELS = {
    "D": 0,
    "C": 1,
    "B": 2,
    "A": 3,
}

SIGNAL_GRADE_LABELS = COMPONENT_LABELS

LEGACY_SIGNAL_LABELS = {
    "历史分位点待验证": "",
    "不买或少买": "D",
    "观望": "D",
    "红利吸引力一般": "D",
    "小额定投": "C",
    "中性等待": "C",
    "有配置价值": "C",
    "加大买入": "B",
    "分批买入": "B",
    "红利性价比较高": "B",
    "重点买入": "A",
    "强买入": "A",
    "历史上偏强买点": "A",
}


def import_akshare():
    try:
        import akshare as ak  # type: ignore
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "缺少 AKShare。请在自动化使用的 Python 环境中安装：pip install akshare"
        ) from exc
    return ak


def to_float(value) -> float:
    if value is None:
        raise ValueError("empty numeric value")
    if isinstance(value, str):
        value = value.strip().replace("%", "").replace(",", "")
    return float(value)


def first_existing(columns: Iterable[str], candidates: Iterable[str]) -> str:
    column_set = set(columns)
    for candidate in candidates:
        if candidate in column_set:
            return candidate
    raise KeyError(f"missing expected columns; tried {', '.join(candidates)}")


def select_latest_on_or_before(frame, date_col: str, target_date: datetime):
    dated = frame.copy()
    dated[date_col] = dated[date_col].astype(str)
    dated["_date"] = dated[date_col].apply(lambda value: datetime.fromisoformat(value[:10]))
    dated = dated[dated["_date"] <= target_date].sort_values("_date")
    if dated.empty:
        raise RuntimeError(f"No rows on or before target date {target_date:%Y-%m-%d}")
    return dated.iloc[-1]


def normalize_percentile(value: float | None) -> float | None:
    if value is None:
        return None
    return value * 100 if 0 <= value <= 1 else value


def extract_percent(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text)
    return to_float(match.group(1)) if match else None


def normalize_html_text(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text)


def parse_lixinger_public_percentile(text: str, source_url: str) -> LixingerPercentile:
    normalized = normalize_html_text(text)
    date_match = re.search(r"最后更新于[:：]?\s*(\d{4}-\d{2}-\d{2})", normalized)
    if date_match is None:
        date_match = re.search(r"更新于\s*(\d{4}-\d{2}-\d{2})", normalized)
    current = extract_percent(r"当前值[:：]?\s*([0-9.]+)%", normalized)
    percentile = extract_percent(r"当前分位点\s*([0-9.]+)%", normalized)
    p80 = extract_percent(r"80%\s*分位点\s*([0-9.]+)%", normalized)
    if current is None or percentile is None or p80 is None:
        raise RuntimeError("无法从理杏仁公开页面解析股息率分位字段")
    return LixingerPercentile(
        date=date_match.group(1) if date_match else "",
        dividend_yield=current,
        percentile_10y=percentile,
        percentile_80_value=p80,
        source="理杏仁公开页面",
        note=source_url,
    )


def fetch_lixinger_public_percentile() -> LixingerPercentile:
    req = request.Request(
        LIXINGER_PUBLIC_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Encoding": "gzip",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.lixinger.com/",
        },
    )
    with request.urlopen(req, timeout=60) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        text = raw.decode("utf-8", errors="replace")
    return parse_lixinger_public_percentile(text, LIXINGER_PUBLIC_URL)


def parse_tencent_quote_payload(text: str) -> IntradayQuote:
    if '="' not in text:
        raise RuntimeError("腾讯行情接口返回结构异常")
    payload = text.split('="', 1)[1].rsplit('"', 1)[0]
    if not payload.strip():
        raise RuntimeError("腾讯行情接口返回空响应")
    fields = payload.split("~")
    if len(fields) < 33:
        raise RuntimeError("腾讯行情接口字段不足")
    change = to_float(fields[32])
    if change is None:
        raise RuntimeError("腾讯行情接口缺少涨跌幅字段")
    raw_ts = fields[30]
    quote_date = (
        f"{raw_ts[:4]}-{raw_ts[4:6]}-{raw_ts[6:8]}"
        if re.fullmatch(r"\d{14}", raw_ts)
        else ""
    )
    return IntradayQuote(
        date=quote_date,
        change_percent=change,
        source="腾讯行情",
        note=TENCENT_QUOTE_URL,
    )


def fetch_tencent_realtime_quote() -> IntradayQuote:
    req = request.Request(
        TENCENT_QUOTE_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            ),
            "Accept": "*/*",
            "Referer": "https://gu.qq.com/",
        },
    )
    with request.urlopen(req, timeout=25) as response:
        raw = response.read()
    text = raw.decode("gbk", errors="replace")
    return parse_tencent_quote_payload(text)


def get_intraday_realtime_quote() -> IntradayQuote:
    try:
        return fetch_tencent_realtime_quote()
    except Exception as exc:
        return IntradayQuote(
            date="",
            change_percent=None,
            source="腾讯行情待验证",
            note=f"腾讯行情失败：{exc}",
        )


def make_llm_lixinger_percentile(
    date: str,
    dividend_yield: str | None,
    percentile_10y: str | None,
    percentile_80_value: str | None,
    source_note: str | None,
) -> LixingerPercentile | None:
    if not (dividend_yield and percentile_10y and percentile_80_value):
        return None
    return LixingerPercentile(
        date=date,
        dividend_yield=to_float(dividend_yield),
        percentile_10y=normalize_percentile(to_float(percentile_10y)),
        percentile_80_value=to_float(percentile_80_value),
        source="大模型网页查询",
        note=source_note or "由 Codex/大模型通过网页查询后传入脚本",
    )


def fetch_csi_derived_percentile(ak) -> LixingerPercentile:
    """理杏仁不可用时的兜底口径：用官方价格指数与全收益指数推算滚动12个月股息率及其近10年分位。

    股息率(t) = (TR/PR)(t) / (TR/PR)(t-244) - 1，即全收益指数相对价格指数一年内的超额部分，
    等价于滚动12个月股息贡献。分位取当前值在近10年窗口内的位置，80%分位点取窗口收益率的80分位值。
    """
    import numpy as np
    import pandas as pd

    end_date = datetime.now().strftime("%Y%m%d")
    closes: dict[str, pd.Series] = {}
    for symbol in (INDEX_CODE, CSI_TR_SYMBOL):
        frame = ak.stock_zh_index_hist_csindex(
            symbol=symbol, start_date=INDEX_INCEPTION_DATE, end_date=end_date
        )
        series = frame[["日期", "收盘"]].copy()
        series["日期"] = pd.to_datetime(series["日期"])
        series["收盘"] = pd.to_numeric(series["收盘"], errors="coerce")
        series = series.dropna().set_index("日期")["收盘"]
        if series.empty:
            raise RuntimeError(f"中证指数历史行情为空：{symbol}")
        closes[symbol] = series
    merged = pd.concat(closes, axis=1).dropna().sort_index()
    merged.columns = ["price", "total_return"]
    if len(merged) <= TRADING_DAYS_PER_YEAR:
        raise RuntimeError("官方指数历史不足一年，无法推算滚动股息率")

    ratio = merged["total_return"] / merged["price"]
    yields = (ratio / ratio.shift(TRADING_DAYS_PER_YEAR) - 1) * 100
    yields = yields.dropna()
    if yields.empty:
        raise RuntimeError("滚动股息率序列为空")

    current_date = yields.index[-1]
    current = float(yields.iloc[-1])
    window_start = current_date - pd.DateOffset(years=10)
    window = yields[(yields.index > window_start) & (yields.index <= current_date)]
    if len(window) < MIN_PERCENTILE_WINDOW_ROWS:
        raise RuntimeError(f"近10年窗口样本不足：{len(window)} 个交易日")
    percentile = float((window < current).mean() * 100)
    percentile_80 = float(np.percentile(window, 80))
    return LixingerPercentile(
        date=current_date.strftime("%Y-%m-%d"),
        dividend_yield=current,
        percentile_10y=percentile,
        percentile_80_value=percentile_80,
        source="中证官方指数推算",
        note=(
            f"000922价格指数×H00922全收益指数推算滚动12个月股息率({current:.2f}%)，"
            f"近10年窗口{len(window)}个交易日，当前分位{percentile:.2f}%，80%分位点{percentile_80:.2f}%"
        ),
    )


def fetch_lixinger_percentile(
    llm_percentile: LixingerPercentile | None = None,
    ak=None,
) -> LixingerPercentile:
    errors: list[str] = []
    try:
        return fetch_lixinger_public_percentile()
    except Exception as public_exc:
        public_error = str(public_exc)
        errors.append(f"公开页面失败：{public_error}")

    if llm_percentile is not None:
        llm_percentile.note = f"{llm_percentile.note}; 公开页面失败后采用：{public_error}"
        return llm_percentile

    if ak is not None:
        try:
            return fetch_csi_derived_percentile(ak)
        except Exception as csi_exc:
            errors.append(f"官方指数推算失败：{csi_exc}")

    errors.append("未提供大模型网页查询结果")

    return LixingerPercentile(
        date="",
        dividend_yield=0.0,
        percentile_10y=None,
        percentile_80_value=None,
        source="理杏仁待验证",
        note="; ".join(errors),
    )


def evaluate_percentile(percentile: float | None) -> str:
    if percentile is None:
        return ""
    if percentile >= 80:
        return "A"
    if percentile >= 70:
        return "B"
    if percentile < 50:
        return "D"
    return "C"


def evaluate_absolute(dividend_yield: float) -> str:
    if dividend_yield < 4.0:
        return "D"
    if dividend_yield < 5.0:
        return "C"
    if dividend_yield <= 6.0:
        return "B"
    return "A"


def evaluate_spread(dividend_yield: float, bond_10y_yield: float) -> str:
    if bond_10y_yield <= 0:
        return "D"
    ratio = dividend_yield / bond_10y_yield
    if ratio >= 4.0:
        return "A"
    if ratio >= 3.0:
        return "B"
    if ratio >= 2.0:
        return "C"
    return "D"


def signal_level(signal: object) -> int:
    return SIGNAL_LEVELS.get(normalize_signal_label(signal), -1)


def normalize_signal_label(signal: object) -> str:
    text = "" if signal is None else str(signal)
    return LEGACY_SIGNAL_LABELS.get(text, text)


def strong_signal_count(signals: Iterable[object]) -> int:
    return sum(1 for signal in signals if signal_level(signal) >= SIGNAL_LEVELS["B"])


def should_highlight_signal_row(row: dict[str, object]) -> bool:
    return row.get("composite_grade") == "A"


def build_headline(
    percentile_signal: str,
    absolute_signal: str,
    spread_signal: str,
) -> str:
    count = strong_signal_count([percentile_signal, absolute_signal, spread_signal])
    if count >= 2:
        return "加大买入区间"
    if not percentile_signal:
        return "历史分位点待验证，暂不判定加大买入区间"
    return "未进入加大买入区间"


def normalize_output_row(row: dict[str, object]) -> dict[str, object]:
    normalized = dict(row)
    for field in ("percentile_signal", "absolute_signal", "spread_signal"):
        normalized[field] = normalize_signal_label(normalized.get(field, ""))
    if not normalized.get("headline_signal") and not normalized.get("strategy_version"):
        normalized["headline_signal"] = build_headline(
            str(normalized.get("percentile_signal", "")),
            str(normalized.get("absolute_signal", "")),
            str(normalized.get("spread_signal", "")),
        )
    return normalized


def display_signal_grade(signal: str) -> str:
    if not signal:
        return "待验证"
    return f"{signal}（{SIGNAL_GRADE_LABELS.get(signal, signal)}）"


def fetch_index_valuation(ak, run_date: datetime) -> IndexValuation:
    valuation = ak.stock_zh_index_value_csindex(symbol=INDEX_CODE)
    if valuation.empty:
        raise RuntimeError(f"AKShare did not return valuation data for {INDEX_CODE}")

    date_col = first_existing(valuation.columns, ["日期", "date"])
    dividend_col = first_existing(
        valuation.columns, ["股息率2", "股息率1", "股息率", "dividend_yield"]
    )

    valuation = valuation.copy()
    valuation["_dividend_yield"] = valuation[dividend_col].apply(to_float)
    latest = select_latest_on_or_before(valuation, date_col, run_date)
    return IndexValuation(
        date=latest["_date"].strftime("%Y-%m-%d"),
        dividend_yield=float(latest["_dividend_yield"]),
        source=f"AKShare {dividend_col}",
        note="AKShare: stock_zh_index_value_csindex(000922, 股息率2)",
    )


def fetch_akshare_index_history(ak):
    daily = None
    source_method = "stock_zh_index_daily"
    fetch_tencent_daily = getattr(ak, "stock_zh_index_daily_tx", None)
    if callable(fetch_tencent_daily):
        try:
            daily = fetch_tencent_daily(symbol=INDEX_DAILY_SYMBOL)
            source_method = "stock_zh_index_daily_tx"
        except Exception:
            daily = None
    if daily is None or daily.empty:
        daily = ak.stock_zh_index_daily(symbol=INDEX_DAILY_SYMBOL)
    if daily.empty:
        raise RuntimeError(f"AKShare did not return daily data for {INDEX_DAILY_SYMBOL}")
    return daily, source_method


def calculate_annual_performance(
    daily,
    date_col: str,
    close_col: str,
    target_date: datetime,
) -> list[AnnualPerformance]:
    daily = daily.copy()
    daily["_date"] = daily[date_col].apply(
        lambda value: datetime.fromisoformat(str(value)[:10])
    )
    daily["_close"] = daily[close_col].apply(to_float)
    daily = daily[daily["_date"] <= target_date].dropna(subset=["_close"])
    daily = daily.sort_values("_date")
    if daily.empty:
        raise RuntimeError(f"No index rows on or before {target_date:%Y-%m-%d}")

    first_year = int(daily.iloc[0]["_date"].year)
    annual: list[AnnualPerformance] = []
    for year, group in daily.groupby(daily["_date"].apply(lambda value: value.year)):
        group = group.sort_values("_date")
        first_close = float(group.iloc[0]["_close"])
        latest_close = float(group.iloc[-1]["_close"])
        if first_close <= 0:
            raise RuntimeError(f"First close must be positive for {year}")
        drawdowns = group["_close"] / group["_close"].cummax() - 1
        status = (
            "成立首年"
            if int(year) == first_year
            else "年内"
            if int(year) == target_date.year
            else "完整年度"
        )
        monthly_returns = []
        first_month = int(group.iloc[0]['_date'].month)
        last_month = int(group.iloc[-1]['_date'].month)
        for month in range(1, 13):
            current_month = group[group['_date'].dt.month == month]
            previous_month = group[group['_date'].dt.month == month - 1]
            base = group.iloc[0] if month == first_month else previous_month.iloc[-1] if not previous_month.empty else None
            if current_month.empty or base is None:
                monthly_returns.append({'month': month, 'value': None, 'status': '未开始' if month > last_month else '数据不足'})
                continue
            end = current_month.iloc[-1]
            monthly_returns.append({
                'month': month,
                'value': (float(end['_close']) / float(base['_close']) - 1) * 100,
                'startDate': base['_date'].strftime('%Y-%m-%d'),
                'endDate': end['_date'].strftime('%Y-%m-%d'),
                'status': '月内累计' if int(year) == target_date.year and month == last_month else '已统计',
            })
        annual.append(
            AnnualPerformance(
                year=int(year),
                start_date=group.iloc[0]["_date"].strftime("%Y-%m-%d"),
                end_date=group.iloc[-1]["_date"].strftime("%Y-%m-%d"),
                annual_return=(latest_close / first_close - 1) * 100,
                max_drawdown=float(drawdowns.min()) * 100,
                status=status,
                monthly_returns=monthly_returns,
            )
        )
    return annual


def build_index_performance(
    daily,
    date_col: str,
    close_col: str,
    target_date: datetime,
    source: str,
    note: str,
) -> tuple[IndexPerformance, list[AnnualPerformance]]:
    annual = calculate_annual_performance(daily, date_col, close_col, target_date)
    current = next(
        (row for row in reversed(annual) if row.year == target_date.year),
        None,
    )
    if current is None:
        raise RuntimeError(f"No index rows in calendar year {target_date.year}")
    return (
        IndexPerformance(
            date=current.end_date,
            start_date=current.start_date,
            ytd_return=current.annual_return,
            ytd_max_drawdown=current.max_drawdown,
            source=source,
            note=note,
        ),
        annual,
    )


def fetch_csindex_index_history(target_date: datetime):
    query = parse.urlencode(
        {
            "indexCode": INDEX_CODE,
            "startDate": INDEX_INCEPTION_DATE,
            "endDate": target_date.strftime("%Y%m%d"),
        }
    )
    req = request.Request(
        f"{CSINDEX_PERFORMANCE_URL}?{query}",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.csindex.com.cn/",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        },
    )
    with request.urlopen(req, timeout=60) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    payload = json.loads(raw.decode("utf-8", errors="replace"))
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("中证指数官网未返回中证红利日线")
    import pandas as pd

    daily = pd.DataFrame(
        [
            {
                "date": datetime.strptime(str(row.get("tradeDate")), "%Y%m%d").strftime(
                    "%Y-%m-%d"
                ),
                "close": row.get("close"),
            }
            for row in rows
            if row.get("tradeDate") and row.get("close") is not None
        ]
    )
    if daily.empty:
        raise RuntimeError("中证指数官网日线缺少日期或收盘价")
    return daily


def fetch_index_performance(ak, target_date: datetime) -> IndexPerformance:
    daily, source_method = fetch_akshare_index_history(ak)

    date_col = first_existing(daily.columns, ["日期", "date"])
    close_col = first_existing(daily.columns, ["收盘", "close"])
    performance, _ = build_index_performance(
        daily,
        date_col,
        close_col,
        target_date,
        source=f"AKShare {source_method}",
        note=f"AKShare: {source_method}({INDEX_DAILY_SYMBOL}, {close_col})",
    )
    return performance


def fetch_bond_yield(ak, target_date: datetime) -> BondYield:
    bond = ak.bond_zh_us_rate(
        start_date=target_date.replace(year=target_date.year - 10).strftime("%Y%m%d")
    )
    if bond.empty:
        raise RuntimeError("AKShare did not return China government bond yield data")
    bond_date_col = first_existing(bond.columns, ["日期", "date"])
    bond_rate_col = first_existing(bond.columns, ["中国国债收益率10年", "中国10年期国债"])
    bond = bond.copy()
    bond["_bond_10y_yield"] = bond[bond_rate_col].apply(to_float)
    latest_bond = select_latest_on_or_before(bond, bond_date_col, target_date)
    return BondYield(
        date=latest_bond["_date"].strftime("%Y-%m-%d"),
        yield_10y=float(latest_bond["_bond_10y_yield"]),
        source="AKShare bond_zh_us_rate",
        note="AKShare: bond_zh_us_rate",
    )


def fetch_signal(
    llm_percentile: LixingerPercentile | None = None,
    target_run_date: datetime | None = None,
    on_stage=None,
) -> Signal:
    stage = on_stage or (lambda name: None)
    stage("读取策略参数与依赖")
    strategy = load_strategy()
    ak = import_akshare()
    run_date = target_run_date or datetime.now()
    stage("获取指数估值")
    index_valuation = fetch_index_valuation(ak, run_date)
    latest_date = datetime.fromisoformat(index_valuation.date)
    dividend_yield_2 = index_valuation.dividend_yield
    stage("获取指数日线与年度表现")
    try:
        index_history = fetch_csindex_index_history(latest_date)
        index_performance, annual_performance = build_index_performance(
            index_history,
            "date",
            "close",
            latest_date,
            source="中证指数官网 index-perf",
            note="中证指数官网: index-perf(000922)",
        )
        annual_performance_source = "中证指数官网 index-perf(000922)"
    except Exception:
        fallback_history, fallback_method = fetch_akshare_index_history(ak)
        fallback_date_col = first_existing(fallback_history.columns, ["日期", "date"])
        fallback_close_col = first_existing(fallback_history.columns, ["收盘", "close"])
        index_performance, annual_performance = build_index_performance(
            fallback_history,
            fallback_date_col,
            fallback_close_col,
            latest_date,
            source=f"AKShare {fallback_method}",
            note=f"AKShare: {fallback_method}({INDEX_DAILY_SYMBOL}, {fallback_close_col})",
        )
        annual_performance_source = f"AKShare {fallback_method}({INDEX_DAILY_SYMBOL})"
    stage("获取腾讯行情")
    intraday_quote = get_intraday_realtime_quote()

    stage("获取10年国债收益率")
    bond_yield = fetch_bond_yield(ak, latest_date)
    bond_10y = bond_yield.yield_10y
    spread = dividend_yield_2 - bond_10y

    absolute_signal = evaluate_absolute(dividend_yield_2)
    spread_signal = evaluate_spread(dividend_yield_2, bond_10y)
    headline = "等待V1评分"

    signal = Signal(
        run_date=run_date.strftime("%Y-%m-%d"),
        run_time=datetime.now().strftime("%H:%M:%S"),
        index_date=index_valuation.date,
        bond_date=bond_yield.date,
        akshare_dividend_yield_2=dividend_yield_2,
        ytd_return=index_performance.ytd_return,
        ytd_max_drawdown=index_performance.ytd_max_drawdown,
        intraday_quote_date=intraday_quote.date,
        intraday_change_percent=(
            ""
            if intraday_quote.change_percent is None
            else f"{intraday_quote.change_percent:.2f}"
        ),
        lixinger_date="", lixinger_dividend_yield="", lixinger_percentile_10y="",
        lixinger_percentile_80_value="", lixinger_source="",
        bond_10y_yield=bond_10y,
        spread=spread,
        percentile_signal="",
        absolute_signal=absolute_signal,
        spread_signal=spread_signal,
        headline_signal=headline,
        source_note=(
            f"{index_valuation.note}; {index_performance.note}; {bond_yield.note}; "
            f"{intraday_quote.source}: {intraday_quote.note}"
        ),
        annual_performance=annual_performance,
        annual_performance_source=annual_performance_source,
    )
    history = index_history if annual_performance_source.startswith("中证") else fallback_history
    history_date_col = "date" if annual_performance_source.startswith("中证") else fallback_date_col
    signal.trading_dates = sorted({str(v)[:10] for v in history[history_date_col] if str(v)[:10] <= signal.index_date})
    signal.strategy = strategy
    signal.scoring = score_signal(signal)
    for key, attr in (("absolute", "absolute_signal"), ("ratio", "spread_signal")):
        value = signal.scoring["components"][key]["score"]
        setattr(signal, attr, grade_for_score(value, signal.strategy) if value is not None else "")
    signal.headline_signal = signal.scoring["label"]
    return signal



def output_field_name(name: str) -> str:
    return CSV_HEADER_LABELS.get(name, name)


def signal_output_row(signal: Signal) -> dict[str, object]:
    row = {output_field_name(name): getattr(signal, name, "") for name in CSV_FIELD_ORDER}
    score = signal.scoring
    if score:
        row.update(strategy_version=score["strategyVersion"], composite_score=score["score"],
                   composite_grade=score["grade"], score_lower=score["lower"], score_upper=score["upper"],
                   score_quality="；".join(score["quality"]),
                   confirmation_status=score.get("confirmation", {}).get("message", "证据不足"))
        for key, component in score["components"].items():
            row[key + "_score"] = component["score"]
            row[key + "_contribution"] = component["contribution"]
    return normalize_output_row(row)


def read_rows_from_csv(csv_path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    if not csv_path.exists():
        return rows
    with csv_path.open("r", newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            row_run_date = row.get(CSV_HEADER_LABELS["run_date"], "")
            if row_run_date == CSV_CHINESE_LABELS["run_date"]:
                continue
            rows.append(
                normalize_output_row(
                    {
                        output_field_name(name): row.get(output_field_name(name), row.get("xueqiu_change_percent", "") if name == "intraday_change_percent" else "")
                        for name in CSV_FIELD_ORDER
                    }
                )
            )
    return rows


def read_rows_from_xlsx(xlsx_path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    if not xlsx_path.exists():
        return rows
    try:
        from openpyxl import load_workbook
    except ModuleNotFoundError as exc:
        raise SystemExit("缺少 openpyxl。请安装：pip install openpyxl") from exc

    workbook = load_workbook(xlsx_path)
    sheet = workbook.active
    headers = [cell.value for cell in sheet[1]]
    for values in sheet.iter_rows(min_row=3, values_only=True):
        row = dict(zip(headers, values))
        row_run_date = row.get(CSV_HEADER_LABELS["run_date"], "")
        if row_run_date != CSV_CHINESE_LABELS["run_date"]:
            rows.append(
                normalize_output_row(
                    {
                        output_field_name(name): row.get(output_field_name(name), row.get("xueqiu_change_percent", "") if name == "intraday_change_percent" else "")
                        for name in CSV_FIELD_ORDER
                    }
                )
            )
    return rows


def write_xlsx(
    signal: Signal,
    xlsx_path: Path,
    legacy_csv_path: Path | None = None,
) -> None:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter
    except ModuleNotFoundError as exc:
        raise SystemExit("缺少 openpyxl。请安装：pip install openpyxl") from exc

    xlsx_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = CSV_FIELD_ORDER
    output_fieldnames = [output_field_name(name) for name in fieldnames]
    chinese_labels = [CSV_CHINESE_LABELS.get(name, "") for name in fieldnames]

    rows = read_rows_from_xlsx(xlsx_path)
    if not rows and legacy_csv_path is not None:
        rows = read_rows_from_csv(legacy_csv_path)
    rows = [
        row
        for row in rows
        if row.get(CSV_HEADER_LABELS["run_date"], "") != signal.run_date
        or (row.get("strategy_version") or "legacy") != (signal.scoring.get("strategyVersion") or "legacy")
    ]
    rows.append(signal_output_row(signal))

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "中证红利每日信号"
    sheet.sheet_view.showGridLines = False
    sheet.append(output_fieldnames)
    sheet.append(chinese_labels)
    for row in rows:
        sheet.append([row.get(name, "") for name in output_fieldnames])

    header_fill = PatternFill(fill_type="solid", fgColor=EXCEL_HEADER_FILL)
    label_fill = PatternFill(fill_type="solid", fgColor=EXCEL_LABEL_FILL)
    highlight_fill = PatternFill(
        fill_type="solid",
        fgColor=EXCEL_HIGHLIGHT_FILL,
    )
    thin_border = Border(
        left=Side(style="thin", color=EXCEL_BORDER_COLOR),
        right=Side(style="thin", color=EXCEL_BORDER_COLOR),
        top=Side(style="thin", color=EXCEL_BORDER_COLOR),
        bottom=Side(style="thin", color=EXCEL_BORDER_COLOR),
    )
    center_alignment = Alignment(horizontal="center", vertical="center")
    text_alignment = Alignment(horizontal="left", vertical="center")

    for row_index, row in enumerate(rows, start=3):
        if should_highlight_signal_row(row):
            for column_index in range(1, len(output_fieldnames) + 1):
                sheet.cell(row=row_index, column=column_index).fill = highlight_fill

    bold_columns = {
        output_fieldnames.index(output_field_name(name)) + 1
        for name in EXCEL_BOLD_FIELDS
    }
    for column_index in bold_columns:
        for row_index in range(1, sheet.max_row + 1):
            sheet.cell(row=row_index, column=column_index).font = Font(bold=True)
    for row in sheet.iter_rows(
        min_row=1,
        max_row=sheet.max_row,
        min_col=1,
        max_col=len(output_fieldnames),
    ):
        for cell in row:
            cell.border = thin_border
            cell.alignment = center_alignment
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
    for cell in sheet[2]:
        cell.font = Font(bold=True, color="1F4E78")
        cell.fill = label_fill

    numeric_formats = {
        "akshare_dividend_yield_2": "0.00",
        "ytd_return": "0.00",
        "ytd_max_drawdown": "0.00",
        "intraday_change_percent": "0.00",
        "bond_10y_yield": "0.0000",
        "spread": "0.0000",
        "lixinger_dividend_yield": "0.00",
        "lixinger_percentile_10y": "0.00",
        "lixinger_percentile_80_value": "0.00",
    }
    numeric_formats.update({name: "0.0000" for name in SCORE_FIELD_LABELS if name.endswith(("score", "contribution", "lower", "upper"))})
    for field, number_format in numeric_formats.items():
        column_index = output_fieldnames.index(output_field_name(field)) + 1
        for row_index in range(3, sheet.max_row + 1):
            sheet.cell(row=row_index, column=column_index).number_format = number_format

    for field in ("headline_signal", "lixinger_source"):
        column_index = output_fieldnames.index(output_field_name(field)) + 1
        for row_index in range(3, sheet.max_row + 1):
            sheet.cell(row=row_index, column=column_index).alignment = text_alignment

    for column_index, field in enumerate(fieldnames, start=1):
        values = [
            str(sheet.cell(row=row_index, column=column_index).value or "")
            for row_index in range(1, sheet.max_row + 1)
        ]
        width = min(max(max(len(value) for value in values) + 2, 10), 28)
        if field in {"headline_signal", "lixinger_source"}:
            width = 24
        sheet.column_dimensions[get_column_letter(column_index)].width = width

    sheet.auto_filter.ref = sheet.dimensions
    sheet.freeze_panes = "A3"
    # 中文标签行改为可见；保留 outlineLevel 以便用户在 Excel 里手动折叠。
    sheet.row_dimensions[2].hidden = False
    sheet.row_dimensions[2].outlineLevel = 1
    sheet.sheet_properties.outlinePr.summaryBelow = False
    workbook.save(xlsx_path)


def write_markdown(signal: Signal, md_path: Path) -> None:
    md_path.parent.mkdir(parents=True, exist_ok=True)
    def display_number(value):
        return f"{value:.2f}" if finite(value) else "待验证"

    text = f"""# 中证红利最新股息率信号

- 运行时间：{signal.run_date} {signal.run_time}
- 指数估值日期：{signal.index_date}
- 10年国债收益率日期：{signal.bond_date}
- 中证红利股息率口径：{display_number(signal.akshare_dividend_yield_2)}%
- 全年收益率：{display_number(signal.ytd_return)}%
- 年内最大回撤：{display_number(signal.ytd_max_drawdown)}%
- 当天涨跌幅：{signal.intraday_change_percent + "%" if signal.intraday_change_percent else "待验证"}
- 中国10年国债收益率：{display_number(signal.bond_10y_yield)}%
- 指数股息率口径 - 10年国债收益率：{display_number(signal.spread)}%

## 判断

- 绝对股息率触发：{display_signal_grade(signal.absolute_signal)}
- 相对债券收益率触发：{display_signal_grade(signal.spread_signal)}
- 综合结论：{signal.headline_signal}
- 买入规则：仅综合评级 A 可买入，B / C / D 均不买入；单项指标评级不是买入信号。

## 来源

- {signal.source_note}

## 说明

- 本记录只是按既定规则生成的观察信号，不构成投资建议。
- 指数股息率口径用于绝对股息率、股债利差记录和相对国债收益率倍数评级；当前使用 AKShare `股息率2`。
- 全年收益率和年内最大回撤均按本年度首个交易日至指数估值日期的日收盘价计算。
- 若数据源字段、接口或口径变化，需要重新核对脚本。
"""
    if signal.scoring:
        score = signal.scoring
        value = f"{score['score']:.1f}" if score['score'] is not None else f"{score['lower']:.1f}～{score['upper']:.1f}（不完整）"
        details = ["## 双指标加权评分", "", f"- 策略版本：{score['strategyVersion']}", f"- 综合分：{value}", f"- 综合等级：{score['grade'] or '待验证'}", f"- 数据质量：{'；'.join(score['quality'])}", f"- 连续确认：{score.get('confirmation', {}).get('message', '证据不足')}"]
        for key, item in score["components"].items():
            label = {"absolute": "绝对股息率", "ratio": "股债倍数"}[key]
            detail = "待验证" if item["score"] is None else f"{item['score']:.4f} × {item['weight']}% = {item['contribution']:.4f}；锚点 {item['interval']}"
            details.append(f"- {label}贡献：{detail}")
        details += ["", "等级按未舍入分数判定；缺项不重分配权重。股息率与国债日期未对齐不参与连续确认。参数尚未经收益回测验证。", ""]
        text += "\n" + "\n".join(details)
    md_path.write_text(text, encoding="utf-8")


def write_annual_performance_json(
    annual: list[AnnualPerformance],
    path: Path,
    source: str,
) -> None:
    if not annual:
        raise RuntimeError("No annual performance rows to write")
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "indexCode": INDEX_CODE,
        "source": source,
        "firstDate": annual[0].start_date,
        "lastDate": annual[-1].end_date,
        "returnConvention": "每年首个可用交易日收盘价至末个可用交易日收盘价",
        "drawdownConvention": "每个自然年内日收盘价相对此前峰值的最大跌幅",
        "rows": [asdict(row) for row in annual],
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def numeric_input(value):
    try:
        return float(value) if value not in (None, "") else None
    except (ValueError, TypeError):
        return None


def score_signal(signal, kind="daily"):
    return score_input(
        {"dividendYield": signal.akshare_dividend_yield_2, "bondYield": signal.bond_10y_yield},
        strategy=signal.strategy or load_strategy(),
        dates={"index": signal.index_date, "bond": signal.bond_date},
        source_key="股息率与股债倍数",
        reference=False, kind=kind,
    )


def legacy_score_records(output_dir):
    rows = read_rows_from_xlsx(output_dir / "中证红利每日信号.xlsx")
    if not rows:
        rows = read_rows_from_csv(output_dir / "中证红利每日信号.csv")
    records = []
    for row in rows:
        record = score_input(
            {"dividendYield": numeric_input(row.get("akshare_dividend_yield_2")), "bondYield": numeric_input(row.get("bond_10y_yield"))},
            dates={"index": row.get(CSV_HEADER_LABELS["index_date"], ""), "bond": row.get(CSV_HEADER_LABELS["bond_date"], "")},
            source_key="股息率与股债倍数", reference=False, kind="legacy",
        )
        record["originalHeadline"] = row.get("headline_signal", "")
        record["recordDate"] = row.get(CSV_HEADER_LABELS["run_date"], "")
        records.append(record)
    return records


def write_score_artifact(signal, output_dir, kind="daily"):
    path = output_dir / "评分记录.json"
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    records = previous.get("records", []) or legacy_score_records(output_dir)
    signal.strategy = signal.strategy or load_strategy()
    result = score_signal(signal, kind)
    result["strategySnapshot"] = signal.strategy
    raw = asdict(signal)
    for key in ("scoring", "trading_dates", "annual_performance", "strategy"):
        raw.pop(key, None)
    raw = {key: None if isinstance(value, float) and not finite(value) else value for key, value in raw.items()}
    result.update(raw=raw, recordDate=signal.run_date)
    prior = next((r for r in reversed(records) if r.get("dates", {}).get("index") == signal.index_date), {})
    result["originalHeadline"] = prior.get("originalHeadline") or prior.get("raw", {}).get("headline_signal", "")
    # Preserve the original legacy observation as provenance; it cannot confirm V1.
    records = [r for r in records if not (r.get("dates", {}).get("index") == signal.index_date and r.get("strategyVersion") == result["strategyVersion"])]
    records.append(result)
    records.sort(key=lambda r: r.get("dates", {}).get("index", ""))
    calendar = sorted(set(previous.get("tradingDates", []) + signal.trading_dates))
    result["confirmation"] = confirm_records(records, calendar, signal.strategy["confirmationDays"])
    signal.scoring = result
    payload = {"schemaVersion": 1, "strategy": signal.strategy, "latest": result, "records": records, "tradingDates": calendar}
    output_dir.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)
    return payload


def snapshot_from_local(output_dir):
    text = (output_dir / "最新信号.md").read_text(encoding="utf-8-sig")
    def pick(label):
        match = re.search(r"^- " + re.escape(label) + r"：(.+)$", text, re.M)
        return match.group(1).strip() if match else ""
    def number(label):
        match = re.search(r"-?\d+(?:\.\d+)?", pick(label))
        return float(match.group()) if match else None
    def numeric_text(label):
        value = number(label)
        return str(value) if value is not None else ""
    quote_value = number("当天涨跌幅")
    if quote_value is None:
        quote_value = number("雪球当天涨跌幅")
    run = pick("运行时间").split()
    note = re.search(r"## 来源\s+- (.+)", text)
    source_note = note.group(1) if note else ""
    source = "中证官方指数推算" if "官方指数推算" in source_note else "理杏仁公开页面" if "理杏仁" in source_note else ""
    signal = Signal(
        run_date=run[0] if run else "", run_time=run[1] if len(run) > 1 else "",
        index_date=pick("指数估值日期"), bond_date=pick("10年国债收益率日期"),
        akshare_dividend_yield_2=number("中证红利股息率口径"), bond_10y_yield=number("中国10年国债收益率"),
        ytd_return=number("全年收益率"), ytd_max_drawdown=number("年内最大回撤"),
        intraday_quote_date="", intraday_change_percent=str(quote_value) if quote_value is not None else "", lixinger_date=pick("理杏仁估值日期"),
        lixinger_dividend_yield=numeric_text("理杏仁市值加权股息率"),
        lixinger_percentile_10y=numeric_text("理杏仁近10年股息率分位"),
        lixinger_percentile_80_value=numeric_text("理杏仁近10年80%分位点"),
        lixinger_source=source, spread=number("指数股息率口径 - 10年国债收益率"),
        percentile_signal=pick("历史分位点触发"), absolute_signal=pick("绝对股息率触发"),
        spread_signal=pick("相对债券收益率触发"), headline_signal=pick("综合结论"), source_note=source_note,
    )
    payload = write_score_artifact(signal, output_dir, kind="snapshot")
    signal.headline_signal = signal.scoring["label"]
    write_markdown(signal, output_dir / "历史归档" / "V1参考快照.md")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot-from-local", action="store_true", help="只重算本地原始数据，不联网、不改写旧记录")
    parser.add_argument("--output-dir", default="sources/automations/中证红利信号")
    parser.add_argument("--run-date", default=None, help="Override run date in YYYY-MM-DD")
    parser.add_argument("--llm-lixinger-date", default=None)
    parser.add_argument("--llm-lixinger-dividend-yield", default=None)
    parser.add_argument("--llm-lixinger-percentile-10y", default=None)
    parser.add_argument("--llm-lixinger-percentile-80-value", default=None)
    parser.add_argument("--llm-source-note", default=None)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    if args.snapshot_from_local:
        payload = snapshot_from_local(output_dir)
        print(f"本地参考快照：{payload['latest']['dates']['index']}，{payload['latest']['score']}分")
        return 0
    run_date = args.run_date or local_now().date().isoformat()
    monitor = RunMonitor(output_dir, run_date)
    try:
        target_run_date = datetime.fromisoformat(run_date)
        signal = fetch_signal(target_run_date=target_run_date, on_stage=monitor.stage)
        monitor.stage("写入评分记录")
        write_score_artifact(signal, output_dir)
        monitor.written("评分记录.json")
        monitor.stage("写入每日信号Excel")
        write_xlsx(signal, output_dir / "中证红利每日信号.xlsx",
                   legacy_csv_path=output_dir / "中证红利每日信号.csv")
        monitor.written("中证红利每日信号.xlsx")
        monitor.stage("写入最新信号")
        write_markdown(signal, output_dir / "最新信号.md")
        monitor.written("最新信号.md")
        monitor.stage("写入年度表现")
        write_annual_performance_json(signal.annual_performance,
                                     output_dir / "中证红利年度表现.json", signal.annual_performance_source)
        monitor.written("中证红利年度表现.json")
        monitor.stage("核验输出文件")
        record = monitor.finish()
        if record["status"] == "partial":
            raise RuntimeError(f"输出校验未通过：{record['error']}")
    except BaseException as error:
        monitor.finish(error)
        raise
    print(f"{signal.index_date} {signal.headline_signal}：指数股息率口径 {signal.akshare_dividend_yield_2:.2f}%，股债倍数 {signal.akshare_dividend_yield_2 / signal.bond_10y_yield:.2f}倍")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"中证红利信号检查失败：{exc}", file=sys.stderr)
        raise
