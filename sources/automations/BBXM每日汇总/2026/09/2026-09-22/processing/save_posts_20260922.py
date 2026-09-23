"""一次性保存脚本：把 2026-09-22 的提取结果写入 BBXM每日汇总 日期目录，并补写标签行。

复用 content_task 的既有函数，保持命名与去重行为一致；输出路径按主提示词固定为
sources/automations/BBXM每日汇总/{YEAR}/{MONTH}/{DATE}/，不再嵌套作者子目录。

与 09-18 版差异：
- 输入改为 processing/extracted-posts-run2.json（当天 17:34 重跑因冷启动竞态返回空，
  17:57 修复前重跑成功，含 3 篇当日帖）；
- 410215494 为图片帖，提取标题是页面默认标题「雪球-聪明的投资者都在这里」，
  保存前覆盖为可读标题「图片帖（无文字正文）」。
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

TARGET_DATE = date(2026, 9, 22)
RESULT_DIR = Path(
    r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-22"
)
INPUT_FILE = RESULT_DIR / "processing" / "extracted-posts-run2.json"
AUTHOR = "冰冰小美"
ACCOUNT_URL = "https://xueqiu.com/u/7143769715"

# 图片帖标题覆盖：提取到的标题是页面默认标题，无信息量
TITLE_OVERRIDES = {
    "410215494": "图片帖（无文字正文）",
}

# 标签判定词表：宏观 / 市场 / 行业 / 交易
TAG_RULES = [
    ("宏观", ["加息", "利率", "美联储", "通胀", "降息", "关税", "宏观", "货币", "财政",
              "国债", "收益率", "经济", "GDP", "汇率", "民主党", "household", "income",
              "US ", "government", "Fed", "inflation", "央行", "货币政策"]),
    ("市场", ["市场", "牛市", "熊市", "指数", "大盘", "情绪", "风格", "板块", "轮动",
              "涨", "跌", "利好", "利空", "氛围", "预期", "印花税", "成交", "资金",
              "Market", "expectations", "热榜", "3000点", "散户", "高开低走"]),
    ("行业", ["行业", "产业", "科技", "AI", "半导体", "芯片", "新能源", "医药", "消费",
              "firms", "AI ", "科技股", "融券"]),
    ("交易", ["贴单", "抄作业", "买入", "卖出", "加仓", "减仓", "仓位", "止损", "止盈",
              "交易", "短线", "次新股", "持仓", "做T", "择时", "控仓", "投机", "入场"]),
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
    logger = init_logger(name="bbxm.daily.20260922", log_file=RESULT_DIR / "task.log")

    raw = json.loads(INPUT_FILE.read_text(encoding="utf-8"))
    for item in raw:
        pid = (re.search(r"/(\d+)$", str(item.get("url") or "")) or [None, ""])[1]
        if pid in TITLE_OVERRIDES:
            item["title"] = TITLE_OVERRIDES[pid]

    INPUT_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    items = load_input_items(INPUT_FILE)
    print(f"input_items={len(items)}")

    state = ensure_day_state(RESULT_DIR, AUTHOR, ACCOUNT_URL, TARGET_DATE)
    saved_keys: set[str] = set(state.get("processed_items", {}).keys())
    for p in RESULT_DIR.glob("*.md"):
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
