#!/usr/bin/env python3
"""Render a portfolio daily-monitor Markdown report as a standalone HTML page."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

import markdown


STATUS_LABELS = {
    "NO_REVALUE": "维持估值",
    "LIGHT_REVALUE": "局部重算",
    "FULL_REVALUE": "完整重估",
    "MANUAL_REVIEW": "人工判断",
}


def title_from_markdown(source: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", source, re.MULTILINE)
    return match.group(1).strip() if match else "持仓今日监控"


def monitor_date(source: str) -> str:
    match = re.search(r"^-\s*监控日期[：:]\s*(.+?)\s*$", source, re.MULTILINE)
    return match.group(1).strip() if match else "日期未提供"


def decorate_statuses(rendered: str) -> str:
    for status, label in STATUS_LABELS.items():
        pattern = rf"<code>{status}</code>|(?<![\w]){status}(?![\w])"
        badge = (
            f'<span class="valuation-status valuation-status--{status.lower()}" '
            f'title="{status}"><strong>{label}</strong><small>{status}</small></span>'
        )
        rendered = re.sub(pattern, badge, rendered)
    return rendered


def build_html(source: str) -> str:
    title = title_from_markdown(source)
    date = monitor_date(source)
    body = markdown.markdown(
        source,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
        output_format="html5",
    )
    body = decorate_statuses(body)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="daily-monitor-date" content="{html.escape(date, quote=True)}">
  <title>{html.escape(title)}</title>
  <style>
    :root {{ color-scheme: light; --ink:#10263a; --muted:#607284; --line:#dce4ea; --blue:#246fd0; --surface:#fff; --page:#f3f6f8; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; background:var(--page); color:var(--ink); font:14px/1.72 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif; }}
    main {{ width:min(1180px,calc(100% - 32px)); margin:28px auto 56px; padding:30px clamp(20px,4vw,54px); background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 16px 44px rgba(20,42,62,.08); }}
    h1 {{ margin:0 0 24px; font-size:clamp(26px,4vw,38px); line-height:1.25; }}
    h2 {{ margin:38px 0 16px; padding-bottom:9px; border-bottom:2px solid #d6e3f2; font-size:22px; }}
    h3 {{ margin:30px 0 12px; font-size:18px; }}
    h4 {{ margin:24px 0 10px; font-size:15px; }}
    p, li {{ max-width:88ch; }}
    blockquote {{ margin:14px 0; padding:10px 14px; border-left:4px solid var(--blue); background:#f3f7fc; color:#36526b; }}
    code {{ padding:2px 5px; border-radius:4px; background:#eef2f5; font-size:.92em; }}
    table {{ display:block; width:100%; overflow-x:auto; border-collapse:collapse; margin:12px 0 20px; font-size:12px; }}
    th,td {{ min-width:112px; padding:9px 10px; border:1px solid var(--line); text-align:left; vertical-align:top; }}
    th {{ background:#f4f7fa; color:#41576b; white-space:nowrap; }}
    a {{ color:var(--blue); text-underline-offset:3px; }}
    .report-meta {{ display:flex; flex-wrap:wrap; gap:8px; margin:-12px 0 26px; color:var(--muted); font-size:12px; }}
    .report-meta span {{ padding:5px 9px; border:1px solid var(--line); border-radius:999px; background:#f8fafb; }}
    .valuation-status {{ display:inline-flex; align-items:baseline; gap:6px; padding:3px 7px; border-radius:6px; font-size:12px; white-space:nowrap; }}
    .valuation-status small {{ font-size:9px; opacity:.72; }}
    .valuation-status--no_revalue {{ background:#edf5f2; color:#176c5c; }}
    .valuation-status--light_revalue {{ background:#fff6dc; color:#785b12; }}
    .valuation-status--full_revalue {{ background:#fff0e8; color:#a0441f; }}
    .valuation-status--manual_review {{ background:#f2ecfb; color:#634194; }}
    @media (max-width:640px) {{ main {{ width:100%; margin:0; padding:22px 16px 42px; border:0; border-radius:0; }} h2 {{ font-size:19px; }} }}
    @media print {{ body {{ background:#fff; }} main {{ width:100%; margin:0; border:0; box-shadow:none; }} }}
  </style>
</head>
<body>
  <main>
    <div class="report-meta"><span>{html.escape(date)}</span><span>HTML 阅读版</span><span>不构成买卖指令</span></div>
    {body}
  </main>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.input.read_text(encoding="utf-8-sig")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_html(source), encoding="utf-8")
    print(f"Rendered {args.output}")


if __name__ == "__main__":
    main()
