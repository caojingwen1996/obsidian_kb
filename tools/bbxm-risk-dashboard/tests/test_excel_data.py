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
    write_book(
        path,
        [
            [datetime(2026, 7, 10), 1, "流动性收紧"],
            ["2026-07-10", 2, "外部冲突升级"],
            [date(2026, 7, 11), 1, "高位拥挤"],
        ],
    )

    records, warnings = load_risk_records(path)

    assert records == [
        {
            "date": "2026-07-10",
            "count": 3,
            "reason": "流动性收紧\n外部冲突升级",
        },
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
