"""Recalculate the saved workbook without rebuilding its native Excel package."""

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
import json
import math
import os
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from uuid import uuid4
from xml.sax.saxutils import escape
import zipfile


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def number(value):
    if value is None or isinstance(value, bool) or not str(value).strip():
        return None
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (ValueError, TypeError):
        return None


def iso_date(value):
    text = str(value or "")
    try:
        if re.fullmatch(r"\d{5}(?:\.0+)?", text):
            return (date(1899, 12, 30) + timedelta(days=int(float(text)))).isoformat()
        match = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])", text)
        return date(*map(int, match.groups())).isoformat() if match else ""
    except (ValueError, OverflowError):
        return ""


def column_name(index):
    result = ""
    while index:
        index, digit = divmod(index - 1, 26)
        result = chr(65 + digit) + result
    return result


def patch_workbook(original, changes):
    # Keep all other package members and all non-target cells byte-for-byte intact.
    cell_pattern = re.compile(r'<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:/>|>.*?</c>)', re.S)
    applied = set()

    def cell_xml(address, value, original_cell=""):
        head = original_cell.split(">", 1)[0].rstrip("/") if original_cell else f'<c r="{address}"'
        head = re.sub(r'\s+t="[^"]*"', "", head)
        if value is None:
            return head + "/>"
        if isinstance(value, str):
            return head + ' t="inlineStr"><is><t xml:space="preserve">' + escape(value) + "</t></is></c>"
        if not math.isfinite(value):
            raise ValueError("重算结果包含无效数字")
        return head + ' t="n"><v>' + repr(value) + "</v></c>"

    def replace_row(match):
        row_number = int(match[2])
        targets = {key: value for key, value in changes.items() if int(re.search(r"\d+$", key)[0]) == row_number}
        if not targets:
            return match[0]
        content = match[3]
        cells = list(cell_pattern.finditer(content))
        if not cells:
            raise ValueError("Excel数据行缺少可更新的单元格")
        updated = {}
        for cell in cells:
            address = cell[1]
            updated[address] = cell_xml(address, targets[address], cell[0]) if address in targets else cell[0]
        for address, value in targets.items():
            if address not in updated:
                updated[address] = cell_xml(address, value)
        applied.update(targets)
        ordered = sorted(updated, key=lambda address: (len(re.match(r"[A-Z]+", address)[0]), address))
        return match[1] + content[:cells[0].start()] + "".join(updated[key] for key in ordered) + content[cells[-1].end():] + match[4]

    with zipfile.ZipFile(BytesIO(original)) as source:
        xml = source.read("xl/worksheets/sheet1.xml").decode("utf-8")
        updated = re.sub(r'(<row\b[^>]*\br="(\d+)"[^>]*>)(.*?)(</row>)', replace_row, xml, flags=re.S)
        if applied != set(changes):
            raise ValueError("Excel存在无法定位的数据行，重算未写入")
        output = BytesIO()
        with zipfile.ZipFile(output, "w") as target:
            for member in source.infolist():
                target.writestr(member, updated.encode("utf-8") if member.filename == "xl/worksheets/sheet1.xml" else source.read(member.filename))
    return output.getvalue()


def prepare_recalculation(data, original, previous, strategy, scoring):
    rows = data["rows"]
    if len(rows) < 3:
        raise ValueError("当前Excel没有可重算的数据")
    headers = rows[0]
    required = ["run_date__record_date", "index_date__index_valuation_date", "akshare_dividend_yield_2", "bond_10y_yield", "bond_date__china_10y_yield_date", "absolute_signal", "spread_signal", "headline_signal", "strategy_version", "composite_score", "composite_grade", "score_lower", "score_upper", "score_quality", "confirmation_status"]
    required += [key + suffix for key in scoring.KEYS for suffix in ("_score", "_contribution")]
    if any(key not in headers for key in required):
        raise ValueError("当前Excel缺少重算所需字段")
    previous_records = previous.get("records", [])
    if not isinstance(previous_records, list) or any(not isinstance(record, dict) for record in previous_records):
        raise ValueError("原评分记录格式无效")
    original_raw = {record.get("dates", {}).get("index"): record.get("raw", {}) for record in previous_records if not record.get("fromWorkbook") and isinstance(record.get("raw"), dict)}
    stamp = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")
    records, changes, yield_history = [], {}, []
    for position, values in enumerate(rows[2:], 2):
        if not any(value is not None and str(value).strip() for value in values):
            continue
        raw = dict(zip(headers, values))
        raw = {**original_raw.get(iso_date(raw.get("index_date__index_valuation_date")), {}), **raw}
        dates = {"index": iso_date(raw.get("index_date__index_valuation_date")), "bond": iso_date(raw.get("bond_date__china_10y_yield_date"))}
        source = "股息率与股债倍数"
        result = scoring.score_input({"dividendYield": number(raw.get("akshare_dividend_yield_2")), "bondYield": number(raw.get("bond_10y_yield"))}, strategy, dates, source, False, "legacy")
        updates = {"strategy_version": strategy["version"], "composite_score": result["score"], "composite_grade": result["grade"], "score_lower": result["lower"], "score_upper": result["upper"], "score_quality": "；".join(result["quality"]), "confirmation_status": "历史重算，不作为当时连续确认信号", "headline_signal": f'{result["grade"]} · {result["label"]}' if result["grade"] else result["label"]}
        for key, signal_field in zip(scoring.KEYS, ("absolute_signal", "spread_signal")):
            component = result["components"][key]
            grade = scoring.grade_for_score(component["score"], strategy) if component["score"] is not None else None
            updates.update({signal_field: f"{grade} · {scoring.COMPONENT_LABELS[grade]}" if grade else "待验证", key + "_score": component["score"], key + "_contribution": component["contribution"]})
        row_number = data.get("rowNumbers", list(range(1, len(rows) + 1)))[position]
        for key, value in updates.items():
            changes[f"{column_name(headers.index(key) + 1)}{row_number}"] = value
        raw.update(updates)
        raw.update(run_date=iso_date(raw.get("run_date__record_date")), index_date=dates["index"], bond_date=dates["bond"], source_note=str(raw.get("source_note") or source) + "；按当前策略历史重算，原始指标日期不变")
        result.update(raw=raw, recordDate=raw["run_date"], strategySnapshot=deepcopy(strategy), recalculatedAt=stamp, fromWorkbook=True)
        records.append(result)
        if dates["index"] and result["input"]["dividendYield"] is not None:
            yield_history.append({"date": dates["index"], "recordDate": raw["run_date"], "value": result["input"]["dividendYield"], "headline": updates["headline_signal"]})
    dated = [record for record in records if record["dates"]["index"]]
    if not dated:
        raise ValueError("当前Excel没有有效的指数估值日期")
    latest = max(dated, key=lambda record: (record["dates"]["index"], record["recordDate"]))
    preserved = [record for record in previous_records if not (record.get("fromWorkbook") and record.get("strategyVersion") == strategy["version"])]
    payload = {"schemaVersion": 1, "strategy": strategy, "latest": latest, "records": preserved + records, "tradingDates": sorted({point["date"] for point in data["indexPoints"]}), "recalculatedAt": stamp}
    counts = {grade: sum(record["grade"] == grade for record in records) for grade in ("A", "B", "C", "D")}
    view = {"schemaVersion": 1, "payload": payload, "yieldHistory": yield_history, "indexHistory": data["indexPoints"]}
    raw = latest["raw"]
    def display(value):
        return "待验证" if value is None or value == "" else str(value)
    markdown = ["# 中证红利最新股息率信号", "", f'- 运行时间：{latest["recordDate"]} {raw.get("run_time", "")}', f"- 重算时间：{stamp}", f'- 指数估值日期：{latest["dates"]["index"]}', f'- 10年国债收益率日期：{latest["dates"]["bond"]}']
    for label, value in [("中证红利股息率口径", latest["input"]["dividendYield"]), ("全年收益率", raw.get("ytd_return")), ("年内最大回撤", raw.get("ytd_max_drawdown")), ("当天涨跌幅", raw.get("intraday_change_percent")), ("中国10年国债收益率", latest["input"]["bondYield"]), ("指数股息率口径 - 10年国债收益率", raw.get("spread"))]:
        markdown.append(f"- {label}：{display(value)}%")
    markdown += ["", "## 判断", "", f'- 绝对股息率触发：{raw["absolute_signal"]}', f'- 相对债券收益率触发：{raw["spread_signal"]}', f'- 综合结论：{raw["headline_signal"]}', "", "## 当前策略重算", "", f'- 策略版本：{strategy["version"]}', f'- 综合分：{display(latest["score"])}', f'- 数据质量：{"；".join(latest["quality"])}', "- 连续确认：历史重算，不作为当时连续确认信号"]
    for key, component in latest["components"].items():
        markdown.append(f'- {key}贡献：{display(component["score"])} × {component["weight"]}% = {display(component["contribution"])}')
    markdown += ["", "## 来源", "", "- " + raw["source_note"], "", "## 说明", "", "- 保存策略后使用当前Excel已保存指标重算；不新增行情，不改变原始数据日期。", "- 历史重算不视为当时已发布或连续确认的每日信号；原文件与策略已备份。", ""]
    return patch_workbook(original, changes), payload, "\n".join(markdown).encode("utf-8"), view, len(records), counts


def commit_files(replacements, originals, backup_dir):
    for path, original in originals.items():
        current = path.read_bytes() if path.exists() else None
        if current != original:
            raise ValueError("重算期间文件已被修改，请保存Excel并重试")
    backup_dir.mkdir(parents=True, exist_ok=False)
    for path, original in originals.items():
        if original is not None:
            (backup_dir / path.name).write_bytes(original)
    staged, committed = {}, []
    try:
        for path, value in replacements.items():
            temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
            staged[path] = temporary
            temporary.write_bytes(value)
        for path, temporary in staged.items():
            os.replace(temporary, path)
            committed.append(path)
    except BaseException:
        for path in reversed(committed):
            original = originals[path]
            if original is None:
                path.unlink(missing_ok=True)
            else:
                rollback = path.with_name(f".{path.name}.{uuid4().hex}.rollback")
                rollback.write_bytes(original)
                os.replace(rollback, path)
        raise
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)


def save_and_recalculate(strategy, revision, settings_file, vault_root, store, scoring, read_data):
    settings_file = Path(settings_file)
    settings_file.parent.mkdir(parents=True, exist_ok=True)
    directory = Path(vault_root) / "sources/automations/中证红利信号"
    workbook = directory / "中证红利每日信号.xlsx"
    score_file, markdown_file = directory / "评分记录.json", directory / "最新信号.md"
    original_settings = settings_file.read_bytes() if settings_file.exists() else None
    with TemporaryDirectory(prefix="dividend-recalculation-") as temporary:
        plan_file = Path(temporary) / "settings.json"
        if original_settings is not None:
            plan_file.write_bytes(original_settings)
        saved = store.save_settings(strategy, revision, plan_file)
        # Prepare against a private settings file before taking the shared OS lock.
        with store.settings_lock(settings_file):
            current_settings = settings_file.read_bytes() if settings_file.exists() else None
            if current_settings != original_settings:
                raise store.StrategyConflict("每日策略已被其他页面更新，请重新应用")
            originals = {path: path.read_bytes() if path.exists() else None for path in (workbook, score_file, markdown_file, settings_file)}
            if originals[workbook] is None:
                raise FileNotFoundError("未找到当前Excel，策略和数据均未修改")
            data = read_data(vault_root)
            previous = json.loads(originals[score_file].decode("utf-8-sig")) if originals[score_file] else {}
            if not isinstance(previous, dict):
                raise ValueError("原评分记录格式无效")
            updated, payload, markdown, view, count, counts = prepare_recalculation(data, originals[workbook], previous, saved["strategy"], scoring)
            backup = directory / "备份" / ("保存并重算-" + datetime.now(timezone(timedelta(hours=8))).strftime("%Y%m%d-%H%M%S-") + uuid4().hex[:8])
            replacements = {workbook: updated, score_file: json_bytes(payload), markdown_file: markdown}
            if plan_file.exists():
                replacements[settings_file] = plan_file.read_bytes()
            commit_files(replacements, originals, backup)
    return dict(saved, recalculation={"updatedRows": count, "gradeCounts": counts, "backupPath": backup.relative_to(vault_root).as_posix(), "view": view})
