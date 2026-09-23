"""一次性保存脚本：把 2026-09-18 的提取结果写入 BBXM每日汇总 日期目录，并补写标签行。

复用 content_task 的既有函数，保持命名与去重行为一致；输出路径按主提示词固定为
sources/automations/BBXM每日汇总/{YEAR}/{MONTH}/{DATE}/，不再嵌套作者子目录。
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

SKILL_SCRIPTS = Path(r"E:\caojingwen\obsidian\llmwiki\.agents\skills\cjw-xueqiu-daily-monitor\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))

from content_task import (  # noqa: E402
    NonTargetDateError,
    append_processing_payload,
    ensure_day_state,
    init_logger,
    load_input_items,
    normalize_extracted_post,
    save_posts_to_files,
    update_day_state,
    write_log,
    close_logger_handlers,
)

TARGET_DATE = date(2026, 9, 18)
RESULT_DIR = Path(
    r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18"
)
INPUT_FILE = RESULT_DIR / "processing" / "extracted-posts.json"
AUTHOR = "冰冰小美"
ACCOUNT_URL = "https://xueqiu.com/u/7143769715"

# 标签判定词表：宏观 / 市场 / 行业 / 交易
TAG_RULES = [
    ("宏观", ["加息", "利率", "美联储", "通胀", "降息", "关税", "宏观", "货币", "财政",
              "国债", "收益率", "经济", "GDP", "汇率", "民主党", "household", "income",
              "US ", "government", "Fed", "inflation"]),
    ("市场", ["市场", "牛市", "熊市", "指数", "大盘", "情绪", "风格", "板块", "轮动",
              "涨", "跌", "利好", "利空", "氛围", "预期", "印花税", "成交", "资金",
              "Market", "expectations"]),
    ("行业", ["行业", "产业", "科技", "AI", "半导体", "芯片", "新能源", "医药", "消费",
              "firms", "AI "]),
    ("交易", ["贴单", "抄作业", "买入", "卖出", "加仓", "减仓", "仓位", "止损", "止盈",
              "交易", "短线", "次新股", "持仓", "做T"]),
]


def infer_tags(title: str, content: str) -> list[str]:
    text = f"{title}\n{content}"
    tags: list[str] = []
    for tag, keywords in TAG_RULES:
        if any(kw in text for kw in keywords):
            tags.append(tag)
    return tags or ["市场"]


def insert_tags_between_fetch_and_body(path: Path, tags: list[str]) -> bool:
    """在 `抓取时间：` 行之后、`正文：` 之前插入标签行。已存在则跳过。"""
    text = path.read_text(encoding="utf-8")
    if re.search(r"^标签：", text, flags=re.MULTILINE):
        return False
    lines = text.splitlines()
    out: list[str] = []
    inserted = False
    for line in lines:
        out.append(line)
        if not inserted and line.startswith("抓取时间："):
            out.append(f"标签：{'，'.join(tags)}")
            inserted = True
    if not inserted:
        return False
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return True


def main() -> int:
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    (RESULT_DIR / "processing").mkdir(exist_ok=True)
    logger = init_logger(name="bbxm.backfill.20260918", log_file=RESULT_DIR / "task.log")

    items = load_input_items(INPUT_FILE)
    print(f"input_items={len(items)}")

    state = ensure_day_state(RESULT_DIR, AUTHOR, ACCOUNT_URL, TARGET_DATE)
    saved_keys: set[str] = set(state.get("processed_items", {}).keys())
    existing_md = RESULT_DIR.glob("*.md")
    for p in existing_md:
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("内容ID：") or line.startswith("原始链接："):
                saved_keys.add(line.partition("：")[2].strip())

    kept = skipped_date = failed = 0
    new_files: list[Path] = []
    tag_filled: list[str] = []

    for payload in items:
        try:
            record = normalize_extracted_post(payload, TARGET_DATE, AUTHOR, date_filter="target-date")
        except NonTargetDateError as exc:
            skipped_date += 1
            write_log(logger, "info", f"跳过非目标日期内容: {exc}")
            continue
        except Exception as exc:  # noqa: BLE001
            failed += 1
            write_log(logger, "error", f"输入记录无效: {exc}")
            continue

        kept += 1
        dedupe_key = record.content_id or record.url
        if dedupe_key in saved_keys or record.url in saved_keys:
            write_log(logger, "info", f"跳过重复帖子: {record.url}")
            continue

        saved = save_posts_to_files([record], RESULT_DIR, logger)
        for fp in saved:
            tags = infer_tags(record.title, record.content)
            if insert_tags_between_fetch_and_body(fp, tags):
                tag_filled.append(f"{fp.name} -> {'，'.join(tags)}")
            update_day_state(RESULT_DIR, state, record, fp)
            new_files.append(fp)
            saved_keys.add(dedupe_key)
            saved_keys.add(record.url)
        append_processing_payload(RESULT_DIR, payload)

    state["end_time"] = datetime.now().isoformat(sep=" ", timespec="seconds")
    (RESULT_DIR / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    close_logger_handlers(logger)
    print(f"target_date={TARGET_DATE} kept={kept} skipped_date={skipped_date} failed={failed}")
    print(f"new_saved={len(new_files)}")
    for fp in new_files:
        print(f"  FILE {fp.name}")
    print(f"tags_written={len(tag_filled)}")
    for t in tag_filled:
        print(f"  TAG {t}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
