#!/usr/bin/env python3
"""Check indicator specifications and their shared result contract; never fetch data."""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import sys

try:
    import yaml
except ImportError:
    raise SystemExit("指标检查需要本地 PyYAML；未自动安装依赖。")

ROOT = Path(__file__).resolve().parent.parent
REQUIRED_STRINGS = (
    "title", "summary", "indicator_id", "spec_version", "observation_scope",
    "purpose", "update_frequency",
)
LIST_FIELDS = ("required_inputs", "metric_fields", "allowed_assessments")
RESULT_FIELDS = {
    "indicator_id", "spec_version", "subject", "observed_at", "available_at",
    "evaluated_at", "data_status", "metrics", "assessment", "evidence",
    "missing_inputs", "limitations", "requires_human_review",
}
DATA_STATUSES = {"complete", "partial", "unavailable", "stale", "incomparable"}


def read_page(path):
    text = Path(path).read_text(encoding="utf-8-sig")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.S)
    if not match:
        raise ValueError("缺少 YAML frontmatter")
    metadata = yaml.safe_load(match.group(1))
    if not isinstance(metadata, dict):
        raise ValueError("frontmatter 必须是映射")
    return metadata, text[match.end():]


def string_list(value, nonempty=False):
    return (isinstance(value, list) and (bool(value) or not nonempty)
            and all(isinstance(x, str) and x.strip() for x in value)
            and len(value) == len(set(value)))


def iso_time(value):
    if not isinstance(value, str):
        raise ValueError("时点必须是ISO 8601字符串或null")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def validate_result(result, metadata):
    errors = []
    if not isinstance(result, dict):
        return ["结果必须是JSON对象"]
    if set(result) != RESULT_FIELDS:
        errors.append("结果顶层字段与通用契约不一致")
    for key in ("indicator_id", "spec_version"):
        if result.get(key) != metadata.get(key):
            errors.append(f"结果{key}与规范不一致")
    if not isinstance(result.get("subject"), str) or not result["subject"].strip():
        errors.append("subject必须明确观察对象")
    status = result.get("data_status")
    if status not in DATA_STATUSES:
        errors.append("未知data_status")
    assessment = result.get("assessment")
    if assessment not in metadata.get("allowed_assessments", []):
        errors.append("assessment不在规范允许列表中")
    metrics = result.get("metrics")
    if not isinstance(metrics, dict) or set(metrics) != set(metadata.get("metric_fields", [])):
        errors.append("metrics字段与规范不一致")
    elif any(isinstance(x, float) and not math.isfinite(x) for x in metrics.values()):
        errors.append("metrics不允许NaN或无穷值")
    elif status == "complete" and not any(x is not None for x in metrics.values()):
        errors.append("complete结果至少需要一项有效读数")
    for key in ("evidence", "missing_inputs", "limitations"):
        if not string_list(result.get(key)):
            errors.append(f"{key}必须是不重复的非空字符串列表，可为空列表")
    review = result.get("requires_human_review")
    if type(review) is not bool:
        errors.append("requires_human_review必须是布尔值")
    if metadata.get("validation_status") == "draft" and review is not True:
        errors.append("draft规范必须人工复核")
    times = {}
    for key in ("observed_at", "available_at", "evaluated_at"):
        value = result.get(key)
        if value is None:
            if status == "complete":
                errors.append(f"complete结果缺少{key}")
        else:
            try:
                times[key] = iso_time(value)
            except (ValueError, TypeError):
                errors.append(f"{key}不是有效ISO 8601时点")
    if len(times) == 3 and not (times["observed_at"] <= times["available_at"] <= times["evaluated_at"]):
        errors.append("统计、可获知与评估时点顺序倒置")
    if status != "complete" and (assessment != "undetermined" or review is not True):
        errors.append("非complete结果必须undetermined并人工复核")
    if status != "complete" and not result.get("missing_inputs") and not result.get("limitations"):
        errors.append("非complete结果必须说明缺口或限制")
    if status == "complete" and result.get("missing_inputs"):
        errors.append("complete结果不能含缺失输入")
    if assessment != "undetermined" and not result.get("evidence"):
        errors.append("方向性结论必须有可追溯证据")
    return errors


def validate_page(path, template_path=None):
    metadata, body = read_page(path)
    errors = []
    if Path(path).parent.name != "indicators":
        errors.append("正式指标规范应位于所属库indicators目录")
    if metadata.get("type") != "indicator" or metadata.get("status") != "active":
        errors.append("正式指标必须为type: indicator、status: active")
    for key in REQUIRED_STRINGS:
        if not isinstance(metadata.get(key), str) or not metadata[key].strip():
            errors.append(f"缺少非空字符串字段{key}")
    if not re.fullmatch(r"[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*", str(metadata.get("indicator_id", ""))):
        errors.append("indicator_id格式不符合稳定标识约定")
    if not re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", str(metadata.get("spec_version", ""))):
        errors.append("spec_version必须为语义版本字符串")
    if metadata.get("indicator_kind") not in {"quantitative", "qualitative", "mixed"}:
        errors.append("未知indicator_kind")
    if metadata.get("validation_status") not in {"draft", "reviewed", "validated"}:
        errors.append("未知validation_status")
    for key in LIST_FIELDS:
        if not string_list(metadata.get(key), nonempty=True):
            errors.append(f"{key}必须是非空、无重复的字符串列表")
    if "undetermined" not in metadata.get("allowed_assessments", []):
        errors.append("allowed_assessments必须包含undetermined")
    for key in ("source", "sources"):
        if key in metadata:
            errors.append(f"新指标规范不得含{key}属性")
    for key in ("created", "updated", "aliases", "tags", "related"):
        if key not in metadata:
            errors.append(f"缺少基础字段{key}")
    template = template_path or ROOT / "templates/indicator-page-template.md"
    _, template_body = read_page(template)
    required_headings = re.findall(r"^## (.+)$", template_body, re.M)
    if re.findall(r"^## (.+)$", body, re.M) != required_headings:
        errors.append("二级章节或顺序与指标模板不一致")
    if not re.search(r"\[\[sources/[^\]]+\|[^\]]+\]\]", body):
        errors.append("缺少正文原始资料双链")
    if not any("/topics/" in x for x in metadata.get("related", []) if isinstance(x, str)):
        errors.append("缺少所属topic关联")
    examples = re.findall(r"```json\s*\n(.*?)\n```", body, re.S)
    if len(examples) != 1:
        errors.append("指标页必须提供一个JSON输出示例")
    else:
        try:
            result = json.loads(examples[0])
            errors.extend(validate_result(result, metadata))
            if (result.get("data_status") != "unavailable"
                    or any(result.get(x) is not None for x in ("observed_at", "available_at", "evaluated_at"))
                    or any(x is not None for x in result.get("metrics", {}).values())
                    or result.get("evidence")):
                errors.append("未运行示例不得伪造读数、时点或证据")
            if set(metadata.get("required_inputs", [])) - set(result.get("missing_inputs", [])):
                errors.append("未运行示例未列全必需输入缺口")
        except (ValueError, TypeError, AttributeError) as exc:
            errors.append(f"JSON示例无效：{exc}")
    return errors


def duplicate_ids(paths):
    seen, errors = {}, []
    for path in paths:
        metadata, _ = read_page(path)
        key = metadata.get("indicator_id")
        if key in seen:
            errors.append(f"重复indicator_id {key}：{seen[key]} 与 {path}")
        seen[key] = path
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pages", nargs="*", type=Path)
    parser.add_argument("--result", type=Path)
    args = parser.parse_args()
    canonical = sorted(p for vault in ("wiki", "wiki_laomujiang") for p in (ROOT / vault / "indicators").glob("*.md"))
    pages = args.pages or canonical
    if args.result and len(pages) != 1:
        parser.error("--result必须配合恰好一个指标页")
    if not pages:
        parser.error("没有找到指标页")
    errors = []
    try:
        errors.extend(duplicate_ids(canonical))
        for path in pages:
            errors.extend(f"{path}: {x}" for x in validate_page(path))
        if args.result:
            metadata, _ = read_page(pages[0])
            result = json.loads(args.result.read_text(encoding="utf-8-sig"))
            errors.extend(f"{args.result}: {x}" for x in validate_result(result, metadata))
    except (OSError, ValueError, TypeError, yaml.YAMLError) as exc:
        errors.append(str(exc))
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"指标检查通过（{len(pages)}份规范" + ("及1份运行结果）。" if args.result else "）。"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
