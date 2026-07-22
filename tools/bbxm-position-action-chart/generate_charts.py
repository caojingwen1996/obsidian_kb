#!/usr/bin/env python3
"""为冰冰小美仓位操作案例生成逐标的价格折线图。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd


TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
DEFAULT_SOURCES = [
    REPO_ROOT / "wiki" / "topics" / "冰冰小美-减仓案例合集.md",
    REPO_ROOT / "wiki" / "topics" / "冰冰小美-加仓案例合集.md",
]
DEFAULT_CONFIG = TOOL_DIR / "config.json"
DEFAULT_OUTPUT = REPO_ROOT / "sources" / "assets" / "冰冰小美-仓位操作案例图"
DEFAULT_CACHE = TOOL_DIR / "data"

QUARTERS = {
    "一": (1, 1, 3, 31),
    "二": (4, 1, 6, 30),
    "三": (7, 1, 9, 30),
    "四": (10, 1, 12, 31),
}


@dataclass(frozen=True)
class Action:
    time_text: str
    target: str
    action_type: str
    trigger: str
    action: str
    start: pd.Timestamp
    end: pd.Timestamp
    precise: bool
    direction: str


def split_markdown_row(line: str) -> list[str]:
    """切分 Markdown 表格行，同时保留 Obsidian 链接内转义的竖线。"""
    cells: list[str] = []
    current: list[str] = []
    escaped = False
    for char in line.strip().strip("|"):
        if char == "|" and not escaped:
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        escaped = char == "\\" and not escaped
        if char != "\\":
            escaped = False
    cells.append("".join(current).strip())
    return cells


def parse_time(value: str) -> tuple[pd.Timestamp, pd.Timestamp, bool] | None:
    date_range = re.search(r"(\d{4}-\d{2}-\d{2})\s*[—–至]\s*(\d{4}-\d{2}-\d{2})", value)
    if date_range:
        return pd.Timestamp(date_range.group(1)), pd.Timestamp(date_range.group(2)), False

    exact = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
    if exact:
        point = pd.Timestamp("-".join(exact.groups()))
        return point, point, True

    quarter = re.search(r"(\d{4})\s*年第([一二三四])季度", value)
    if quarter:
        year = int(quarter.group(1))
        start_month, start_day, end_month, end_day = QUARTERS[quarter.group(2)]
        return (
            pd.Timestamp(year, start_month, start_day),
            pd.Timestamp(year, end_month, end_day),
            False,
        )

    half_year = re.search(r"(\d{4})\s*年(上|下)半年", value)
    if half_year:
        year = int(half_year.group(1))
        if half_year.group(2) == "上":
            return pd.Timestamp(year, 1, 1), pd.Timestamp(year, 6, 30), False
        return pd.Timestamp(year, 7, 1), pd.Timestamp(year, 12, 31), False

    uncertain_year = re.search(r"(\d{4})\s*年（具体日期待核验）", value)
    if uncertain_year:
        year = int(uncertain_year.group(1))
        return pd.Timestamp(year, 1, 1), pd.Timestamp(year, 12, 31), False
    return None


def read_actions(source: Path) -> list[Action]:
    lines = source.read_text(encoding="utf-8-sig").splitlines()
    header_index = next(
        (
            index
            for index, line in enumerate(lines)
            if line.startswith("|")
            and "时间（倒序）" in line
            and "触发条件" in line
            and "动作" in line
            and ("减仓分型" in line or "加仓分型" in line)
        ),
        None,
    )
    if header_index is None:
        raise ValueError(f"未在 {source} 找到仓位操作案例表格")

    headers = split_markdown_row(lines[header_index])
    type_column = "加仓分型" if "加仓分型" in headers else "减仓分型"
    target_column = "单个标的" if "单个标的" in headers else "单个标的 / 组合"
    default_direction = "add" if type_column == "加仓分型" else "reduce"
    actions: list[Action] = []
    for line in lines[header_index + 2 :]:
        if not line.startswith("|"):
            break
        cells = split_markdown_row(line)
        if len(cells) != len(headers):
            continue
        row = dict(zip(headers, cells))
        time_range = parse_time(row["时间（倒序）"])
        action_text = row["动作"]
        if time_range is None:
            continue
        direction = default_direction
        if default_direction == "reduce":
            reduce_words = ("减仓", "卖出", "清仓", "降低", "退出")
            add_words = ("加仓", "买入", "买回", "加回", "新增", "增配", "低吸")
            if not any(word in action_text for word in reduce_words) and any(
                word in action_text for word in add_words
            ):
                direction = "add"
        start, end, precise = time_range
        actions.append(
            Action(
                time_text=row["时间（倒序）"],
                target=row[target_column],
                action_type=row[type_column],
                trigger=row["触发条件"],
                action=action_text,
                start=start,
                end=end,
                precise=precise,
                direction=direction,
            )
        )
    return actions


def load_config(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))["targets"]


def normalize_price_frame(frame: pd.DataFrame) -> pd.DataFrame:
    aliases = {
        "日期": "date",
        "date": "date",
        "Date": "date",
        "收盘": "close",
        "close": "close",
        "Close": "close",
    }
    frame = frame.rename(columns={column: aliases.get(str(column), str(column)) for column in frame.columns})
    if "date" not in frame or "close" not in frame:
        raise ValueError("行情数据必须包含 日期/date 与 收盘/close 两列")
    result = frame[["date", "close"]].copy()
    result["date"] = pd.to_datetime(result["date"], errors="coerce")
    result["close"] = pd.to_numeric(result["close"], errors="coerce")
    return result.dropna().drop_duplicates("date").sort_values("date")


def fetch_akshare_prices(target: dict, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    import akshare as ak

    code = target["code"]
    start_text = start.strftime("%Y%m%d")
    end_text = end.strftime("%Y%m%d")
    market = target["market"]
    if market == "a_share":
        frame = ak.stock_zh_a_hist(
            symbol=code, period="daily", start_date=start_text, end_date=end_text, adjust="qfq"
        )
    elif market == "etf":
        frame = ak.fund_etf_hist_em(
            symbol=code, period="daily", start_date=start_text, end_date=end_text, adjust="qfq"
        )
    elif market == "hk":
        frame = ak.stock_hk_hist(
            symbol=code, period="daily", start_date=start_text, end_date=end_text, adjust="qfq"
        )
    else:
        raise ValueError(f"不支持的市场类型：{market}")
    return normalize_price_frame(frame)


def fetch_yfinance_prices(target: dict, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    import yfinance as yf

    yahoo_cache = DEFAULT_CACHE / ".yfinance"
    yahoo_cache.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(yahoo_cache))
    symbol = target["yfinance_symbol"]
    frame = yf.download(
        symbol,
        start=start.strftime("%Y-%m-%d"),
        end=(end + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
        auto_adjust=True,
        progress=False,
    )
    if frame.empty:
        raise ValueError(f"Yahoo Finance 未返回 {symbol} 的行情")
    close = frame["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    return normalize_price_frame(pd.DataFrame({"date": frame.index, "close": close.to_numpy()}))


def fetch_prices(target: dict, start: pd.Timestamp, end: pd.Timestamp) -> tuple[pd.DataFrame, str]:
    errors: list[str] = []
    try:
        return fetch_akshare_prices(target, start, end), "AKShare（前复权日线）"
    except Exception as error:
        errors.append(f"AKShare: {type(error).__name__}: {error}")

    try:
        return fetch_yfinance_prices(target, start, end), "Yahoo Finance（复权日线）"
    except Exception as error:
        errors.append(f"Yahoo Finance: {type(error).__name__}: {error}")
    raise RuntimeError("；".join(errors))


def load_prices(
    target: dict,
    start: pd.Timestamp,
    end: pd.Timestamp,
    cache_dir: Path,
    no_fetch: bool,
    refresh: bool,
) -> tuple[pd.DataFrame, str]:
    cache_file = cache_dir / f"{target['code']}.csv"
    if cache_file.exists() and not refresh:
        frame = normalize_price_frame(pd.read_csv(cache_file, encoding="utf-8-sig"))
        return frame[(frame["date"] >= start) & (frame["date"] <= end)], f"本地缓存 CSV（{target['code']}）"
    if no_fetch:
        raise FileNotFoundError(f"未找到本地行情缓存：{cache_file}")

    frame, source_label = fetch_prices(target, start, end)
    cache_dir.mkdir(parents=True, exist_ok=True)
    frame.to_csv(cache_file, index=False, encoding="utf-8-sig")
    return frame, source_label


def nearest_row(prices: pd.DataFrame, point: pd.Timestamp) -> pd.Series:
    index = (prices["date"] - point).abs().idxmin()
    return prices.loc[index]


def safe_filename(value: str) -> str:
    return re.sub(r'[<>:"/\\|?*]+', "_", value).strip(" .")


def configure_fonts() -> None:
    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def render_chart(
    target_name: str,
    target: dict,
    actions: list[Action],
    prices: pd.DataFrame,
    source_label: str,
    output_dir: Path,
) -> Path:
    if prices.empty:
        raise ValueError("指定区间没有可用行情")

    configure_fonts()
    fig, ax = plt.subplots(figsize=(16, 9), dpi=160)
    fig.patch.set_facecolor("#202020")
    ax.set_facecolor("#242424")
    line_color = "#87a8be"
    ax.plot(prices["date"], prices["close"], color=line_color, linewidth=1.3, label="前复权收盘价")

    legend_used: set[tuple[str, bool]] = set()
    for index, action in enumerate(sorted(actions, key=lambda item: item.start)):
        is_add = action.direction == "add"
        color = "#42c96b" if is_add else "#ef5350"
        point_color = "#66e08a" if is_add else "#ff6b6b"
        text_color = "#c9f7d4" if is_add else "#ffd0d0"
        box_color = "#344a3a" if is_add else "#4a3636"
        direction_text = "加仓" if is_add else "减仓/卖出"
        legend_key = (action.direction, action.precise)
        if action.precise:
            point = nearest_row(prices, action.start)
            ax.axvline(point["date"], color=color, linewidth=1.0, alpha=0.9)
            ax.scatter(
                [point["date"]],
                [point["close"]],
                s=52,
                color=point_color,
                edgecolor=text_color,
                linewidth=0.7,
                zorder=5,
                label=f"精确日期{direction_text}" if legend_key not in legend_used else None,
            )
            label = f"{action.time_text}\n{action.action}\n{action.action_type}"
            ax.annotate(
                label,
                xy=(point["date"], point["close"]),
                xytext=(-32 if index % 2 == 0 else 32, 58 + (index % 3) * 32),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=8.5,
                color=text_color,
                bbox={"boxstyle": "square,pad=0.55", "facecolor": box_color, "edgecolor": "none", "alpha": 0.94},
                arrowprops={"arrowstyle": "-", "color": color, "linewidth": 0.8},
            )
        else:
            ax.axvspan(
                action.start,
                action.end,
                color=color,
                alpha=0.13,
                label=f"日期待核验的{direction_text}区间" if legend_key not in legend_used else None,
            )
            midpoint = action.start + (action.end - action.start) / 2
            point = nearest_row(prices, midpoint)
            ax.annotate(
                f"{action.time_text}\n{action.action}\n{action.action_type}",
                xy=(point["date"], point["close"]),
                xytext=(0, -72 - (index % 2) * 30),
                textcoords="offset points",
                ha="center",
                va="top",
                fontsize=8.5,
                color=text_color,
                bbox={"boxstyle": "square,pad=0.55", "facecolor": box_color, "edgecolor": "none", "alpha": 0.94},
                arrowprops={"arrowstyle": "-", "color": color, "linewidth": 0.8},
            )
        legend_used.add(legend_key)

    ax.set_title(
        f"{target['display_name']}（{target['code']}）仓位操作与价格走势",
        color="#d7e8f5",
        fontsize=17,
        pad=18,
    )
    ax.set_ylabel("前复权收盘价", color="#b6cada")
    ax.tick_params(axis="both", colors="#a9c4d6")
    ax.grid(True, color="#464646", linewidth=0.6, alpha=0.55)
    for spine in ax.spines.values():
        spine.set_color("#3c3c3c")
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=8, maxticks=14))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.22), ncol=3, frameon=False, labelcolor="#d7e8f5")

    fig.text(
        0.09,
        0.055,
        "历史案例复盘，不构成投资建议。区间带仅表示原始记录的时间精度，不代表区间中点为成交日。\n"
        f"行情来源：{source_label}；动作来源：冰冰小美-加仓/减仓案例合集。",
        color="#e8df9a",
        fontsize=8.5,
        bbox={"boxstyle": "square,pad=0.65", "facecolor": "#45443d", "edgecolor": "none", "alpha": 0.85},
    )
    fig.subplots_adjust(left=0.08, right=0.97, top=0.9, bottom=0.25)

    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{safe_filename(target_name)}-仓位操作.png"
    fig.savefig(path, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    return path


def group_actions(actions: Iterable[Action], targets: dict) -> tuple[dict[str, list[Action]], list[Action]]:
    grouped: dict[str, list[Action]] = {}
    skipped: list[Action] = []
    for action in actions:
        if action.target in targets:
            grouped.setdefault(action.target, []).append(action)
        else:
            skipped.append(action)
    return grouped, skipped


def build_report(generated: list[tuple[str, Path]], skipped: list[Action], failed: list[tuple[str, str]]) -> str:
    lines = ["# 冰冰小美仓位操作图生成报告", ""]
    lines.extend([f"- 生成日期：{date.today().isoformat()}", f"- 成功生成：{len(generated)} 张", ""])
    if generated:
        lines.extend(["## 已生成", ""])
        lines.extend(f"- {target}：[{path.name}]({path.name})" for target, path in generated)
        lines.append("")
    if skipped:
        lines.extend(["## 未映射为单一证券", ""])
        lines.extend(f"- {item.time_text}｜{item.target}｜{item.action}" for item in skipped)
        lines.append("")
    if failed:
        lines.extend(["## 生成失败", ""])
        lines.extend(f"- {target}：{message}" for target, message in failed)
        lines.append("")
    lines.extend(
        [
            "## 口径说明",
            "",
            "- 精确日期以竖线和圆点标注；周、季度、半年或年份级日期以完整时间区间带标注。",
            "- 加仓、建仓、买回和低吸使用绿色；减仓、卖出和清仓使用红色。",
            "- 图中价格使用前复权日线；历史动作不构成当前投资建议。",
        ]
    )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="读取加仓/减仓案例 Topic 表格并生成逐标的价格折线图")
    parser.add_argument(
        "--source",
        type=Path,
        action="append",
        default=None,
        help="案例 Topic Markdown 路径，可重复使用；默认读取加仓与减仓案例页",
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="证券代码映射 JSON")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT, help="图片输出目录")
    parser.add_argument("--prices-dir", type=Path, default=DEFAULT_CACHE, help="行情 CSV 缓存目录")
    parser.add_argument("--only", action="append", default=[], help="只生成指定标的，可重复使用")
    parser.add_argument("--no-fetch", action="store_true", help="只使用本地 CSV，不访问行情接口")
    parser.add_argument("--refresh", action="store_true", help="忽略已有缓存，重新拉取行情")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sources = args.source or DEFAULT_SOURCES
    actions = [action for source in sources for action in read_actions(source)]
    targets = load_config(args.config)
    grouped, skipped = group_actions(actions, targets)
    if args.only:
        requested = set(args.only)
        unknown = requested - set(grouped)
        if unknown:
            print(f"未找到可绘制标的：{', '.join(sorted(unknown))}", file=sys.stderr)
            return 2
        grouped = {name: value for name, value in grouped.items() if name in requested}

    generated: list[tuple[str, Path]] = []
    failed: list[tuple[str, str]] = []
    today = pd.Timestamp(date.today())
    for target_name, target_actions in grouped.items():
        start = min(item.start for item in target_actions) - pd.Timedelta(days=240)
        end = min(max(item.end for item in target_actions) + pd.Timedelta(days=150), today)
        try:
            prices, source_label = load_prices(
                targets[target_name], start, end, args.prices_dir, args.no_fetch, args.refresh
            )
            path = render_chart(
                target_name,
                targets[target_name],
                target_actions,
                prices,
                source_label,
                args.output_dir,
            )
            generated.append((target_name, path))
            print(f"已生成：{path}")
        except Exception as error:  # 每个标的独立失败，确保报告保留完整边界
            failed.append((target_name, f"{type(error).__name__}: {error}"))
            print(f"生成失败：{target_name}：{error}", file=sys.stderr)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = args.output_dir / "生成报告.md"
    report.write_text(build_report(generated, skipped, failed), encoding="utf-8")
    print(f"生成报告：{report}")
    return 0 if generated and not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
