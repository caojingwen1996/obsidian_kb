"""Validate and render supplied five-layer records; never infer market conclusions."""

from __future__ import annotations

import html


LAYERS = {
    "event": ("事件节点", {"fact": "事实及性质", "occurred_at": "发生时间", "published_at": "发布时间", "transition": "状态变化", "source": "出处"}),
    "impact": ("影响", {"risk_source": "风险源", "variables": "变量", "path": "路径", "exposure": "主体暴露", "hypotheses": "研报假设", "conditions": "条件与时滞", "evidence": "证据"}),
    "behavior": ("市场行为", {"expected": "预期行为", "observed": "实际行为", "evidence": "行为证据"}),
    "reaction": ("金融反应", {"direction": "风险方向", "level": "风险水平", "current_window": "当前窗口", "comparison_window": "比较窗口", "indicators": "指标及口径", "support": "支持证据", "counter": "反证与其他解释"}),
    "tracking": ("长期跟踪", {"previous": "原判断及日期", "revision_reason": "复核与修订理由", "status": "跟踪状态", "indicator_source": "验证指标及来源", "confirm": "确认条件", "invalidate": "反证/失效条件", "next_check": "下一检查", "closure_reason": "关闭原因"}),
}
REVIEW_FIELDS = ("framework_path", "framework_read_at", "checked_scope", "checked_at", "history_source", "note")


def cell(value: str) -> str:
    return html.escape(value).replace("|", "&#124;").replace("\n", "<br>")


def require_text(obj: dict, fields, label: str) -> None:
    if not isinstance(obj, dict):
        raise ValueError(f"{label} must be an object")
    for key in fields:
        if not isinstance(obj.get(key), str) or not obj[key].strip():
            raise ValueError(f"{label}.{key} requires text or an explicit evidence gap")


def validate_information(item: dict) -> None:
    if "information_review" in item:
        require_text(item["information_review"], REVIEW_FIELDS, "information_review")
    for collection in ("information_events", "prior_information_events"):
        events = item.get(collection, [])
        if not isinstance(events, list):
            raise ValueError(f"{collection} must be a list")
        seen = set()
        for record in events:
            require_text(record, ("event_id", "path_id", "title", "update", "reviewed_at"), collection)
            identity = (record["event_id"], record["path_id"])
            if identity in seen:
                raise ValueError(f"duplicate event/path: {identity}")
            seen.add(identity)
            for key, (_, fields) in LAYERS.items():
                require_text(record.get(key), fields, key)
            if record["update"] not in {"新增", "持续跟踪", "获得确认", "出现反证", "修订判断", "关闭"}:
                raise ValueError("invalid event update")
            if record["reaction"]["direction"] not in {"增强", "持平", "减弱", "重新增强", "证据不足"}:
                raise ValueError("invalid risk direction")
            if record["reaction"]["level"] not in {"高", "中", "低", "待验证"}:
                raise ValueError("invalid risk level")
            status = record["tracking"]["status"]
            if status not in {"待验证", "跟踪中", "关闭"} or (status == "关闭") != (record["update"] == "关闭"):
                raise ValueError("inconsistent tracking status")


def carry_information_history(prior: dict | None) -> list[dict]:
    prior = prior or {}
    validate_information(prior)
    records = {}
    for record in prior.get("prior_information_events", []) + prior.get("information_events", []):
        records[(record["event_id"], record["path_id"])] = record
    return list(records.values())


def information_gaps(item: dict) -> list[str]:
    gaps = []
    if "information_review" not in item or "information_events" not in item:
        gaps.append("五层归纳未完成：未提供本次检查说明或事件记录，不代表没有风险。")
    current = {(r["event_id"], r["path_id"]) for r in item.get("information_events", [])}
    for record in item.get("prior_information_events", []):
        if record["tracking"]["status"] != "关闭" and (record["event_id"], record["path_id"]) not in current:
            gaps.append(f"历史待复核：{record['event_id']} / {record['path_id']}；上次复核 {record['reviewed_at']}，旧判断不作为本次结论。")
    return gaps


def information_sections(item: dict) -> tuple[str, str]:
    validate_information(item)
    lines = ["**五层信息归纳**", ""]
    review = item.get("information_review")
    if review:
        labels = ("框架路径", "框架读取日期", "实际检查范围", "检查截止时间", "历史来源", "本次复核说明")
        lines.extend(f"- {label}：{cell(review[key])}" for key, label in zip(REVIEW_FIELDS, labels))
        lines.append("")
    gaps = information_gaps(item)
    lines.extend(f"> {cell(gap)}\n" for gap in gaps)
    events = item.get("information_events", [])
    if not events and not gaps:
        lines.append("本次记录无重要事件路径；具体检查范围与历史复核情况见上方说明。")
    followup = ["| 事件编号 / 路径编号 | 跟踪状态 | 验证指标与来源 | 确认条件 | 反证/失效条件 | 下一检查时间或触发事件 |", "|---|---|---|---|---|---|"]
    for record in events:
        lines.extend([f"**{cell(record['event_id'])} / {cell(record['path_id'])}：{cell(record['title'])}**", "", f"- 本次进展：{cell(record['update'])}；复核时间：{cell(record['reviewed_at'])}", "", "| 归纳层级 | 本次记录 |", "|---|---|"])
        for key, (label, fields) in LAYERS.items():
            content = "<br>".join(f"{name}：{cell(record[key][field])}" for field, name in fields.items())
            lines.append(f"| {label} | {content} |")
        lines.append("")
        tracking = record["tracking"]
        values = [f"{record['event_id']} / {record['path_id']}"] + [tracking[k] for k in ("status", "indicator_source", "confirm", "invalidate", "next_check")]
        followup.append("| " + " | ".join(cell(v) for v in values) + " |")
    followup.extend(f"\n> {cell(gap)}" for gap in gaps)
    return "\n".join(lines), "\n".join(followup)


def information_summary(items: list[dict], report_date: str) -> str:
    groups = {}
    gaps = []
    for item in items:
        validate_information(item)
        gaps.extend(f"> {cell(item['name'])}：{cell(gap)}" for gap in information_gaps(item))
        for record in item.get("information_events", []):
            groups.setdefault(record["event_id"], []).append((item, record))
    lines = ["### 事件归纳与跟踪进展", "", "| 事件编号 / 事件 | 涉及标的与路径 | 本次进展 | 影响变量与假设 | 市场行为与金融反应 | 下一验证条件与时点 | 报告 |", "|---|---|---|---|---|---|---|"]
    for event_id, entries in groups.items():
        columns = [[] for _ in range(7)]
        columns[0].append(cell(event_id + "：" + entries[0][1]["title"]))
        for item, record in entries:
            prefix = f"{item['name']} / {record['path_id']}："
            values = [prefix, prefix + record["update"], prefix + record["impact"]["variables"] + "；" + record["impact"]["hypotheses"], prefix + record["behavior"]["observed"] + "；" + record["reaction"]["direction"] + " / " + record["reaction"]["level"], prefix + record["tracking"]["confirm"] + "；" + record["tracking"]["next_check"]]
            for index, value in enumerate(values, 1):
                columns[index].append(cell(value))
            columns[6].append(f"[{cell(item['name'])}]({item['code']}-{item['name']}-每日监控-{report_date}.html)")
        lines.append("| " + " | ".join("<br>".join(column) for column in columns) + " |")
    if not groups and not gaps:
        lines.append("\n本次记录无重要事件路径；检查范围与历史复核说明见各标的报告。")
    lines.extend(["", *gaps])
    return "\n".join(lines)
