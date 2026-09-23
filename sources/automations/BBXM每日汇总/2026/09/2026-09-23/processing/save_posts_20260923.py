#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""保存 2026-09-23 冰冰小美原帖（复用 content_task.py 的规范化/去重/状态函数）。

最终路径固定在 sources/automations/BBXM每日汇总/2026/09/2026-09-23，
不使用 content_task 默认的 {yyyymmdd}/{author} 布局。
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

REPO = Path(r"E:\caojingwen\obsidian\llmwiki")
SKILL_SCRIPTS = REPO / ".agents" / "skills" / "cjw-xueqiu-daily-monitor" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

import content_task as ct  # noqa: E402
from utils import init_logger, write_log  # noqa: E402

TARGET = date(2026, 9, 23)
AUTHOR = "冰冰小美"
ACCOUNT_URL = "https://xueqiu.com/u/7143769715"
OUT_DIR = REPO / "sources" / "automations" / "BBXM每日汇总" / "2026" / "09" / "2026-09-23"
EXTRACT = OUT_DIR / "processing" / "extract-2026-09-23.json"
TAGS = {
    "410325412": "市场，宏观，交易",
    "410315643": "市场，交易",
    "410310788": "市场，交易",
    "410307862": "市场，行业，交易",
}

PUA = re.compile(r"[\ue000-\uf8ff]")
ZW = re.compile(r"[\u200b-\u200f\u202a-\u202e\ufeff]")


def clean_body(raw: str) -> str:
    t = str(raw or "").replace("\r\n", "\n").replace("\r", "\n")
    t = PUA.sub("", t)
    t = ZW.sub("", t)

    start = 0
    marker = re.search(r"发布于\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}", t)
    if marker:
        tail = t[marker.end():]
        gm = re.search(r"\n\s*关注\s*\n", tail)
        start = marker.end() + (gm.end() if gm else 0)
    body = t[start:]

    cut = body.find("风险提示：用户发表的所有文章")
    if cut != -1:
        body = body[:cut]

    body = re.sub(r"[ \t\u3000]+", "", body)
    flat = body.replace("\n", "").strip()

    paragraphs: list[str] = []
    buf = ""
    for piece in re.split(r"(?<=[。！？])", flat):
        if not piece.strip():
            continue
        buf += piece
        if len(buf) >= 40:
            paragraphs.append(buf.strip())
            buf = ""
    if buf.strip():
        if paragraphs:
            paragraphs[-1] += buf.strip()
        else:
            paragraphs.append(buf.strip())
    return "\n\n".join(p for p in paragraphs if p)


def main() -> int:
    items = json.loads(EXTRACT.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUT_DIR / "task.log"
    logger = init_logger(name="bbxm_brief_20260923", log_file=log_file)
    write_log(logger, "info", f"开始保存原帖 target_date={TARGET.isoformat()} author={AUTHOR} 候选={len(items)}")

    state = ct.ensure_day_state(OUT_DIR, AUTHOR, ACCOUNT_URL, TARGET)
    existing_keys = ct.load_existing_keys(OUT_DIR)
    existing_keys.update(state.get("processed_items", {}).keys())

    report: list[str] = []
    saved = 0
    skipped = 0
    for payload in items:
        raw_content = payload.get("content") or ""
        content = clean_body(raw_content)
        payload = dict(payload)
        payload["content"] = content
        payload["platform"] = "xueqiu"
        try:
            record = ct.normalize_extracted_post(payload, TARGET, AUTHOR, date_filter="target-date")
        except Exception as exc:  # noqa: BLE001
            write_log(logger, "error", f"记录无效: {exc} | url={payload.get('url')}")
            report.append(f"INVALID {payload.get('url')} :: {exc}")
            continue

        key = record.content_id or record.url
        if key in existing_keys or record.url in existing_keys:
            skipped += 1
            write_log(logger, "info", f"跳过重复帖子: {record.url}")
            continue

        ct.append_processing_payload(OUT_DIR, payload)
        paths = ct.save_posts_to_files([record], OUT_DIR, logger)
        for file_path in paths:
            # 补写标签：位于 抓取时间： 之后、正文： 之前
            text = file_path.read_text(encoding="utf-8")
            tag = TAGS.get(record.content_id, "市场")
            if "标签：" not in text:
                text = text.replace("\n\n正文：", f"\n标签：{tag}\n\n正文：", 1)
                file_path.write_text(text, encoding="utf-8")
            ct.update_day_state(OUT_DIR, state, record, file_path)
            existing_keys.add(key)
            existing_keys.add(record.url)
            saved += 1
            report.append(f"SAVED {file_path.name} | published={record.publish_time} | tags={tag} | body_len={len(content)}")
            write_log(logger, "info", f"保存完成并补写标签: {file_path}")

    state = ct.read_json_file(OUT_DIR / "state.json", {})
    state["end_time"] = datetime.now().isoformat(sep=" ", timespec="seconds")
    ct.write_json_file(OUT_DIR / "state.json", state)
    write_log(logger, "info", f"本轮保存 {saved} 篇，跳过重复 {skipped} 篇")

    (OUT_DIR / "processing" / "save-report.txt").write_text(
        "\n".join(report) + f"\n\nsaved={saved} skipped={skipped}\n", encoding="utf-8"
    )
    ct.close_logger_handlers(logger)
    print(f"saved={saved} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
