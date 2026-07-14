import json

import pandas as pd
import pytest

from bbxm_dashboard.errors import DashboardDataError
from bbxm_dashboard.market_data import get_index_series


def test_get_index_series_writes_live_cache(tmp_path):
    frame = pd.DataFrame(
        {"date": ["2026-07-09", "2026-07-10"], "close": [3509.68, 3510.25]}
    )
    result = get_index_series(
        tmp_path / "cache.json",
        providers=[("sina", lambda: frame)],
    )

    assert result["source"] == "live"
    assert result["provider"] == "sina"
    assert result["rows"][-1] == {"date": "2026-07-10", "close": 3510.25}
    assert (
        json.loads((tmp_path / "cache.json").read_text(encoding="utf-8"))["symbol"]
        == "sh000001"
    )


def test_get_index_series_falls_back_to_cache(tmp_path):
    cache = tmp_path / "cache.json"
    cache.write_text(
        json.dumps(
            {
                "symbol": "sh000001",
                "updated_at": "2026-07-10T16:00:00+08:00",
                "provider": "sina",
                "rows": [{"date": "2026-07-10", "close": 3510.25}],
            }
        ),
        encoding="utf-8",
    )

    def offline():
        raise RuntimeError("offline")

    result = get_index_series(cache, providers=[("broken", offline)])

    assert result["source"] == "cache"
    assert result["updated_at"] == "2026-07-10T16:00:00+08:00"
    assert "broken: offline" in result["warning"]


def test_get_index_series_raises_without_live_data_or_cache(tmp_path):
    def offline():
        raise RuntimeError("offline")

    with pytest.raises(DashboardDataError) as exc_info:
        get_index_series(
            tmp_path / "missing.json",
            providers=[("broken", offline)],
        )

    assert exc_info.value.code == "market_unavailable"
