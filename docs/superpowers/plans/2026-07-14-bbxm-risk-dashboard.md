# 冰冰小美风险提示工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个固定读取项目内 Excel、自动获取上证指数实际收盘点位，并以参考图风格展示风险节点的本地网页工具。

**Architecture:** Flask 仅提供静态页面和一个聚合数据接口；Excel 解析、行情获取/缓存、日期对齐分别放在独立 Python 模块。浏览器使用本地托管的 Apache ECharts 同时绘制指数折线和风险散点，右侧只保留空白边框区域。

**Tech Stack:** Python 3.11+、Flask 3.1、openpyxl 3.1、AKShare 1.18、pandas 2.2、pytest 8、Apache ECharts 6、原生 HTML/CSS/JavaScript

---

## 实施前约束

- 在独立 `codex/` 工作树或分支中实施，避免混入当前工作区的既有修改。
- 实施时使用 `superpowers:test-driven-development`；完成前使用 `superpowers:verification-before-completion`。
- 前端实现前按 `ui-ux-pro-max` 生成一次“dark financial time-series dashboard”设计系统，只采用与已确认参考图一致的规则，不改变黑底、白框、灰线、红点和空白右栏。
- 行情接口采用 AKShare 官方文档列出的 `stock_zh_index_daily(symbol="sh000001")`，失败时尝试 `stock_zh_index_daily_tx(symbol="sh000001")`。两者都失败后才回退缓存。
- ECharts 必须保存到项目本地，不能只依赖 CDN，否则断网缓存回退时页面无法绘图。
- 所有提交只包含当前任务文件。

## 文件结构与职责

```text
tools/bbxm-risk-dashboard/
  .gitignore                         # 忽略行情缓存、虚拟环境和测试缓存
  README.md                          # 安装、启动、Excel 维护和错误排查
  requirements.txt                   # 运行与测试依赖
  run.py                             # 本地启动入口，仅监听 127.0.0.1
  bbxm_dashboard/
    __init__.py                      # Flask app factory 与路径注入
    errors.py                        # 面向页面的数据错误类型
    excel_data.py                    # Excel 读取、验证和同日合并
    market_data.py                   # 上证指数获取、标准化与缓存
    dashboard_data.py                # 风险日期对齐和 API 数据组装
    static/
      index.html                     # 页面语义结构、主图与空白右栏
      styles.css                     # 参考图风格及响应式规则
      app.js                         # 请求 API、配置图表和可访问交互
      vendor/
        echarts.min.js               # 本地 ECharts 发行文件
  data/
    冰冰小美风险提示.xlsx            # 固定人工维护文件
  tests/
    conftest.py                      # 临时数据目录和 Flask 测试实例
    test_excel_data.py               # Excel 契约与合并测试
    test_market_data.py              # 行情标准化、缓存和回退测试
    test_dashboard_data.py           # 日期对齐和统一载荷测试
    test_app.py                      # 路由、状态码和静态页面契约测试
  docs/
    dashboard-preview.png            # 最终视觉验收截图
```

## Task 1：建立最小 Flask 工程

**Files:**
- Create: `tools/bbxm-risk-dashboard/requirements.txt`
- Create: `tools/bbxm-risk-dashboard/.gitignore`
- Create: `tools/bbxm-risk-dashboard/run.py`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/__init__.py`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/errors.py`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/index.html`
- Create: `tools/bbxm-risk-dashboard/tests/test_app.py`

- [ ] **Step 1：写 app factory 失败测试**

```python
# tests/test_app.py
from bbxm_dashboard import create_app


def test_root_serves_dashboard_shell(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    response = app.test_client().get("/")

    assert response.status_code == 200
    assert "冰冰小美风险提示记录" in response.get_data(as_text=True)
```

- [ ] **Step 2：运行测试并确认因模块或页面不存在而失败**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_app.py::test_root_serves_dashboard_shell -v`

Expected: FAIL，错误包含 `ModuleNotFoundError: No module named 'bbxm_dashboard'` 或静态首页不存在。

- [ ] **Step 3：写依赖、错误类型和最小应用**

```text
# requirements.txt
Flask>=3.1,<4
openpyxl>=3.1,<4
akshare>=1.18.40,<2
pandas>=2.2,<3
pytest>=8.4,<9
```

```gitignore
.venv/
__pycache__/
.pytest_cache/
data/shanghai-index-cache.json
```

```python
# bbxm_dashboard/errors.py
class DashboardDataError(Exception):
    def __init__(self, code: str, message: str, details: list[dict] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or []
```

```python
# bbxm_dashboard/__init__.py
from pathlib import Path

from flask import Flask


def create_app(test_config: dict | None = None) -> Flask:
    package_dir = Path(__file__).resolve().parent
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.from_mapping(DATA_DIR=package_dir.parent / "data")
    if test_config:
        app.config.update(test_config)

    @app.get("/")
    def index():
        return app.send_static_file("index.html")

    return app
```

```python
# run.py
from bbxm_dashboard import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5179, debug=False)
```

```html
<!-- bbxm_dashboard/static/index.html -->
<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>冰冰小美风险提示记录</title></head>
<body><h1>冰冰小美风险提示记录</h1></body>
</html>
```

Task 6 再把这个最小页面替换为完整界面。

- [ ] **Step 4：安装依赖并确认测试通过**

Run: `cd tools/bbxm-risk-dashboard; python -m pip install -r requirements.txt; python -m pytest tests/test_app.py::test_root_serves_dashboard_shell -v`

Expected: `1 passed`。

- [ ] **Step 5：提交工程骨架**

```powershell
git add tools/bbxm-risk-dashboard
git commit -m "feat: scaffold bbxm risk dashboard"
```

## Task 2：实现 Excel 数据契约

**Files:**
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/excel_data.py`
- Create: `tools/bbxm-risk-dashboard/tests/test_excel_data.py`

- [ ] **Step 1：写正常读取、重复日期合并和错误定位测试**

```python
# tests/test_excel_data.py
from datetime import date, datetime

import pytest
from openpyxl import Workbook

from bbxm_dashboard.errors import DashboardDataError
from bbxm_dashboard.excel_data import load_risk_records


HEADERS = ["日期", "当日累计风险提示次数", "风险原因"]


def write_book(path, rows, headers=HEADERS):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def test_load_risk_records_merges_duplicate_dates(tmp_path):
    path = tmp_path / "risk.xlsx"
    write_book(path, [
        [datetime(2026, 7, 10), 1, "流动性收紧"],
        ["2026-07-10", 2, "外部冲突升级"],
        [date(2026, 7, 11), 1, "高位拥挤"],
    ])

    records, warnings = load_risk_records(path)

    assert records == [
        {"date": "2026-07-10", "count": 3, "reason": "流动性收紧\n外部冲突升级"},
        {"date": "2026-07-11", "count": 1, "reason": "高位拥挤"},
    ]
    assert warnings == ["2026-07-10 存在 2 行记录，已合并"]


@pytest.mark.parametrize(
    ("rows", "expected_column"),
    [
        ([[None, 1, "原因"]], "日期"),
        ([["2026-07-10", -1, "原因"]], "当日累计风险提示次数"),
        ([["2026-07-10", 1.5, "原因"]], "当日累计风险提示次数"),
    ],
)
def test_load_risk_records_reports_excel_row(tmp_path, rows, expected_column):
    path = tmp_path / "risk.xlsx"
    write_book(path, rows)

    with pytest.raises(DashboardDataError) as exc_info:
        load_risk_records(path)

    assert exc_info.value.code == "excel_invalid"
    assert exc_info.value.details[0]["row"] == 2
    assert exc_info.value.details[0]["column"] == expected_column


def test_load_risk_records_reports_missing_columns(tmp_path):
    path = tmp_path / "risk.xlsx"
    write_book(path, [], headers=["日期", "风险原因"])

    with pytest.raises(DashboardDataError) as exc_info:
        load_risk_records(path)

    assert exc_info.value.code == "excel_missing_columns"
    assert "当日累计风险提示次数" in exc_info.value.message
```

- [ ] **Step 2：运行测试并确认失败**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_excel_data.py -v`

Expected: FAIL，错误包含 `No module named 'bbxm_dashboard.excel_data'`。

- [ ] **Step 3：实现 UTF-8 无关的 Excel 读取、验证与同日合并**

```python
# bbxm_dashboard/excel_data.py
from collections import OrderedDict
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

from .errors import DashboardDataError

REQUIRED_COLUMNS = ("日期", "当日累计风险提示次数", "风险原因")


def _parse_date(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        return datetime.strptime(value.strip(), "%Y-%m-%d").date().isoformat()
    raise ValueError("日期必须是 Excel 日期或 YYYY-MM-DD 文本")


def load_risk_records(path: Path) -> tuple[list[dict], list[str]]:
    if not path.exists():
        raise DashboardDataError("excel_missing", f"未找到风险记录文件：{path}")
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
    except PermissionError as exc:
        raise DashboardDataError("excel_locked", "Excel 文件正被占用，请关闭后重试") from exc
    sheet = workbook.active
    header_values = [cell.value for cell in next(sheet.iter_rows(min_row=1, max_row=1))]
    missing = [name for name in REQUIRED_COLUMNS if name not in header_values]
    if missing:
        raise DashboardDataError(
            "excel_missing_columns",
            f"Excel 缺少必需列：{'、'.join(missing)}；检测到：{'、'.join(str(v) for v in header_values if v)}",
        )
    positions = {name: header_values.index(name) for name in REQUIRED_COLUMNS}
    grouped: OrderedDict[str, dict] = OrderedDict()
    issues = []
    for row_number, cells in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        raw_date = cells[positions["日期"]]
        raw_count = cells[positions["当日累计风险提示次数"]]
        raw_reason = cells[positions["风险原因"]]
        try:
            parsed_date = _parse_date(raw_date)
        except (TypeError, ValueError):
            issues.append({"row": row_number, "column": "日期", "value": raw_date})
            continue
        if isinstance(raw_count, bool) or not isinstance(raw_count, int) or raw_count < 0:
            issues.append({"row": row_number, "column": "当日累计风险提示次数", "value": raw_count})
            continue
        reason = "" if raw_reason is None else str(raw_reason).strip()
        item = grouped.setdefault(parsed_date, {"date": parsed_date, "count": 0, "reasons": [], "rows": 0})
        item["count"] += raw_count
        item["rows"] += 1
        if reason:
            item["reasons"].append(reason)
    workbook.close()
    if issues:
        raise DashboardDataError("excel_invalid", "Excel 中存在无效数据", issues)
    warnings = [f"{key} 存在 {item['rows']} 行记录，已合并" for key, item in grouped.items() if item["rows"] > 1]
    records = [
        {"date": key, "count": item["count"], "reason": "\n".join(item["reasons"])}
        for key, item in sorted(grouped.items())
    ]
    if not records:
        raise DashboardDataError("excel_empty", "Excel 中没有有效风险记录")
    return records, warnings
```

- [ ] **Step 4：运行 Excel 测试**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_excel_data.py -v`

Expected: `5 passed`。

- [ ] **Step 5：提交 Excel 解析器**

```powershell
git add tools/bbxm-risk-dashboard/bbxm_dashboard/excel_data.py tools/bbxm-risk-dashboard/tests/test_excel_data.py
git commit -m "feat: validate bbxm risk workbook"
```

## Task 3：实现上证指数获取和缓存回退

**Files:**
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/market_data.py`
- Create: `tools/bbxm-risk-dashboard/tests/test_market_data.py`

- [ ] **Step 1：写行情标准化、实时成功、缓存回退和无缓存失败测试**

```python
# tests/test_market_data.py
import json

import pandas as pd
import pytest

from bbxm_dashboard.errors import DashboardDataError
from bbxm_dashboard.market_data import get_index_series


def test_get_index_series_writes_live_cache(tmp_path):
    frame = pd.DataFrame({"date": ["2026-07-09", "2026-07-10"], "close": [3509.68, 3510.25]})
    result = get_index_series(tmp_path / "cache.json", providers=[("sina", lambda: frame)])

    assert result["source"] == "live"
    assert result["provider"] == "sina"
    assert result["rows"][-1] == {"date": "2026-07-10", "close": 3510.25}
    assert json.loads((tmp_path / "cache.json").read_text(encoding="utf-8"))["symbol"] == "sh000001"


def test_get_index_series_falls_back_to_cache(tmp_path):
    cache = tmp_path / "cache.json"
    cache.write_text(json.dumps({
        "symbol": "sh000001",
        "updated_at": "2026-07-10T16:00:00+08:00",
        "provider": "sina",
        "rows": [{"date": "2026-07-10", "close": 3510.25}],
    }), encoding="utf-8")

    result = get_index_series(cache, providers=[("broken", lambda: (_ for _ in ()).throw(RuntimeError("offline")))])

    assert result["source"] == "cache"
    assert result["updated_at"] == "2026-07-10T16:00:00+08:00"
    assert "broken: offline" in result["warning"]


def test_get_index_series_raises_without_live_data_or_cache(tmp_path):
    with pytest.raises(DashboardDataError) as exc_info:
        get_index_series(tmp_path / "missing.json", providers=[("broken", lambda: (_ for _ in ()).throw(RuntimeError("offline")))])

    assert exc_info.value.code == "market_unavailable"
```

- [ ] **Step 2：运行测试并确认失败**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_market_data.py -v`

Expected: FAIL，错误包含 `No module named 'bbxm_dashboard.market_data'`。

- [ ] **Step 3：实现双提供方、字段标准化和原子缓存写入**

```python
# bbxm_dashboard/market_data.py
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd

from .errors import DashboardDataError


def _default_providers():
    return [
        ("sina", lambda: ak.stock_zh_index_daily(symbol="sh000001")),
        ("tencent", lambda: ak.stock_zh_index_daily_tx(symbol="sh000001")),
    ]


def _normalise(frame: pd.DataFrame) -> list[dict]:
    lowered = {str(column).lower(): column for column in frame.columns}
    if "date" not in lowered or "close" not in lowered:
        raise ValueError(f"行情字段不完整：{list(frame.columns)}")
    clean = frame[[lowered["date"], lowered["close"]]].copy()
    clean.columns = ["date", "close"]
    clean["date"] = pd.to_datetime(clean["date"], errors="raise").dt.strftime("%Y-%m-%d")
    clean["close"] = pd.to_numeric(clean["close"], errors="raise")
    clean = clean.dropna().drop_duplicates("date", keep="last").sort_values("date")
    if clean.empty:
        raise ValueError("行情结果为空")
    return [{"date": row.date, "close": round(float(row.close), 4)} for row in clean.itertuples(index=False)]


def get_index_series(cache_path: Path, providers=None) -> dict:
    errors = []
    for provider_name, fetch in providers or _default_providers():
        try:
            rows = _normalise(fetch())
            updated_at = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds")
            payload = {"symbol": "sh000001", "provider": provider_name, "updated_at": updated_at, "rows": rows}
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = cache_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            temporary.replace(cache_path)
            return {**payload, "source": "live", "warning": None}
        except Exception as exc:
            errors.append(f"{provider_name}: {exc}")
    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        return {**cached, "source": "cache", "warning": "；".join(errors)}
    raise DashboardDataError("market_unavailable", "上证指数获取失败且没有本地缓存", [{"errors": errors}])
```

- [ ] **Step 4：运行行情测试**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_market_data.py -v`

Expected: `3 passed`。

- [ ] **Step 5：提交行情模块**

```powershell
git add tools/bbxm-risk-dashboard/bbxm_dashboard/market_data.py tools/bbxm-risk-dashboard/tests/test_market_data.py
git commit -m "feat: fetch and cache shanghai index"
```

## Task 4：实现风险日期对齐和统一载荷

**Files:**
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/dashboard_data.py`
- Create: `tools/bbxm-risk-dashboard/tests/test_dashboard_data.py`

- [ ] **Step 1：写交易日、周末对齐和范围错误测试**

```python
# tests/test_dashboard_data.py
import pytest

from bbxm_dashboard.dashboard_data import build_dashboard_payload
from bbxm_dashboard.errors import DashboardDataError


MARKET = {
    "source": "live",
    "provider": "sina",
    "updated_at": "2026-07-13T16:00:00+08:00",
    "warning": None,
    "rows": [
        {"date": "2026-07-10", "close": 3510.25},
        {"date": "2026-07-13", "close": 3519.65},
    ],
}


def test_build_dashboard_payload_aligns_weekend_to_previous_close():
    payload = build_dashboard_payload(
        [{"date": "2026-07-11", "count": 2, "reason": "周末风险"}],
        ["重复记录已合并"],
        MARKET,
    )

    assert payload["risk_points"] == [{
        "risk_date": "2026-07-11",
        "market_date": "2026-07-10",
        "close": 3510.25,
        "count": 2,
        "reason": "周末风险",
    }]
    assert payload["status"]["warnings"] == ["重复记录已合并"]


def test_build_dashboard_payload_rejects_risk_before_market_history():
    with pytest.raises(DashboardDataError) as exc_info:
        build_dashboard_payload([{"date": "1990-01-01", "count": 1, "reason": "过早"}], [], MARKET)

    assert exc_info.value.code == "market_range_incomplete"
```

- [ ] **Step 2：运行测试并确认失败**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_dashboard_data.py -v`

Expected: FAIL，错误包含 `No module named 'bbxm_dashboard.dashboard_data'`。

- [ ] **Step 3：实现向前查找最近交易日和统一 JSON 结构**

```python
# bbxm_dashboard/dashboard_data.py
from bisect import bisect_right

from .errors import DashboardDataError


def build_dashboard_payload(risk_records: list[dict], excel_warnings: list[str], market: dict) -> dict:
    market_rows = market["rows"]
    market_dates = [row["date"] for row in market_rows]
    close_by_date = {row["date"]: row["close"] for row in market_rows}
    points = []
    for record in risk_records:
        position = bisect_right(market_dates, record["date"]) - 1
        if position < 0:
            raise DashboardDataError(
                "market_range_incomplete",
                f"风险日期 {record['date']} 早于可用上证指数历史范围",
            )
        market_date = market_dates[position]
        points.append({
            "risk_date": record["date"],
            "market_date": market_date,
            "close": close_by_date[market_date],
            "count": record["count"],
            "reason": record["reason"],
        })
    warnings = list(excel_warnings)
    if market.get("warning"):
        warnings.append(f"实时行情获取失败，当前使用缓存：{market['warning']}")
    return {
        "status": {
            "market_source": market["source"],
            "provider": market["provider"],
            "updated_at": market["updated_at"],
            "as_of": market_dates[-1],
            "warnings": warnings,
        },
        "range": {"start": risk_records[0]["date"], "end": risk_records[-1]["date"]},
        "index_series": market_rows,
        "risk_points": points,
    }
```

- [ ] **Step 4：运行对齐测试**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_dashboard_data.py -v`

Expected: `2 passed`。

- [ ] **Step 5：提交聚合模块**

```powershell
git add tools/bbxm-risk-dashboard/bbxm_dashboard/dashboard_data.py tools/bbxm-risk-dashboard/tests/test_dashboard_data.py
git commit -m "feat: align bbxm risks to trading days"
```

## Task 5：接通 Flask 数据接口和中文错误响应

**Files:**
- Modify: `tools/bbxm-risk-dashboard/bbxm_dashboard/__init__.py`
- Modify: `tools/bbxm-risk-dashboard/tests/test_app.py`
- Create: `tools/bbxm-risk-dashboard/tests/conftest.py`

- [ ] **Step 1：写成功响应和 Excel 缺失响应测试**

```python
# tests/test_app.py 中追加
def test_api_returns_aggregated_dashboard_payload(tmp_path, monkeypatch):
    from bbxm_dashboard import create_app
    from openpyxl import Workbook

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["日期", "当日累计风险提示次数", "风险原因"])
    sheet.append(["2026-07-10", 1, "测试风险"])
    workbook.save(tmp_path / "冰冰小美风险提示.xlsx")

    monkeypatch.setattr("bbxm_dashboard.get_index_series", lambda path: {
        "source": "live",
        "provider": "test",
        "updated_at": "2026-07-10T16:00:00+08:00",
        "warning": None,
        "rows": [{"date": "2026-07-10", "close": 3510.25}],
    })
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})

    response = app.test_client().get("/api/dashboard")

    assert response.status_code == 200
    assert response.get_json()["risk_points"][0]["reason"] == "测试风险"


def test_api_returns_structured_error_when_excel_is_missing(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    response = app.test_client().get("/api/dashboard")

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "excel_missing"
```

- [ ] **Step 2：运行接口测试并确认 404 或未处理异常**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_app.py -v`

Expected: 至少一个 FAIL，成功接口当前返回 `404`。

- [ ] **Step 3：注册数据路由和统一错误处理**

```python
# bbxm_dashboard/__init__.py 完整替换
from pathlib import Path

from flask import Flask, jsonify

from .dashboard_data import build_dashboard_payload
from .errors import DashboardDataError
from .excel_data import load_risk_records
from .market_data import get_index_series


def create_app(test_config: dict | None = None) -> Flask:
    package_dir = Path(__file__).resolve().parent
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.from_mapping(DATA_DIR=package_dir.parent / "data")
    if test_config:
        app.config.update(test_config)

    @app.get("/")
    def index():
        return app.send_static_file("index.html")

    @app.get("/api/dashboard")
    def dashboard():
        data_dir = Path(app.config["DATA_DIR"])
        risk_records, warnings = load_risk_records(data_dir / "冰冰小美风险提示.xlsx")
        market = get_index_series(data_dir / "shanghai-index-cache.json")
        return jsonify(build_dashboard_payload(risk_records, warnings, market))

    @app.errorhandler(DashboardDataError)
    def handle_dashboard_error(error):
        status = 503 if error.code == "market_unavailable" else 422
        return jsonify({"error": {"code": error.code, "message": error.message, "details": error.details}}), status

    return app
```

- [ ] **Step 4：运行所有后端测试**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests -v`

Expected: 所有测试通过。

- [ ] **Step 5：提交 API 接线**

```powershell
git add tools/bbxm-risk-dashboard/bbxm_dashboard/__init__.py tools/bbxm-risk-dashboard/tests
git commit -m "feat: expose bbxm dashboard data api"
```

## Task 6：实现参考图风格界面和图表交互

**Files:**
- Replace: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/index.html`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/styles.css`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/app.js`
- Create: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/vendor/echarts.min.js`
- Modify: `tools/bbxm-risk-dashboard/tests/test_app.py`

- [ ] **Step 1：扩展静态页面契约测试**

```python
# tests/test_app.py 中追加
def test_root_contains_chart_empty_sidebar_and_local_assets(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    html = app.test_client().get("/").get_data(as_text=True)

    assert 'id="index-chart"' in html
    assert 'id="reserved-sidebar"' in html
    assert 'aria-label="预留区域"' in html
    assert '/static/vendor/echarts.min.js' in html
    assert 'src="https://' not in html
```

- [ ] **Step 2：运行契约测试并确认失败**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests/test_app.py::test_root_contains_chart_empty_sidebar_and_local_assets -v`

Expected: FAIL，缺少 `index-chart`。

- [ ] **Step 3：生成设计系统建议并记录采用项**

Run: `python D:\Users\lenovo\.codex\skills\ui-ux-pro-max\scripts\search.py "financial risk time-series dashboard black high-contrast dense" --design-system -p "BBXM Risk Dashboard"`

Expected: 输出一套设计建议。只采用高对比度、图表优先、克制网格、明确焦点和响应式建议；不采用渐变、玻璃拟态、卡片堆叠或彩色右栏。

- [ ] **Step 4：下载并本地保存官方 ECharts 发行文件**

Run:

```powershell
$target = 'tools/bbxm-risk-dashboard/bbxm_dashboard/static/vendor/echarts.min.js'
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/apache/echarts/6.0.0/dist/echarts.min.js' -OutFile $target
Get-Item $target | Select-Object Name,Length
```

Expected: 文件存在且长度大于 `500000` 字节；来源固定为 Apache ECharts 6.0.0 官方仓库，`index.html` 不引用远程脚本。

- [ ] **Step 5：写完整语义页面**

```html
<!-- bbxm_dashboard/static/index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>冰冰小美风险提示记录</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <main class="dashboard-shell">
    <section class="chart-panel" aria-labelledby="page-title">
      <header class="chart-heading">
        <h1 id="page-title">【冰冰小美】风险提示记录</h1>
        <p>风险记录：固定 Excel · 基准曲线：上证指数实际收盘点位</p>
      </header>
      <div id="status" class="status" role="status" aria-live="polite">正在读取数据…</div>
      <div id="error-panel" class="error-panel" role="alert" hidden>
        <p id="error-message"></p>
        <button id="retry-button" type="button">重新加载</button>
      </div>
      <div id="index-chart" class="chart" role="img" aria-label="上证指数收盘曲线及冰冰小美风险提示节点"></div>
      <div id="risk-point-list" class="visually-hidden" aria-label="风险提示节点键盘导航"></div>
      <footer class="legend" aria-hidden="true">
        <span><i class="legend-line"></i>上证指数</span>
        <span><i class="legend-dot"></i>风险提示</span>
      </footer>
    </section>
    <aside id="reserved-sidebar" class="reserved-sidebar" aria-label="预留区域"></aside>
  </main>
  <script src="/static/vendor/echarts.min.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 6：写黑底白框响应式样式**

`styles.css` 必须定义以下不可变视觉令牌和布局规则：

```css
:root {
  color-scheme: dark;
  --page: #020303;
  --panel: #050606;
  --border: #e6e8eb;
  --text: #f4f6f8;
  --muted: #87909c;
  --grid: #343a40;
  --line: #8792a3;
  --risk: #ff2028;
  --focus: #ffd166;
}
* { box-sizing: border-box; }
html, body { min-height: 100%; }
body { margin: 0; background: var(--page); color: var(--text); font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
.dashboard-shell { min-height: 100vh; padding: 20px; display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: 12px; }
.chart-panel, .reserved-sidebar { border: 1px solid var(--border); background: var(--panel); }
.chart-panel { min-width: 0; padding: 18px 22px 12px; display: flex; flex-direction: column; }
.chart-heading { text-align: center; }
.chart-heading h1 { margin: 0; font-size: clamp(17px, 1.7vw, 24px); font-weight: 700; }
.chart-heading p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
.status { min-height: 22px; margin-top: 8px; color: var(--muted); font-size: 12px; }
.error-panel { margin: 12px 0; padding: 12px; border: 1px solid var(--risk); }
.error-panel button { min-height: 44px; padding: 0 16px; color: var(--text); background: transparent; border: 1px solid var(--border); cursor: pointer; }
.error-panel button:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.chart { width: 100%; min-height: 520px; flex: 1; }
.legend { display: flex; justify-content: center; gap: 24px; color: var(--text); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.legend-line { width: 28px; border-top: 2px solid var(--line); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--risk); }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .dashboard-shell { padding: 8px; grid-template-columns: minmax(0, 1fr); }
  .reserved-sidebar { display: none; }
  .chart-panel { padding: 14px 10px 10px; }
  .chart { min-height: 460px; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; } }
```

- [ ] **Step 7：实现请求、折线、风险散点、缩放、提示和键盘入口**

写入以下完整 `app.js`；折线数据使用 `[date, close]`，风险数据使用 `[market_date, close, count, risk_date, reason]`：

```javascript
const chart = echarts.init(document.getElementById('index-chart'), null, { renderer: 'canvas' });
const statusNode = document.getElementById('status');
const errorPanel = document.getElementById('error-panel');
const errorMessage = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');
const accessibleList = document.getElementById('risk-point-list');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function riskSize(value) {
  return Math.max(10, Math.min(28, 8 + Math.sqrt(value[2]) * 5));
}

function chartOption(payload) {
  const visibleRange = { startValue: payload.range.start, endValue: payload.range.end };
  return {
    backgroundColor: 'transparent',
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    grid: { left: 66, right: 30, top: 28, bottom: 76 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#090b0d',
      borderColor: '#e6e8eb',
      textStyle: { color: '#f4f6f8' },
      formatter(params) {
        if (params.seriesName === '风险提示') {
          const value = params.value;
          const reason = escapeHtml(value[4] || '未填写').replaceAll('\n', '<br>');
          return `风险日期：${escapeHtml(value[3])}<br>当日累计次数：${escapeHtml(value[2])}<br>风险原因：${reason}<br>对齐行情日：${escapeHtml(value[0])}<br>上证收盘：${escapeHtml(value[1])}`;
        }
        return `${escapeHtml(params.value[0])}<br>上证收盘：${escapeHtml(params.value[1])}`;
      },
    },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#87909c' } }, axisLabel: { color: '#c6cbd2' }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, name: '收盘点位', nameTextStyle: { color: '#87909c' }, axisLabel: { color: '#c6cbd2' }, splitLine: { lineStyle: { color: '#343a40', type: 'dashed' } } },
    dataZoom: [
      { type: 'inside', filterMode: 'none', ...visibleRange },
      { type: 'slider', bottom: 20, height: 18, borderColor: '#87909c', textStyle: { color: '#c6cbd2' }, ...visibleRange },
    ],
    series: [
      { name: '上证指数', type: 'line', showSymbol: false, sampling: 'lttb', data: payload.index_series.map(row => [row.date, row.close]), lineStyle: { width: 1.2, color: '#8792a3' }, itemStyle: { color: '#8792a3' } },
      { name: '风险提示', type: 'scatter', z: 5, data: payload.risk_points.map(point => [point.market_date, point.close, point.count, point.risk_date, point.reason]), symbolSize: riskSize, itemStyle: { color: '#ff2028', borderColor: '#ffd4d6', borderWidth: 1 } },
    ],
  };
}

function buildAccessibleRiskList(points) {
  accessibleList.replaceChildren();
  points.forEach((point, dataIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${point.risk_date}，累计 ${point.count} 次，${point.reason || '未填写原因'}`;
    button.addEventListener('focus', () => {
      chart.dispatchAction({ type: 'showTip', seriesIndex: 1, dataIndex });
    });
    button.addEventListener('blur', () => {
      chart.dispatchAction({ type: 'hideTip' });
    });
    accessibleList.appendChild(button);
  });
}

function showError(error) {
  const details = Array.isArray(error.details)
    ? error.details.map(item => {
        if (item.row && item.column) {
          return `第 ${item.row} 行 / ${item.column}：${String(item.value ?? '')}`;
        }
        if (Array.isArray(item.errors)) {
          return item.errors.join('；');
        }
        return JSON.stringify(item);
      })
    : [];
  errorMessage.textContent = [error.message || '数据加载失败', ...details].join('\n');
  errorPanel.hidden = false;
  chart.clear();
  statusNode.textContent = '';
}

async function loadDashboard() {
  errorPanel.hidden = true;
  statusNode.textContent = '正在读取 Excel 并更新上证指数…';
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) {
      throw payload.error || { message: `请求失败：HTTP ${response.status}`, details: [] };
    }
    chart.setOption(chartOption(payload), true);
    buildAccessibleRiskList(payload.risk_points);
    const sourceLabel = payload.status.market_source === 'live' ? '实时数据' : '缓存数据';
    const warningText = payload.status.warnings.length ? ` · ${payload.status.warnings.join('；')}` : '';
    statusNode.textContent = `${sourceLabel} · 行情截至 ${payload.status.as_of} · 更新于 ${payload.status.updated_at}${warningText}`;
  } catch (error) {
    showError(error);
  }
}

retryButton.addEventListener('click', loadDashboard);
window.addEventListener('resize', () => chart.resize());
loadDashboard();
```

- [ ] **Step 8：运行测试和静态资源检查**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests -v; rg -n "https://|http://" bbxm_dashboard/static`

Expected: 测试全部通过；第二条命令无远程脚本或样式引用。

- [ ] **Step 9：提交界面**

```powershell
git add tools/bbxm-risk-dashboard/bbxm_dashboard/static tools/bbxm-risk-dashboard/tests/test_app.py
git commit -m "feat: render bbxm risk dashboard"
```

## Task 7：生成 Excel 模板、文档并完成端到端验收

**Files:**
- Create: `tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx`
- Create: `tools/bbxm-risk-dashboard/README.md`

- [ ] **Step 1：生成固定 Excel 模板**

在项目虚拟环境中运行以下一次性脚本，生成含表头和一行明确示例的工作簿；示例原因必须标注“示例”，避免被误认成真实历史记录：

```python
from pathlib import Path
from openpyxl import Workbook

path = Path("tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx")
path.parent.mkdir(parents=True, exist_ok=True)
workbook = Workbook()
sheet = workbook.active
sheet.title = "风险提示"
sheet.append(["日期", "当日累计风险提示次数", "风险原因"])
sheet.append(["2026-07-01", 1, "示例数据：请替换为真实风险原因"])
sheet.freeze_panes = "A2"
sheet.column_dimensions["A"].width = 14
sheet.column_dimensions["B"].width = 24
sheet.column_dimensions["C"].width = 56
workbook.save(path)
```

- [ ] **Step 2：写 README**

README 必须给出以下精确流程：

```powershell
cd E:\caojingwen\obsidian\llmwiki\tools\bbxm-risk-dashboard
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python run.py
```

并说明浏览器打开 `http://127.0.0.1:5179`，Excel 固定路径、三列契约、重复日期合并规则、非交易日向前对齐规则、缓存文件位置、断网状态含义和常见错误处理。README 必须明确示例行应替换为真实记录。

- [ ] **Step 3：运行完整自动验证**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests -v; python -m compileall bbxm_dashboard run.py`

Expected: 所有测试 PASS；编译命令无错误。

- [ ] **Step 4：启动服务并检查真实 API**

Run: `cd tools/bbxm-risk-dashboard; python run.py`

另一个终端运行：`Invoke-RestMethod http://127.0.0.1:5179/api/dashboard | ConvertTo-Json -Depth 6`

Expected: 返回 `status`、`range`、`index_series`、`risk_points`；`status.as_of` 为接口当前可得的最近交易日；风险点包含示例行的日期、次数、原因、对齐行情日和收盘点位。

- [ ] **Step 5：用应用内浏览器做视觉与交互验收**

使用 `browser:control-in-app-browser` 打开 `http://127.0.0.1:5179`，验证：

1. 1440×900 下主图为黑底白框，右侧窄栏存在且完全空白。
2. 灰色曲线纵轴为实际点位，不是百分比。
3. 红色风险点可悬浮并显示完整五项信息。
4. 时间缩放和拖动可用。
5. 760px 以下右侧空栏隐藏，主图不横向溢出。
6. 模拟行情提供方失败后，缓存状态和更新时间明确可见。
7. 页面无控制台错误，并保存一张验收截图到 `tools/bbxm-risk-dashboard/docs/dashboard-preview.png`。

- [ ] **Step 6：检查中文和任务边界**

Run: `rg -n "鍐|鐭|鎯|灏|�" tools/bbxm-risk-dashboard; git status --short`

Expected: 中文乱码扫描无命中；Git 状态中本任务文件与原有用户改动边界清楚。

- [ ] **Step 7：提交模板和文档**

```powershell
git add tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx tools/bbxm-risk-dashboard/README.md tools/bbxm-risk-dashboard/docs/dashboard-preview.png
git commit -m "docs: add bbxm dashboard template and guide"
```

## Task 8：最终复核

**Files:**
- Verify only: `tools/bbxm-risk-dashboard/`

- [ ] **Step 1：对照设计说明逐项检查**

Run: `git diff HEAD~7 --stat; git log -7 --oneline`

Expected: 变更只涉及 `tools/bbxm-risk-dashboard/`；提交分别对应骨架、Excel、行情、对齐、API、界面、文档。

- [ ] **Step 2：运行最终测试**

Run: `cd tools/bbxm-risk-dashboard; python -m pytest tests -v`

Expected: 全部通过，无跳过、无警告升级为错误。

- [ ] **Step 3：确认数据诚实性**

人工断网后刷新页面：若已有缓存，页面必须显示“缓存数据”和最后更新时间；删除缓存再刷新时，页面必须显示“上证指数获取失败且没有本地缓存”，不得画空曲线或把旧值标成最新。

- [ ] **Step 4：确认右侧区域为空**

检查 DOM：`#reserved-sidebar` 内没有子元素或文本；桌面显示边框，窄屏隐藏。

- [ ] **Step 5：准备交付说明**

最终回复列出工具路径、启动命令、Excel 路径、测试结果、行情截至日期、缓存状态和仍需用户替换的示例数据；不把工具输出描述为投资建议。

## 参考文档

- AKShare 指数数据：`https://akshare.akfamily.xyz/data/index/index.html`
- Flask Quickstart：`https://flask.palletsprojects.com/en/stable/quickstart/`
- Apache ECharts 折线图：`https://echarts.apache.org/handbook/en/how-to/chart-types/line/basic-line/`
- Apache ECharts 散点大小：`https://echarts.apache.org/handbook/en/how-to/chart-types/scatter/basic-scatter/`
