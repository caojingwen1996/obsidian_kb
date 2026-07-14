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
        risk_records, warnings = load_risk_records(
            data_dir / "冰冰小美风险提示.xlsx"
        )
        market = get_index_series(data_dir / "shanghai-index-cache.json")
        return jsonify(build_dashboard_payload(risk_records, warnings, market))

    @app.errorhandler(DashboardDataError)
    def handle_dashboard_error(error):
        status = 503 if error.code == "market_unavailable" else 422
        return (
            jsonify(
                {
                    "error": {
                        "code": error.code,
                        "message": error.message,
                        "details": error.details,
                    }
                }
            ),
            status,
        )

    return app
