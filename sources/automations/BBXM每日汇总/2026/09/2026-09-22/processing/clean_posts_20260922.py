"""清洗脚本（2026-09-22）：重写原帖正文 + 重建作者评论。

与 09-18 的 rebuild_comments2.py 相比的关键适配：
1. 时间形态扩展：当日评论时间戳为「N秒前 / N分钟前 / N小时前 / 今天 HH:MM」等
   相对格式，09-18 的 AUTHOR_POST / OTHER_FLOOR 只认绝对时间（YYYY-MM-DD HH:MM
   或 MM-DD HH:MM），本版新增相对时间形态，否则作者评论会被整体漏掉、他人楼层
   会污染作者正文。
2. 正文来源：三篇均为普通帖，正文直接从提取 JSON 的 content 字段中
   「关注\\n」之后、「风险提示：用户发表的所有文章」之前截取，再按 09-18 沉淀
   的重排规则（先拼连续文本 → 按句末标点分段 → 每段聚合 ≥40 字）重排。
3. 410215494 为图片帖（无文字正文），正文位置写入事实性说明。
4. 410215494 下 16:46 作者评论与同日 16:44 帖（410217703）正文同文，
   命中时在条目后追加标注，不删除原文。
5. AUTHOR_REPLY 增加续行捕获（如「科技股早就曝光，一堆融券做空。\\n卖了股票，
   挣二次。」跨行的作者回复）。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-22")
EXTRACT = RESULT_DIR / "processing" / "extracted-posts-run2.json"

# 雪球图标字体私用区（赞 / 评论 / 展开等）
ICON = re.compile(r"[\ue600-\ue7ff\ufeff]")

# 时间形态：绝对日期时间 / MM-DD HH:MM / N秒前 / N分钟前 / N小时前 / 今天|昨天 HH:MM / 裸时间
TIME = (
    r"(?:\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}"
    r"|\d{2}-\d{2}\s+\d{2}:\d{2}"
    r"|\d+\s*(?:秒前|分钟前|小时前)"
    r"|(?:今天|昨天|昨日)\s*\d{1,2}:\d{2}"
    r"|\d{1,2}:\d{2}(?::\d{2})?)"
)

# 作者署名行：冰冰小美作者 + 可选「修改于」+ 时间 + 地区
AUTHOR_POST = re.compile(rf"^冰冰小美\s*作者(修改于)?\s*(?:{TIME})?\s*(·\s*\S{{0,8}})?$")
# 作者回复行：冰冰小美 作者：xxx
AUTHOR_REPLY = re.compile(r"^冰冰小美\s*作者[：:]\s*(.+)$")
# 他人楼层头：昵称 + 可选(修改于) + 时间 + · 地区
OTHER_FLOOR = re.compile(rf"^[^\s]{{2,24}}\s*(?:修改于\s*)?(?:{TIME})\s*·")
# 他人行内发言：昵称 + 可选(回复@xx) + ：
OTHER_INLINE = re.compile(r"^[^\s：:]{2,24}\s*(回复@[^\s：:]{1,24})?\s*[：:]")
# 纯噪声：查看N条回复(可带粘连计数) / 展开 / 作者赞过 / 图片评论 / 排序词 / 纯数字 / 纯标点
NOISE = re.compile(
    r"^(查看\d+条回复\d*|展开查看更多|展开|作者\s*赞过|赞过|图片评论|已过滤部分评论"
    r"|回复@\S{1,24}|讨论|赞|回复|[最热最新最早]+|\d{1,6}|[\s.。、,，:：]+)$"
)

SENT_END = "。！？!?"

# 图片帖说明
IMAGE_NOTE = (
    "（图片帖：无文字正文，图片内容无法提取。当日观点见下方作者评论与同日 16:44、17:53 帖。）"
)


def clean_line(s: str) -> str:
    return ICON.sub("", s).strip()


def extract_author_lines(block: str) -> list[str]:
    """从单个评论块中抽出作者本人发言（含续行）。"""
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

        # 作者回复他人（含紧随的续行）
        m = AUTHOR_REPLY.match(s)
        if m:
            parts = [m.group(1).strip()]
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if not nxt:
                    break
                if (
                    AUTHOR_POST.match(nxt)
                    or AUTHOR_REPLY.match(nxt)
                    or OTHER_FLOOR.match(nxt)
                    or OTHER_INLINE.match(nxt)
                    or NOISE.match(nxt)
                ):
                    break
                parts.append(nxt)
                i += 1
            joined = "\n".join(p for p in parts if p)
            if joined and not NOISE.match(joined):
                out.append(joined)
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
        if NOISE.match(fp):
            continue
        seen.add(fp)
        uniq.append(it.strip())
    if not uniq:
        return ""
    return "\n\n".join(f"{i}. {t}" for i, t in enumerate(uniq, start=1))


def extract_body(content: str) -> str:
    """从详情页全文中截取作者正文：「关注」行之后到风险提示/投诉之前。"""
    start = content.find("关注\n")
    if start < 0:
        return ""
    body = content[start + len("关注\n"):]
    end = len(body)
    for em in ("风险提示：用户发表的所有文章", "投诉", "全部讨论（"):
        i = body.find(em)
        if 0 < i < end:
            end = i
    return body[:end].strip()


def reflow(text: str) -> str:
    """合并被换行切碎的句子，并在句末标点处分段（09-18 沉淀规则）。"""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    merged = "".join(lines)
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
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    idx: dict[str, dict] = {}
    for item in data:
        m = re.search(r"/(\d+)$", str(item.get("url") or ""))
        if m:
            idx[m.group(1)] = item

    # 16:44 帖（410217703）重排后正文指纹，用于识别 410215494 下的同文作者评论
    post_1644_body_fp = ""
    if "410217703" in idx:
        post_1644_body_fp = re.sub(r"\s+", "", reflow(extract_body(str(idx["410217703"].get("content") or ""))))

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

        raw_body = extract_body(str(match.get("content") or ""))
        if raw_body:
            new_body = reflow(raw_body)
            src = "详情页"
        else:
            new_body = IMAGE_NOTE
            src = "图片帖"

        text = md.read_text(encoding="utf-8")
        head, _, _ = text.partition("正文：\n")
        text = head + "正文：\n" + new_body + "\n"

        # 重建作者评论
        items: list[str] = []
        for c in (match.get("author_comments") or []):
            items.extend(extract_author_lines(str(c.get("content") or "")))

        # 同文标注：410215494 下与 16:44 帖正文相同的作者评论
        annotated: list[str] = []
        for it in items:
            if post_1644_body_fp and re.sub(r"\s+", "", it) == post_1644_body_fp:
                annotated.append(it + "\n（同文：与同日 16:44 帖正文一致，见 410217703。）")
            else:
                annotated.append(it)

        block = build_block(annotated)

        if block:
            text = text.rstrip() + "\n\n作者评论：\n" + block + "\n"
        else:
            text = text.rstrip() + "\n"

        md.write_text(text, encoding="utf-8")
        report.append(
            f"{md.name} | src={src} | body={len(new_body)} chars | "
            f"author_items={len(items)} uniq={len(annotated)}"
        )

    (RESULT_DIR / "processing" / "clean-report.txt").write_text("\n".join(report), encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
