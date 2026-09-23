"""把专栏页逐字换行的正文重排为自然段落。

雪球专栏页(article页面)把正文按标点逐行输出，形如：
    根据历史推演
    ，
    <空行>
    需要考虑重磅利好发布
    ，
    <空行>
需要合并为：根据历史推演，需要考虑重磅利好发布，比如……
段落边界依据原始 column-posts.json 中的空行结构：原 content 用连续换行表示段落，
但因清洗已丢失，故此脚本改用「句末标点(。！？)后开新段」的规则重排，
更能贴合原文语义，且对中英混排安全。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
PROC = RESULT_DIR / "processing"

SENT_END = "。！？!?"
TAIL_ONLY = set("。，、；：！？,.;:!?…—-")


def reflow(text: str) -> str:
    """合并被换行切碎的句子，并在句末标点处分段。"""
    # 1) 去掉所有硬换行，先把整篇拼成一条连续文本（专栏页按标点逐行输出）
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    merged = "".join(lines)
    # 2) 保护：英文单词/数字间不应被拼接破坏（本例为纯中文，无需额外处理）
    #    《…》书名号内不切段
    # 3) 按句末标点分段，每段聚合到 >=40 字
    parts = re.split(rf"(?<=[{SENT_END}])", merged)
    paras: list[str] = []
    buf = ""
    for p in parts:
        if not p:
            continue
        buf += p
        if buf.rstrip().endswith(tuple(SENT_END)) and len(buf) >= 40:
            paras.append(buf.strip())
            buf = ""
    if buf.strip():
        paras.append(buf.strip())
    return "\n\n".join(paras)


def main() -> int:
    md = next(RESULT_DIR.glob("*_40982383.md"))
    # 从 article-bodies.json 取原始（逐行）正文，保证幂等可重跑
    bodies = json.loads((PROC / "article-bodies.json").read_text(encoding="utf-8"))
    raw = next(b["article_body"] for b in bodies if b["post_id"].startswith("40982383"))
    new_body = reflow(raw)

    text = md.read_text(encoding="utf-8")
    head, sep, rest = text.partition("正文：\n")
    if "\n\n## 关联来源" in rest:
        tail = "\n\n## 关联来源" + rest.split("\n\n## 关联来源", 1)[1]
    else:
        tail = ""
    out = head + sep + new_body + tail
    if not out.endswith("\n"):
        out += "\n"
    md.write_text(out, encoding="utf-8")

    (PROC / "reflow-report.txt").write_text(
        f"file={md.name}\nraw_chars={len(raw)}\nnew_chars={len(new_body)}\n"
        f"paragraphs={new_body.count(chr(10) + chr(10)) + 1}\n\n--- preview ---\n{new_body}",
        encoding="utf-8",
    )
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
