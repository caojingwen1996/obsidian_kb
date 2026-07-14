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
