"""Local execution receipts and read-only validation for the daily signal."""

from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
from threading import Event, Lock, Thread
from uuid import uuid4
import xml.etree.ElementTree as ET
import zipfile

try:
    from .scoring import score_input, validate_strategy
except ImportError:
    from scoring import score_input, validate_strategy


SHANGHAI = timezone(timedelta(hours=8))
OUTPUT_NAMES = ("中证红利每日信号.xlsx", "最新信号.md", "中证红利年度表现.json", "评分记录.json")
OUTPUT_ROOT = "sources/automations/中证红利信号"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def local_now():
    return datetime.now(SHANGHAI)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def normalize_date(value):
    match = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?", str(value or ""))
    if not match:
        return ""
    try:
        return datetime(*map(int, match.groups())).date().isoformat()
    except ValueError:
        return ""


def workbook_rows(path):
    """Read the script's fixed worksheet without adding dashboard dependencies."""
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.findall("s:sheetData/s:row", NS):
        values = {}
        for cell in row.findall("s:c", NS):
            column = re.sub(r"\d", "", cell.get("r", ""))
            value = cell.findtext("s:v", default="", namespaces=NS)
            if cell.get("t") == "s":
                value = shared[int(value)]
            elif cell.get("t") == "inlineStr":
                value = "".join(node.text or "" for node in cell.findall(".//s:t", NS))
            values[column] = value
        rows.append((int(row.get("r", "0")), values))
    headers = next((values for number, values in rows if number == 1), {})
    if "run_date__record_date" not in headers.values():
        raise ValueError("Excel缺少记录日期表头")
    return [{name: values.get(column, "") for column, name in headers.items()}
            for number, values in rows if number >= 3 and any(values.values())]


def finite_number(value, positive=False):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and (value > 0 if positive else value >= 0))


def inspect_outputs(directory, run_date):
    directory = Path(directory)
    artifacts, loaded, checks, warnings = [], {}, [], []
    for name in OUTPUT_NAMES:
        path = directory / name
        entry = {"name": name, "href": f"/{OUTPUT_ROOT}/{name}", "ok": False, "message": ""}
        try:
            loaded[name] = (workbook_rows(path) if name.endswith(".xlsx") else
                            read_json(path) if name.endswith(".json") else path.read_text(encoding="utf-8-sig"))
            entry.update(ok=True, message="文件可读")
        except (OSError, ValueError, KeyError, IndexError, TypeError, zipfile.BadZipFile, ET.ParseError) as error:
            entry["message"] = f"读取失败：{error}"
        artifacts.append(entry)

    def check(key, label, passed, detail, files=()):
        checks.append({"key": key, "label": label, "ok": bool(passed), "detail": detail})
        if not passed:
            for artifact in artifacts:
                if artifact["name"] in files:
                    artifact.update(ok=False, message=detail)

    score = loaded.get("评分记录.json")
    score = score if isinstance(score, dict) else {}
    latest = score.get("latest", {})
    if not isinstance(latest, dict):
        latest = {}
    raw = latest.get("raw") if isinstance(latest.get("raw"), dict) else {}
    dates = latest.get("dates") if isinstance(latest.get("dates"), dict) else {}
    actual_date = normalize_date(latest.get("recordDate"))
    version = latest.get("strategyVersion", "")
    version = version if isinstance(version, str) else ""
    check("score-date", "评分记录日期", actual_date == run_date == raw.get("run_date"),
          f"期望 {run_date}；实际 {actual_date or '未取得'}", ("评分记录.json",))
    rows = loaded.get("中证红利每日信号.xlsx", [])
    matches = [row for row in rows if normalize_date(row.get("run_date__record_date")) == run_date
               and row.get("strategy_version") == version]
    check("unique-row", "当日同策略记录唯一", len(matches) == 1,
          f"{run_date} / {version or '版本未取得'}：{len(matches)} 条；历史其他版本保留", ("中证红利每日信号.xlsx",))
    row = matches[0] if len(matches) == 1 else {}
    try:
        consistent = (row.get("composite_grade") == latest.get("grade")
                      and math.isclose(float(row.get("composite_score")), float(latest.get("score")), abs_tol=1e-8)
                      and row.get("index_date__index_valuation_date") == dates.get("index")
                      and row.get("bond_date__china_10y_yield_date") == dates.get("bond")
                      and math.isclose(float(row.get("akshare_dividend_yield_2")), float(latest["input"]["dividendYield"]), abs_tol=1e-8)
                      and math.isclose(float(row.get("bond_10y_yield")), float(latest["input"]["bondYield"]), abs_tol=1e-8))
    except (TypeError, ValueError, KeyError):
        consistent = False
    check("consistent-score", "Excel与评分记录一致", consistent,
          "核对输入值、数据日期、综合分与等级", ("中证红利每日信号.xlsx", "评分记录.json"))
    markdown = loaded.get("最新信号.md", "")
    check("markdown", "最新信号日期与版本", f"运行时间：{run_date} " in markdown and bool(version) and version in markdown,
          f"记录日期 {run_date}；策略 {version or '未取得'}", ("最新信号.md",))
    annual = loaded.get("中证红利年度表现.json")
    annual_ok = (isinstance(annual, dict) and annual.get("indexCode") == "000922"
                 and isinstance(annual.get("rows"), list) and bool(annual["rows"])
                 and annual.get("lastDate") == dates.get("index")
                 and all(isinstance(item, dict) and bool(item.get("monthly_returns")) for item in annual["rows"]))
    check("annual", "年度及月度表现有效", annual_ok,
          f"指数000922，截止日与估值日 {dates.get('index') or '未取得'} 一致", ("中证红利年度表现.json",))
    try:
        settings = read_json(directory / "策略参数.json")
        strategy = settings["strategy"]
        history = settings.get("history")
        revision = settings.get("revision")
        if (settings.get("schemaVersion") != 1 or isinstance(revision, bool) or not isinstance(revision, int)
                or revision < 1 or validate_strategy(strategy) or not isinstance(history, list) or not history
                or not isinstance(history[-1], dict) or history[-1].get("revision") != revision
                or history[-1].get("strategy") != strategy):
            raise ValueError("每日策略配置、版本或历史无效")
        valid = (strategy == score.get("strategy") == latest.get("strategySnapshot")
                 and strategy["version"] == version and re.fullmatch(r"dividend-two-factor-v2-r\d+", version))
        check("strategy", "使用当前应用策略", valid,
              f"当前 {strategy['version']}；本次 {version or '未取得'}（核对完整参数）", ("评分记录.json",))
        score_inputs = latest.get("input") if isinstance(latest.get("input"), dict) else {}
        recalculated = score_input(score_inputs, strategy=strategy, dates=dates)
        try:
            score_ok = (recalculated["grade"] == latest.get("grade") and recalculated["score"] is not None
                        and math.isclose(recalculated["score"], float(latest.get("score")), abs_tol=1e-8))
        except (TypeError, ValueError):
            score_ok = False
        check("score-math", "综合评分复算一致", score_ok,
              "按当前权重、锚点与等级分界复算原始输入", ("评分记录.json",))
    except (OSError, ValueError, KeyError, TypeError) as error:
        check("strategy", "使用当前应用策略", False, f"策略配置不可验证：{error}", ("评分记录.json",))
    inputs = latest.get("input") if isinstance(latest.get("input"), dict) else {}
    check("inputs", "两项评分输入完整", finite_number(inputs.get("dividendYield")) and finite_number(inputs.get("bondYield"), positive=True),
          "股息率有效且10年国债收益率大于零", ("评分记录.json",))
    check("dates", "来源日期有效", bool(normalize_date(dates.get("index"))) and bool(normalize_date(dates.get("bond")))
          and dates["index"] <= run_date and dates["bond"] <= run_date,
          f"估值 {dates.get('index') or '未取得'}；国债 {dates.get('bond') or '未取得'}", ("评分记录.json",))
    if dates.get("index") != dates.get("bond"):
        warnings.append("估值与国债日期未对齐；不参与连续确认。")
    if not raw.get("intraday_quote_date") or raw.get("intraday_change_percent") in (None, ""):
        warnings.append(raw.get("source_note") or "腾讯行情未取得；不影响两项评分输入。")
    return {"ok": all(item["ok"] for item in artifacts + checks), "artifacts": artifacts, "checks": checks,
            "warnings": warnings, "dates": {**dates, "quote": raw.get("intraday_quote_date", "")},
            "strategyVersion": version, "recordDate": actual_date,
            "recordedAt": f"{actual_date}T{raw['run_time']}+08:00" if actual_date and raw.get("run_time") else "",
            "rows": rows}


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


class RunMonitor:
    def __init__(self, directory, run_date):
        self.directory = Path(directory)
        now = local_now()
        self.path = self.directory / "运行记录" / f"{now.strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:12]}.json"
        self.record = {"schemaVersion": 1, "id": self.path.stem, "source": "execution", "runDate": run_date,
                       "startedAt": now.isoformat(), "endedAt": "", "status": "running", "pid": os.getpid(),
                       "stage": "开始执行", "writtenFiles": [], "error": ""}
        self.lock, self.stop = Lock(), Event()
        self.finished = False
        self.stage("开始执行")
        self.thread = Thread(target=self._heartbeat, daemon=True)
        self.thread.start()

    def _save(self):
        self.record["updatedAt"] = local_now().isoformat()
        atomic_json(self.path, self.record)

    def _heartbeat(self):
        while not self.stop.wait(20):
            with self.lock:
                try:
                    self._save()
                except OSError:
                    return  # A stale receipt is shown as unconfirmed, never as success.

    def stage(self, name):
        with self.lock:
            self.record["stage"] = name
            self._save()

    def written(self, name):
        with self.lock:
            self.record["writtenFiles"].append(name)
            self._save()

    def finish(self, error=None):
        if self.finished:
            return self.record
        self.stop.set()
        self.thread.join(timeout=2)
        with self.lock:
            if error is not None:
                self.record.update(status="partial" if self.record["writtenFiles"] else "failed", error=str(error)[:2000] or type(error).__name__)
            else:
                validation = inspect_outputs(self.directory, self.record["runDate"])
                validation.pop("rows")
                self.record["validation"] = validation
                self.record["status"] = "success" if validation["ok"] else "partial"
                if validation["ok"] and validation["warnings"]:
                    self.record["status"] = "warning"
                if not validation["ok"]:
                    self.record["error"] = "；".join(item["label"] for item in validation["checks"] if not item["ok"]) or "输出文件不可读"
                self.record["stage"] = "校验完成"
            end = local_now()
            self.record.update(endedAt=end.isoformat(), durationSeconds=round((end - datetime.fromisoformat(self.record["startedAt"])).total_seconds(), 1))
            self._save()
            self.finished = True
        return self.record


def process_alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def monitor_payload(directory, now=None):
    now = (now or local_now()).astimezone(SHANGHAI)
    today = now.date().isoformat()
    directory = Path(directory)
    validation = inspect_outputs(directory, today)
    rows = validation.pop("rows")
    history, errors = [], []
    for path in sorted((directory / "运行记录").glob("*.json"), reverse=True):
        try:
            record = read_json(path)
            if (not isinstance(record, dict) or record.get("schemaVersion") != 1
                    or normalize_date(record.get("runDate")) != record.get("runDate")
                    or not record.get("startedAt")
                    or record.get("status") not in {"running", "success", "warning", "partial", "failed"}):
                raise ValueError("运行记录格式无效")
            if datetime.fromisoformat(record["startedAt"]).tzinfo is None:
                raise ValueError("运行记录缺少时区")
            record["id"] = path.stem
            record["source"] = "execution"
            if record.get("status") == "running":
                updated = datetime.fromisoformat(record["updatedAt"])
                if not process_alive(record.get("pid")) or (now - updated).total_seconds() > 120:
                    record = {**record, "status": "unconfirmed", "error": "运行状态停止更新，执行是否中断待确认。"}
            record.pop("pid", None)
            record["receiptHref"] = f"/{OUTPUT_ROOT}/运行记录/{path.name}"
            history.append(record)
        except (OSError, ValueError, KeyError, TypeError) as error:
            errors.append(f"{path.name}：{error}")
        if len(history) >= 60:
            break
    days_with_receipts = {item["runDate"] for item in history}
    legacy_days = {}
    for row in rows:
        day = normalize_date(row.get("run_date__record_date"))
        if day and day not in days_with_receipts:
            legacy_days[day] = {"id": f"legacy-{day}", "source": "artifact", "runDate": day, "status": "historical",
                                "startedAt": "", "endedAt": "", "stage": "历史信号记录", "error": "",
                                "dates": {"index": normalize_date(row.get("index_date__index_valuation_date")),
                                          "bond": normalize_date(row.get("bond_date__china_10y_yield_date"))},
                                "strategyVersion": row.get("strategy_version", "")}
    history.extend(legacy_days.values())
    history.sort(key=lambda item: (item["runDate"], item.get("startedAt") or ""), reverse=True)
    today_runs = [item for item in history if item["runDate"] == today and item["source"] == "execution"]
    deadline = now.replace(hour=9, minute=30, second=0, microsecond=0)
    current = today_runs[0].copy() if today_runs else {
        "runDate": today, "status": "pending" if now < deadline else "overdue", "source": "none",
        "startedAt": "", "endedAt": "", "error": "", "stage": "等待今日执行凭证"}
    if not today_runs and validation["recordDate"] == today:
        current.update(status="verified" if validation["ok"] else "partial", source="artifact", stage="现有产物核验",
                       recordedAt=validation["recordedAt"], error="" if validation["ok"] else "本日产物校验未全部通过")
        if validation["ok"] and validation["warnings"]:
            current["status"] = "verified-warning"
    elif today_runs and current["status"] in ("success", "warning") and not validation["ok"]:
        current.update(status="partial", error="运行曾完成，但当前产物校验未通过，请核对后续文件变更。")
    if errors:
        current.update(status="unconfirmed", error="部分运行记录不可读，请检查运行记录文件。")
    if current.get("source") == "artifact":
        history = [current if item["runDate"] == today and item["source"] == "artifact" else item for item in history]
        if not any(item["runDate"] == today for item in history):
            history.insert(0, current)
    return {"schemaVersion": 1, "taskName": "中证红利每日信号", "checkedAt": now.isoformat(),
            "schedule": {"time": "09:00", "timezone": "Asia/Shanghai", "includeHolidays": True, "graceMinutes": 30},
            "current": current, "validation": validation, "history": history[:60], "errors": errors,
            "boundary": "历史信号只能证明已有产物；未记录的开始时间、结束时间和耗时不补造。"}
