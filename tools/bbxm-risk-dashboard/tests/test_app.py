from bbxm_dashboard import create_app


def test_root_serves_dashboard_shell(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    response = app.test_client().get("/")

    assert response.status_code == 200
    assert "冰冰小美风险提示记录" in response.get_data(as_text=True)


def test_api_returns_aggregated_dashboard_payload(tmp_path, monkeypatch):
    from openpyxl import Workbook

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["日期", "当日累计风险提示次数", "风险原因"])
    sheet.append(["2026-07-10", 1, "测试风险"])
    workbook.save(tmp_path / "冰冰小美风险提示.xlsx")

    monkeypatch.setattr(
        "bbxm_dashboard.get_index_series",
        lambda path: {
            "source": "live",
            "provider": "test",
            "updated_at": "2026-07-10T16:00:00+08:00",
            "warning": None,
            "rows": [{"date": "2026-07-10", "close": 3510.25}],
        },
    )
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})

    response = app.test_client().get("/api/dashboard")

    assert response.status_code == 200
    assert response.get_json()["risk_points"][0]["reason"] == "测试风险"


def test_api_returns_structured_error_when_excel_is_missing(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    response = app.test_client().get("/api/dashboard")

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "excel_missing"


def test_root_contains_chart_empty_sidebar_and_local_assets(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    html = app.test_client().get("/").get_data(as_text=True)

    assert 'id="index-chart"' in html
    assert 'id="reserved-sidebar"' in html
    assert 'aria-label="预留区域"' in html
    assert "/static/vendor/echarts.min.js" in html
    assert 'src="https://' not in html


def test_chart_zoom_scales_y_axis_to_visible_period(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    javascript = app.test_client().get("/static/app.js").get_data(as_text=True)

    assert "filterMode: 'filter'" in javascript
    assert "filterMode: 'none'" not in javascript
    assert "endValue: payload.status.as_of" in javascript
    assert "renderer: 'svg'" in javascript


def test_root_contains_risk_detail_table(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    html = app.test_client().get("/").get_data(as_text=True)

    assert 'class="risk-detail-panel"' in html
    assert '<caption>风险提示明细</caption>' in html
    assert 'id="risk-table-body"' in html
    assert '<th scope="col">日期</th>' in html
    assert '<th scope="col">当日累计风险提示次数</th>' in html
    assert '<th scope="col">风险原因</th>' in html


def test_risk_table_script_sorts_renders_and_clears_rows(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    javascript = app.test_client().get("/static/app.js").get_data(as_text=True)

    assert "function renderRiskTable(points)" in javascript
    assert "[...points].sort" in javascript
    assert "right.risk_date.localeCompare(left.risk_date)" in javascript
    assert "riskTableBody.replaceChildren()" in javascript
    assert "cell.textContent" in javascript
    assert "point.reason || '未填写原因'" in javascript
    assert "renderRiskTable(payload.risk_points)" in javascript
    assert "renderRiskTable([])" in javascript


def test_risk_table_styles_preserve_dark_responsive_layout(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    css = app.test_client().get("/static/styles.css").get_data(as_text=True)

    assert ".risk-detail-panel" in css
    assert ".risk-table-scroll" in css
    assert "overflow-x: auto" in css
    assert ".risk-count" in css
    assert "font-variant-numeric: tabular-nums" in css
    assert "white-space: pre-wrap" in css
