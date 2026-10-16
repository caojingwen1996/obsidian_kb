import json
from pathlib import Path
from xml.sax.saxutils import escape
import zipfile

from scripts.dividend_recalculation import column_name


def seed_dividend_vault(root):
    root = Path(root)
    dashboard = root / "tools/dashboard/page.html"
    dashboard.parent.mkdir(parents=True, exist_ok=True)
    dashboard.write_text("<html></html>", encoding="utf-8")
    directory = root / "sources/automations/中证红利信号"
    directory.mkdir(parents=True, exist_ok=True)
    headers = ["run_date__record_date", "index_date__index_valuation_date", "akshare_dividend_yield_2", "ytd_return", "ytd_max_drawdown", "intraday_change_percent", "bond_date__china_10y_yield_date", "bond_10y_yield", "spread", "percentile_signal", "absolute_signal", "spread_signal", "headline_signal", "lixinger_date__percentile_source_date", "lixinger_dividend_yield", "lixinger_percentile_10y", "lixinger_percentile_80_value", "lixinger_source", "strategy_version", "composite_score", "composite_grade", "score_lower", "score_upper", "percentile_score", "absolute_score", "ratio_score", "percentile_contribution", "absolute_contribution", "ratio_contribution", "score_quality", "confirmation_status"]
    values = [["2026-01-05", "2026-01-05", 5, 1, -2, 0, "2026-01-05", 1, 4, "old", "old", "old", "D", "2026-01-05", 5, 90, 5, "中证官方指数推算"] + ["old"] * 13,
              ["2026-01-06", "2026-01-06", 4, 2, -2, 0, "2026-01-06", 2, 2, "old", "old", "old", "D", "2026-01-06", 4, 10, 5, "理杏仁公开页面"] + ["old"] * 13]
    rows = []
    for row_number, row in [(1, headers), (2, ["中文表头"]), (3, values[0]), (5, values[1])]:
        cells = []
        for column, value in enumerate(row, 1):
            address = column_name(column) + str(row_number)
            cells.append(f'<c r="{address}" t="inlineStr"><is><t>{escape(value)}</t></is></c>' if isinstance(value, str) else f'<c r="{address}"><v>{value}</v></c>')
        rows.append(f'<row r="{row_number}">' + "".join(cells) + "</row>")
    xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" state="frozen"/></sheetView></sheetViews><sheetData>' + "".join(rows) + '</sheetData><autoFilter ref="A1:AE5"/></worksheet>'
    with zipfile.ZipFile(directory / "中证红利每日信号.xlsx", "w") as workbook:
        workbook.writestr("xl/worksheets/sheet1.xml", xml)
        workbook.writestr("native-preserved.bin", b"native content")
    (directory / "中证红利指数日线.json").write_text(json.dumps({"data": [{"tradeDate": day, "close": close} for day, close in [("20260105", 100), ("20260106", 101), ("20260107", 102)]]}), encoding="utf-8")
    (directory / "评分记录.json").write_text('{"records": []}', encoding="utf-8")
    (directory / "最新信号.md").write_text("原始信号", encoding="utf-8")
    return dashboard, directory
