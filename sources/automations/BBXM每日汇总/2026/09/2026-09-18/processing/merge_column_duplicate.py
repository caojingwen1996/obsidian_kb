"""对 09-18 七篇已保存原帖做最终正文归位 + 专栏重复合并。

已确认的事实（见 processing/column-raw.txt）：
  - 409823838（16:59）是「根据历史推演…」专栏正文的真实载体，正文 702 字，来自冰冰小美本人。
  - 409824691（17:05，标题「预演」）在社区页上「正文」位置显示的是他人评论
    （钱老板赚钱 回复@偷窃贼），真正的作者原文与 409823838 完全同一篇；
    「预演」这一标题只是同一篇专栏文章在社区页的转发入口。
  => 二者为同一篇文章，按「同一内容只保留最完整载体」合并：保留 409823838，
     409824691 降级为重复来源，在 409823838 的 md 中记录关联链接，并在 state 中标注。

处理动作：
  1) 用 article-bodies.json 的专栏正文回填 409823838 / 409824691；
  2) 409823838 的 md 增加「关联来源」说明；
  3) 409824691 的 md 标注为重复载体并指向 409823838；
  4) state.json 记录 duplicate_of 关系（不删条目，保留追溯）。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
PROC = RESULT_DIR / "processing"

CANON = "409823838"          # 保留的完整载体
DUP = "409824691"            # 重复载体（社区页「预演」）
CANON_URL = "https://www.xueqiu.com/7143769715/409823838"
DUP_URL = "https://www.xueqiu.com/7143769715/409824691"


def find_md(pid8: str) -> Path | None:
    """文件名以 8 位 ID 结尾（雪球文件名会截断高位），用前缀匹配。"""
    for f in RESULT_DIR.glob("*.md"):
        if re.search(rf"_{pid8}\.md$", f.name):
            return f
    return None


def main() -> int:
    bodies = json.loads((PROC / "article-bodies.json").read_text(encoding="utf-8"))
    body_by_pid = {b["post_id"]: b["article_body"] for b in bodies}
    # article-bodies.json 用完整 9 位 ID；文件名用前 8 位前缀匹配
    def body_for(pid8: str) -> str | None:
        for full, b in body_by_pid.items():
            if full.startswith(pid8):
                return b
        return None

    report: list[str] = []

    canon_md = find_md(CANON[:8])
    dup_md = find_md(DUP[:8])
    report.append(f"canon_md={canon_md.name if canon_md else None}")
    report.append(f"dup_md={dup_md.name if dup_md else None}")

    # ---- 1) 回填正文（仅这两篇需要用专栏正文） ----
    for pid8, md in ((CANON[:8], canon_md), (DUP[:8], dup_md)):
        if md is None:
            continue
        body = body_for(pid8)
        if not body:
            report.append(f"{pid8} | NO_COLUMN_BODY")
            continue
        text = md.read_text(encoding="utf-8")
        head, sep, rest = text.partition("正文：\n")
        comments = re.split(r"\n+作者评论：", rest, maxsplit=1)
        tail = ("\n\n作者评论：" + comments[1]) if len(comments) > 1 else ""
        md.write_text(head + sep + body.strip() + "\n" + tail, encoding="utf-8")
        report.append(f"{pid8} | body_replaced={len(body)}")

    # ---- 2) 标注关系（先清理既有标注，保证幂等） ----
    if canon_md is not None:
        text = canon_md.read_text(encoding="utf-8")
        text = re.split(r"\n+## 关联来源", text)[0].rstrip()
        note = (
            "\n\n## 关联来源\n\n"
            f"- 同一篇文章的社区转发入口（标题「预演」）：{DUP_URL}\n"
            "- 说明：该文同时存在于专栏页与社区页；社区页「预演」为转发入口，\n"
            "  正文位置显示的是他人评论，故本篇以专栏页正文为准，社区页条目仅作来源索引保留。\n"
        )
        canon_md.write_text(text + note + "\n", encoding="utf-8")
        report.append(f"{CANON} | 已写入关联来源")

    if dup_md is not None:
        lines = dup_md.read_text(encoding="utf-8").splitlines()
        lines = [ln for ln in lines if not ln.startswith("> ")]
        # 去掉清理后可能出现的连续空行
        cleaned: list[str] = []
        for ln in lines:
            if ln == "" and cleaned and cleaned[-1] == "":
                continue
            cleaned.append(ln)
        lines = cleaned
        # 在头部字段块（首个空行）之后插入提示
        idx = next((i for i, ln in enumerate(lines) if ln.strip() == ""), min(9, len(lines)))
        tip = [
            "",
            f"> 重复载体：本条与 {CANON_URL} 为同一篇专栏文章。",
            "> 社区页「正文」位置展示的是他人评论，非作者原文；",
            f"> 作者原文请见 {canon_md.name if canon_md else CANON_URL}。",
            "> 此条目仅作来源索引保留，不重复计入当日内容。",
        ]
        lines[idx:idx] = tip
        dup_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
        report.append(f"{DUP} | 已标注重复载体")

    # ---- 3) state.json 标注关系 ----
    sp = RESULT_DIR / "state.json"
    st = json.loads(sp.read_text(encoding="utf-8"))
    items = st.get("processed_items") or {}
    if DUP in items:
        items[DUP]["duplicate_of"] = CANON
        items[DUP]["duplicate_reason"] = "同一篇专栏文章的社区转发入口；正文位置为他人评论"
    if CANON in items:
        items[CANON]["is_canonical"] = True
        items[CANON]["duplicate_entry_ids"] = [DUP]
    st["content_count"] = len([k for k in items if k != DUP])
    st["merge_note"] = f"{DUP} 与 {CANON} 为同一篇文章，内容计数以 {CANON} 为准"
    sp.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")
    report.append(f"state.json | content_count={st['content_count']} (条目 {len(items)})")

    (PROC / "merge-report.txt").write_text("\n".join(report), encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
