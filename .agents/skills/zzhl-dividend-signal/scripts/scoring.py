"""Pure dividend scoring and trading-date confirmation; no data fetching."""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

KEYS = ("absolute", "ratio")
LABELS = {"D": "不买入", "C": "等待区间", "B": "观察区间", "A": "买入区间"}
COMPONENT_LABELS = {"D": "指标得分偏低", "C": "指标得分一般", "B": "指标得分较高", "A": "指标得分高"}


def load_default_strategy():
    return json.loads((Path(__file__).resolve().parents[1] / "strategy-v2.json").read_text(encoding="utf-8-sig"))


def load_strategy(settings_path=None):
    try:
        from .strategy_store import read_settings
    except ImportError:
        from strategy_store import read_settings
    return read_settings(settings_path)["strategy"]


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def valid_date(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def normalize_strategy(config):
    if not isinstance(config, dict) or not isinstance(config.get("weights"), dict) or "percentile" not in config["weights"]:
        return config
    weights = config["weights"]
    total = sum(weights.get(k, 0) for k in KEYS) if all(finite(weights.get(k)) for k in KEYS) else 0
    anchors = config.get("anchors") if isinstance(config.get("anchors"), dict) else {}
    return dict(config, weights={k: weights.get(k, 0) / total * 100 if total else None for k in KEYS},
                anchors={k: anchors.get(k) for k in KEYS})


def validate_strategy(config):
    config = normalize_strategy(config)
    if not isinstance(config, dict):
        return [{"field": "strategy", "message": "策略参数格式无效"}]
    errors = []
    if not isinstance(config.get("version"), str) or not config["version"]:
        errors.append({"field": "version", "message": "策略版本无效"})
    weights = config.get("weights") if isinstance(config.get("weights"), dict) else {}
    anchors = config.get("anchors") if isinstance(config.get("anchors"), dict) else {}
    thresholds = config.get("thresholds") if isinstance(config.get("thresholds"), dict) else {}
    for key in KEYS:
        if not finite(weights.get(key)) or weights[key] < 0:
            errors.append({"field": f"weights.{key}", "message": "权重不能小于0"})
    if all(finite(weights.get(k)) for k in KEYS) and abs(sum(weights[k] for k in KEYS) - 100) > 1e-8:
        errors.append({"field": "weights", "message": "两项权重合计必须为100%"})
    for key in KEYS:
        points = anchors.get(key, [])
        if not isinstance(points, list) or len(points) != 5:
            errors.append({"field": f"anchors.{key}", "message": "需要五个锚点"})
            continue
        for i, point in enumerate(points):
            prefix = f"anchors.{key}.{i}"
            if not isinstance(point, list) or len(point) != 2 or not all(finite(v) for v in point):
                errors.append({"field": prefix, "message": "锚点必须是有限数值"})
                continue
            x, score = point
            if x < 0 or (key == "ratio" and x <= 0):
                errors.append({"field": prefix + ".0", "message": "输入锚点超出允许范围"})
            if score < 0 or score > 100 or (i == 0 and score != 0) or (i == 4 and score != 100):
                errors.append({"field": prefix + ".1", "message": "分数范围0～100，端点固定0和100"})
            if i and isinstance(points[i - 1], list) and len(points[i - 1]) == 2:
                for axis in (0, 1):
                    if finite(points[i - 1][axis]) and point[axis] <= points[i - 1][axis]:
                        errors.append({"field": prefix + f".{axis}", "message": "锚点输入与分数必须严格递增"})
    levels = [thresholds.get(k) for k in ("C", "B", "A")]
    if not all(finite(v) for v in levels) or not 0 < levels[0] < levels[1] < levels[2] < 100:
        errors.append({"field": "thresholds", "message": "分界必须满足0＜C＜B＜A＜100"})
    days = config.get("confirmationDays")
    if not finite(days) or int(days) != days or not 1 <= days <= 20:
        errors.append({"field": "confirmationDays", "message": "确认天数必须为1～20的整数"})
    return errors


def interpolate(value, points):
    if value <= points[0][0]:
        return {"score": points[0][1], "interval": [points[0], points[0]], "clipped": True}
    if value >= points[-1][0]:
        return {"score": points[-1][1], "interval": [points[-1], points[-1]], "clipped": True}
    for left, right in zip(points, points[1:]):
        if value <= right[0]:
            score = left[1] + (value - left[0]) / (right[0] - left[0]) * (right[1] - left[1])
            return {"score": score, "interval": [left, right], "clipped": False}
    raise ValueError("无法定位锚点区间")


def grade_for_score(value, strategy):
    return next((g for g in ("A", "B", "C") if value >= strategy["thresholds"][g]), "D")


def score_input(inputs, strategy=None, dates=None, source_key="", reference=False, kind="daily"):
    strategy = normalize_strategy(strategy or load_default_strategy())
    errors = validate_strategy(strategy)
    if errors:
        raise ValueError(json.dumps(errors, ensure_ascii=False))
    dates = dates or {}
    y, b = (inputs.get(k) for k in ("dividendYield", "bondYield"))
    y = y if finite(y) and y >= 0 else None
    b = b if finite(b) and b > 0 else None
    ratio = y / b if y is not None and b is not None else None
    ratio = ratio if finite(ratio) else None
    components, lower, upper = {}, 0, 0
    for key, value in zip(KEYS, (y, ratio)):
        detail = interpolate(value, strategy["anchors"][key]) if value is not None else {"score": None, "interval": None, "clipped": False}
        weight = strategy["weights"][key]
        contribution = detail["score"] * weight / 100 if detail["score"] is not None else None
        components[key] = dict(detail, value=value, weight=weight, contribution=contribution)
        lower += contribution or 0
        upper += contribution if contribution is not None else weight
    complete = all(item["weight"] == 0 or item["score"] is not None for item in components.values())
    grade = grade_for_score(lower, strategy) if complete else None
    next_grade = {"D": "C", "C": "B", "B": "A"}.get(grade)
    required_keys = ["index"]
    if strategy["weights"]["ratio"] > 0:
        required_keys.append("bond")
    required_dates = [dates.get(k) for k in required_keys]
    aligned = all(valid_date(day) for day in required_dates) and len(set(required_dates)) == 1
    source_key = "股息率与股债倍数" if strategy["weights"]["ratio"] > 0 else "绝对股息率"
    dates = {key: dates.get(key) for key in required_keys}
    quality = []
    if not complete:
        quality.append("数据不足")
    if not aligned:
        quality.append("日期未对齐")
    if kind != "daily":
        quality.append("历史数据试算" if kind == "legacy" else "本地参考快照")
    return {
        "input": {"dividendYield": y, "bondYield": b},
        "dates": dates, "sourceKey": source_key, "reference": False, "kind": kind,
        "strategyVersion": strategy["version"], "components": components,
        "score": lower if complete else None, "lower": lower, "upper": upper,
        "grade": grade, "label": LABELS.get(grade, "数据不足，暂不评级"),
        "nextGrade": next_grade,
        "nextDistance": strategy["thresholds"][next_grade] - lower if next_grade else None,
        "quality": quality or ["数据完整"],
        "eligible": complete and aligned and bool(source_key) and kind == "daily",
    }


def confirm_records(records, trading_dates, required=3):
    """Replay observations on evidenced trading dates. Missing days break the streak."""
    by_date = {r["dates"]["index"]: r for r in records if valid_date(r.get("dates", {}).get("index"))}
    last = max(by_date, default="")
    calendar = sorted({d for d in trading_dates if valid_date(d) and d <= last})
    result = {"status": "insufficient", "baseline": None, "candidate": None, "count": 0, "required": required, "message": "证据不足"}
    if not last or last not in calendar:
        return result
    context, baseline, candidate, count = None, None, None, 0
    status = "insufficient"
    for day in calendar:
        r = by_date.get(day)
        if r:
            current_context = (r.get("sourceKey"), r.get("strategyVersion"))
            if context != current_context:
                context, baseline, candidate, count = current_context, None, None, 0
        if not r or not r.get("eligible"):
            candidate, count, status = None, 0, "insufficient"
            continue
        grade = r["grade"]
        if grade == baseline:
            candidate, count, status = None, 0, "stable"
            continue
        count = count + 1 if grade == candidate else 1
        candidate = grade
        status = "pending"
        if count >= required:
            status = "established" if baseline is None else "changed"
            baseline, candidate, count = grade, None, 0
    messages = {"insufficient": "证据不足", "stable": f"已确认 {baseline}，策略维持", "established": f"已建立 {baseline} 基准", "changed": f"策略调整已确认：{baseline}", "pending": f"待确认 {candidate}：{count}/{required}个交易日"}
    return dict(result, status=status, baseline=baseline, candidate=candidate, count=count, message=messages[status])
