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
