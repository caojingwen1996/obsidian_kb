"""评论清洗 v2（最终版）：修正 v1 的三类残留缺陷。

v1 缺陷与根因（已由 diag-why.txt / char-audit.txt 逐行验证）：
  1. 雪球互动图标使用私用区字体：\\ue64b=赞图标、\\ue633=评论图标，
     与数字粘连后形如 '\\ue64b9'(赞9)、'\\ue6332'(评2)，或单独成行只剩 '1'/'9'/'2'。
     v1 的 NOISE 只匹配 ^[\\d\\s]*$，导致孤立数字被当成正文收入「作者评论」。
  2. AUTHOR_POST 命中后只搜到第一个空行就 break，因此「冰冰小美 作者：…」这种
     楼中楼回复行若位于空行之后会被漏掉，反而在下一轮循环里被匹配成新块，
     把后续的赞/评计数一起吞进正文。

本脚本策略：
  - 逐行分类，先剥离全部图标字符（\\ue600-\\ue7ff 私用区）+ 楼层计数行；
  - 作者发言统一为「作者楼」（作者署名后的连续正文）与「作者回复」（作者：xxx）；
  - 遇到他人楼层（昵称+时间+地区）即终止当前作者楼；
  - 输出按内容指纹跨条目去重。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
REFETCH = RESULT_DIR / "processing" / "detail-refetch.json"

# 雪球图标字体私用区（赞 / 评论 / 展开等）
ICON = re.compile(r"[\ue600-\ue7ff\ufeff]")

# 作者署名行：冰冰小美作者 + 可选「修改于」+ 时间 + 地区
AUTHOR_POST = re.compile(r"^冰冰小美\s*作者(修改于)?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}|\d{2}-\d{2}\s+\d{2}:\d{2})?\s*(·\s*\S{0,8})?$")
# 作者回复行：冰冰小美 作者：xxx
AUTHOR_REPLY = re.compile(r"^冰冰小美\s*作者[：:]\s*(.+)$")
# 他人楼层头：昵称 + 可选(修改于) + 时间 + · 地区
OTHER_FLOOR = re.compile(r"^[^\s]{2,24}\s*(修改于\s*)?\d{2}-\d{2}\s+\d{2}:\d{2}\s*·")
# 他人行内发言：昵称 + 可选(回复@xx) + ：
OTHER_INLINE = re.compile(r"^[^\s：:]{2,24}\s*(回复@[^\s：:]{1,24})?\s*[：:]")
# 纯噪声：查看N条回复 / 展开 / 排序词 / 纯数字 / 纯标点
NOISE = re.compile(r"^(查看\d+条回复|展开查看更多|讨论|赞|回复|[最热最新最早]+|\d{1,6}|[\s.。、,，:：]+)$")


def clean_line(s: str) -> str:
    """剥离图标字符并去首尾空白。"""
    return ICON.sub("", s).strip()


def extract_author_lines(block: str) -> list[str]:
    """从单个评论块中抽出作者本人发言。"""
    lines = [clean_line(ln) for ln in ICON.sub("", block).splitlines()]
    out: list[str] = []

    i = 0
    while i < len(lines):
        s = lines[i]
        if not s:
            i += 1
            continue

        # 作者楼：署名行之后到下一个楼层头/作者行之间的正文
        if AUTHOR_POST.match(s):
            i += 1
            body: list[str] = []
            while i < len(lines):
                nxt = lines[i]
                if not nxt:
                    i += 1
                    continue
                if AUTHOR_POST.match(nxt) or AUTHOR_REPLY.match(nxt) or OTHER_FLOOR.match(nxt):
                    break
                if NOISE.match(nxt) or OTHER_INLINE.match(nxt):
                    i += 1
                    continue
                body.append(nxt)
                i += 1
            if body:
                out.append("\n".join(body))
            continue

        # 作者回复他人
        m = AUTHOR_REPLY.match(s)
        if m:
            val = m.group(1).strip()
            if val and not NOISE.match(val):
                out.append(val)
            i += 1
            continue

        i += 1

    return out


def build_block(items: list[str]) -> str:
    seen: set[str] = set()
    uniq: list[str] = []
    for it in items:
        fp = re.sub(r"\s+", "", it)
        if not fp or fp in seen:
            continue
        # 丢弃纯计数/纯噪声残留
        if NOISE.match(fp):
            continue
        seen.add(fp)
        uniq.append(it.strip())
    if not uniq:
        return ""
    return "\n\n".join(f"{i}. {t}" for i, t in enumerate(uniq, start=1))


def denoise_body(body: str) -> str:
    """压缩被换行切碎的正文：仅剩句末标点的孤立片段回贴到上一行。"""
    raw = [ICON.sub("", ln).strip() for ln in body.splitlines()]
    out: list[str] = []
    tail_only = re.compile(r"^[。，、；：！？,.;:!?]+$")
    for ln in raw:
        if not ln:
            continue
        if tail_only.match(ln) and out:
            out[-1] = out[-1] + ln
            continue
        if out and tail_only.match(out[-1]):
            out[-1] = out[-1] + ln
            continue
        out.append(ln)
    return "\n\n".join(out)


def main() -> int:
    data = json.loads(REFETCH.read_text(encoding="utf-8"))
    idx: dict[str, dict] = {}

    # 专栏文章：社区页「正文」位置展示的是他人评论，作者原文在 [专栏] 块内。
    # 由 processing/column-posts.json 提供正确的作者正文。
    column: dict[str, str] = {}
    col_path = RESULT_DIR / "processing" / "column-posts.json"
    if col_path.exists():
        try:
            for it in json.loads(col_path.read_text(encoding="utf-8")):
                pid = re.search(r"/(\d+)$", str(it.get("url") or ""))
                if pid and (it.get("article_body") or it.get("body")):
                    column[pid.group(1)] = str(it.get("article_body") or it.get("body"))
        except Exception as exc:  # noqa: BLE001
            print(f"column-posts.json 解析失败，跳过专栏正文替换：{exc}")

    for item in data:
        m = re.search(r"/(\d+)$", str(item.get("url") or ""))
        if m:
            idx[m.group(1)] = item

    report: list[str] = []
    for md in sorted(RESULT_DIR.glob("*.md")):
        m = re.search(r"_(\d{8})\.md$", md.name)
        if not m:
            continue
        key = m.group(1)
        match = next((v for k, v in idx.items() if k.startswith(key)), None)
        if not match:
            report.append(f"{md.name} | NO_MATCH")
            continue

        text = md.read_text(encoding="utf-8")
        head, _, rest = text.partition("正文：\n")
        body_part = re.split(r"\n+作者评论：", rest)[0]

        # 专栏文章优先用专栏正文；否则用社区正文
        col_body = next((v for k, v in column.items() if k.startswith(key)), None)
        chosen = col_body if col_body else body_part
        src = "专栏" if col_body else "社区"
        new_body = denoise_body(chosen.strip())

        text = head + "正文：\n" + new_body + "\n"

        # 重建作者评论
        items: list[str] = []
        for c in (match.get("author_comments") or []):
            items.extend(extract_author_lines(str(c.get("content") or "")))

        # 若原社区「正文」其实是他人评论（专栏页错位），且该内容未进评论块 →
        # 说明它不属于作者，直接丢弃，不写入。
        if col_body:
            old_fp = re.sub(r"\s+", "", body_part.strip())
            items = [it for it in items if re.sub(r"\s+", "", it) != old_fp]

        block = build_block(items)

        if block:
            text = text.rstrip() + "\n\n作者评论：\n" + block + "\n"
        else:
            text = text.rstrip() + "\n"

        md.write_text(text, encoding="utf-8")
        report.append(
            f"{md.name} | src={src} | body={len(new_body)} chars | "
            f"author_comments={len(items)} uniq={len(block)} chars"
        )

    (RESULT_DIR / "processing" / "rebuild2-report.txt").write_text("\n".join(report), encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
