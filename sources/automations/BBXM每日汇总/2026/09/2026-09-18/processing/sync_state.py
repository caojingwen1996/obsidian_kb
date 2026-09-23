"""同步 state.json：记录后处理结果（重复载体关系、内容计数、风险分析状态）。"""
from __future__ import annotations

import json
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
sp = RESULT_DIR / "state.json"
st = json.loads(sp.read_text(encoding="utf-8"))

CANON = "409823838"
DUP = "409824691"

items = st.get("processed_items") or {}
items.setdefault(CANON, {})["is_canonical"] = True
items[CANON]["duplicate_entry_ids"] = [DUP]
items[CANON]["body_source"] = "专栏页正文"
items.setdefault(DUP, {})["duplicate_of"] = CANON
items[DUP]["duplicate_reason"] = "同一篇专栏文章的社区转发入口；社区页正文位置为他人评论"
items[DUP]["body_source"] = "专栏页正文（与 409823838 同源）"

st["processed_items"] = items
st["raw_post_count"] = len(items)          # 保存的原始文件数（含重复载体）
st["content_count"] = len(items) - 1       # 去重后可计入当日内容的篇数
st["excluded_items"] = {
    "131700_雪球-聪明的投资者都在这里_40978055": {
        "reason": "误存他人帖子，已删除",
        "author": "仙居杨梅最初的梦",
        "url_author_id": "5418424084",
    }
}
st["post_processing"] = {
    "body_cleaned": True,
    "author_comments_rebuilt": True,
    "column_duplicate_merged": {"canonical": CANON, "duplicate": DUP},
    "risk_analysis": {
        "skill": "bbxm-risk-identification",
        "method": "five-step-identification",
        "analyzed": 7,
        "qualified": 0,
        "not_written": 7,
        "excel_status": "no_risk",
    },
    "summary_generated": True,
}
sp.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"raw_post_count={st['raw_post_count']} content_count={st['content_count']}")
