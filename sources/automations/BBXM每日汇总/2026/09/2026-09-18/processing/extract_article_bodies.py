"""从 column-posts.json 中提取作者专栏正文（剔除评论与页面外壳），写入 article-bodies.json。

背景：雪球专栏页的「关注」之后、页面外壳之前才是作者原文。
社区页对专栏文章只显示他人评论，所以必须以专栏页为准。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
SRC = RESULT_DIR / "processing" / "column-posts.json"
DST = RESULT_DIR / "processing" / "article-bodies.json"

ICON = re.compile(r"[\ue600-\ue7ff\ufeff]")

# 专栏正文起点：作者名 + 「发布于…」+ 地区 + 「关注」
START = re.compile(r"发布于\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.*?关注\n", re.S)
# 正文终点：专栏块起始或互动计数（投诉/回复@）
END_PATTERNS = [
    re.compile(r"\n来自冰冰小美的雪球专栏"),
    re.compile(r"\n风险提示：用户发表的所有文章"),
    re.compile(r"\n投诉\n"),
    re.compile(r"\n回复@"),
    re.compile(r"\n\ue633"),
]

tails = {".", "。", ",", "，", "、", "；", ";", "：", ":", "！", "!", "？", "?"}


def cut_tail_chars(text: str) -> str:
    """把被换行切碎的标点回贴到上一行（雪球 column 页逐字换行）。"""
    raw = [ICON.sub("", ln).strip() for ln in text.splitlines()]
    out: list[str] = []
    for ln in raw:
        if not ln:
            continue
        if all(ch in tails for ch in ln) and out:
            out[-1] += ln
            continue
        if out and all(ch in tails for ch in out[-1]):
            out[-1] += ln
            continue
        out.append(ln)
    # 合并为段落：原文用空行分段，此处按「行」拼接后统一分段
    return "\n\n".join(out)


def extract(content: str) -> str:
    text = ICON.sub("", content)
    m = START.search(text)
    if m:
        text = text[m.end():]
    for pat in END_PATTERNS:
        mm = pat.search(text)
        if mm:
            text = text[: mm.start()]
            break
    return cut_tail_chars(text)


def main() -> int:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    out: list[dict] = []
    for it in data:
        url = str(it.get("url") or "")
        pid = re.search(r"/(\d+)$", url)
        pid = pid.group(1) if pid else ""
        body = extract(str(it.get("content") or ""))
        out.append({
            "post_id": pid,
            "url": url,
            "title": str(it.get("title") or ""),
            "author_name": str(it.get("author_name") or ""),
            "article_body": body,
            "chars": len(body),
        })
    DST.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [f"{o['post_id']} | chars={o['chars']} | author={o['author_name']} | head={o['article_body'][:60]!r}" for o in out]
    (RESULT_DIR / "processing" / "article-bodies-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
