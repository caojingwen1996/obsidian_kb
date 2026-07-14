from bbxm_dashboard import create_app


def test_root_serves_dashboard_shell(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    response = app.test_client().get("/")

    assert response.status_code == 200
    assert "冰冰小美风险提示记录" in response.get_data(as_text=True)
