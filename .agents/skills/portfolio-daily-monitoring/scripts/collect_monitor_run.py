#!/usr/bin/env python3
"""Collect a portfolio monitoring run from portfolio.json and local Tushare data."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path


RANGE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:—|–|-|至|到)\s*(\d+(?:\.\d+)?)\s*元")
UPDATED_RE = re.compile(r"^updated:\s*[\"']?(\d{4}-\d{2}-\d{2})", re.MULTILINE)


def ts_code(code: str) -> str:
    return f"{code}.SH" if code.startswith(("6", "9")) else f"{code}.SZ"


def pct_change(current: float, previous: float) -> float:
    return (current / previous - 1) * 100 if previous else 0.0


def report_metadata(targets_dir: Path, name: str, prior: dict | None) -> tuple[str, str, float, float]:
    candidates = [path for path in targets_dir.glob(f"*{name}*机构级决策研报.md") if path.is_file()]
    ranked: list[tuple[str, float, Path, str]] = []
    for path in candidates:
        text = path.read_text(encoding="utf-8-sig")
        match = UPDATED_RE.search(text)
        updated = match.group(1) if match else datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
        ranked.append((updated, path.stat().st_mtime, path, text))
    if ranked:
        updated, _, path, text = max(ranked, key=lambda row: (row[0], row[1]))
        for line in text.splitlines()[:120]:
            if "估值区间" not in line and "公允价值区间" not in line:
                continue
            match = RANGE_RE.search(line.replace("**", ""))
            if match:
                return path.name, updated, float(match.group(1)), float(match.group(2))
    if prior:
        return prior["report_file"], prior["report_date"], float(prior["value_low"]), float(prior["value_high"])
    raise RuntimeError(f"未获取到 {name} 的权威研报估值区间")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portfolio", required=True, type=Path)
    parser.add_argument("--prior-run", required=True, type=Path)
    parser.add_argument("--targets-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--date", required=True)
    parser.add_argument("--run-time", required=True)
    parser.add_argument("--news-source-note", default="")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parents[4] / "tools" / "tushare-data" / "scripts"
    sys.path.insert(0, str(script_dir))
    from tushare_client import TushareClient, frame_to_rows  # noqa: PLC0415

    portfolio = json.loads(args.portfolio.read_text(encoding="utf-8-sig"))
    tracking = [item for item in portfolio.get("trackingItems", []) if item.get("status") in {"持有", "观察"}]
    prior_run = json.loads(args.prior_run.read_text(encoding="utf-8-sig"))
    prior_by_name = {item["name"]: item for item in prior_run.get("items", [])}

    client = TushareClient()
    calendar = frame_to_rows(
        client.pro().trade_cal(
            exchange="SSE",
            start_date=args.date.replace("-", ""),
            end_date=args.date.replace("-", ""),
        )
    )
    is_trading_day = bool(calendar and int(calendar[0].get("is_open", 0)) == 1)
    basic_rows = client.stock_basic(use_cache=True).to_dict("records")
    basic_by_name = {row.get("name"): row for row in basic_rows}
    run_day = date.fromisoformat(args.date)
    start_date = (run_day - timedelta(days=50)).isoformat()
    end_date = (run_day - timedelta(days=1)).isoformat()
    items: list[dict] = []
    trade_dates: list[str] = []

    for tracked in tracking:
        name = tracked["name"]
        prior = prior_by_name.get(name)
        verified = basic_by_name.get(name)
        code = str(tracked.get("code") or "").strip()
        if not code and verified:
            code = str(verified["ts_code"]).split(".")[0]
        if verified and code and str(verified["ts_code"]).split(".")[0] != code:
            raise RuntimeError(f"{name} 的 portfolio 代码 {code} 与 Tushare {verified['ts_code']} 冲突")
        if not re.fullmatch(r"\d{6}", code):
            raise RuntimeError(f"{name} 的证券代码待核实，当前采集脚本不猜测代码")

        daily = client.daily(ts_code=ts_code(code), start_date=start_date, end_date=end_date, use_cache=False).to_dict("records")
        daily = sorted(daily, key=lambda row: row["trade_date"], reverse=True)
        if len(daily) < 6:
            raise RuntimeError(f"{name} 日线数据不足 6 个交易日")
        valuation = client.daily_basic(ts_code=ts_code(code), start_date=start_date, end_date=end_date, use_cache=False).to_dict("records")
        valuation = sorted(valuation, key=lambda row: row["trade_date"], reverse=True)
        if not valuation:
            raise RuntimeError(f"{name} 未获取到 daily_basic")

        latest = daily[0]
        latest_basic = valuation[0]
        trade_date = latest["trade_date"]
        trade_dates.append(trade_date)
        week_start = datetime.strptime(trade_date, "%Y-%m-%d").date() - timedelta(days=datetime.strptime(trade_date, "%Y-%m-%d").date().weekday())
        week_rows = [row for row in daily if datetime.strptime(row["trade_date"], "%Y-%m-%d").date() >= week_start]
        amount_window = daily[:20]
        amount_average = sum(float(row["amount"]) for row in amount_window) / len(amount_window)
        turnover_window = valuation[:20]
        turnover_average = sum(float(row.get("turnover_rate") or 0) for row in turnover_window) / len(turnover_window)
        report_file, report_date, value_low, value_high = report_metadata(args.targets_dir, name, prior)

        triggers: list[str] = []
        daily_pct = float(latest["pct_chg"])
        five_pct = pct_change(float(latest["close"]), float(daily[5]["close"]))
        amount_ratio = float(latest["amount"]) / amount_average if amount_average else 0.0
        turnover = float(latest_basic.get("turnover_rate") or 0)
        turnover_ratio = turnover / turnover_average if turnover_average else 0.0
        close = float(latest["close"])
        if abs(daily_pct) >= 5:
            triggers.append(f"单日涨跌幅 {daily_pct:+.2f}% 的绝对值 ≥ 5%")
        if abs(five_pct) >= 10:
            triggers.append(f"近 5 日累计涨跌幅 {five_pct:+.2f}% 的绝对值 ≥ 10%")
        if amount_ratio >= 2:
            triggers.append(f"成交额为近 20 日均值 {amount_ratio:.2f} 倍 ≥ 2 倍")
        if turnover_ratio >= 2:
            triggers.append(f"换手率为近 20 日均值 {turnover_ratio:.2f} 倍 ≥ 2 倍")
        if close < value_low:
            triggers.append(f"价格 {close:.2f} 元低于动态估值区间下沿 {value_low:.2f} 元")
        elif close > value_high:
            triggers.append(f"价格 {close:.2f} 元高于动态估值区间上沿 {value_high:.2f} 元")

        item = {
            "code": code,
            "name": name,
            "status": tracked["status"],
            "report_file": report_file,
            "report_date": report_date,
            "value_low": value_low,
            "value_high": value_high,
            "close": close,
            "daily_pct": daily_pct,
            "week_pct": pct_change(close, float(week_rows[-1]["pre_close"])),
            "five_pct": five_pct,
            "amount": float(latest["amount"]) / 100000,
            "amount_ratio": amount_ratio,
            "turnover": turnover,
            "turnover_ratio": turnover_ratio,
            "pe": float(latest_basic.get("pe_ttm") or 0),
            "pb": float(latest_basic.get("pb") or 0),
            "triggers": triggers,
        }

        if prior and prior.get("revalue") in {"LIGHT_REVALUE", "FULL_REVALUE", "MANUAL_REVIEW"} and report_date <= prior.get("report_date", ""):
            preserved = {key: value for key, value in prior.items() if key not in item and key not in {"announcements"}}
            item.update(preserved)
            if value_low <= close <= value_high:
                item["reason"] = str(item.get("reason", "")).replace("，现价又高于旧上沿", "；估值模型仍未完成更新")
                item["confirmed_reason"] = f"{trade_date} 量价按默认规则复核；价格已回到旧估值区间内，但此前触发的模型输入变化仍未完成重算"
                item["counter"] = str(item.get("counter", "")).replace("现价已高于旧区间上沿", "现价已回到旧区间内，但单日波动较大")
        elif triggers:
            item.update({
                "revalue": "NO_REVALUE",
                "judgment": "无实质影响",
                "hypothesis": "H3 估值与市场预期",
                "needs_review": True,
                "review_priority": "P2",
                "reason": "；".join(triggers) + "；未发现达到默认阈值的新增盈利、现金流或商业事实输入",
                "quick_conclusion": "量价或区间规则已触发，需要复核安全边际与市场波动；价格本身不触发价值重算。",
                "confirmed_reason": "已确认触发默认量价或估值区间规则",
                "unconfirmed": "异常交易驱动与可审计行业相对表现未确认",
                "support": "最新权威研报核心经营基线未被新增正式事实推翻",
                "counter": "量价或区间异常提高复盘必要性，但不能单独证明基本面变化",
                "impact_path": "量价或区间异常 → 安全边际与市场预期变化 → 需要人工复盘；不直接改写盈利与现金流假设",
                "review_task": "核对异常持续性、行业相对表现及后续正式公告",
            })
        items.append(item)

    if not items:
        raise RuntimeError("当前 portfolio.json 没有持有或观察标的")
    trade_date = max(trade_dates)
    if any(value != trade_date for value in trade_dates):
        raise RuntimeError(f"标的最新交易日不一致：{sorted(set(trade_dates))}")
    latest_day = date.fromisoformat(trade_date)
    run = {
        "date": args.date,
        "trade_date": trade_date,
        "run_time": args.run_time,
        "monitor_state": f"盘前口径监控；{args.date} {'为交易日' if is_trading_day else '为非交易日'}（Tushare trade_cal）；实际执行时间为 {args.run_time}，行情仅使用最近已完成交易日 {trade_date} 收盘，不混用当日盘中数据",
        "week_note": f"本周截至 {trade_date} 的已完成交易日口径",
        "news_source_note": args.news_source_note,
        "items": items,
    }
    args.output.write_text(json.dumps(run, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Collected {len(items)} targets through {trade_date}; week anchor {latest_day.isoformat()}; portfolio rows {len(tracking)}")


if __name__ == "__main__":
    main()
