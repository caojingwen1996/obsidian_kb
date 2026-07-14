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

    assert payload["risk_points"] == [
        {
            "risk_date": "2026-07-11",
            "market_date": "2026-07-10",
            "close": 3510.25,
            "count": 2,
            "reason": "周末风险",
        }
    ]
    assert payload["status"]["warnings"] == ["重复记录已合并"]


def test_build_dashboard_payload_rejects_risk_before_market_history():
    with pytest.raises(DashboardDataError) as exc_info:
        build_dashboard_payload(
            [{"date": "1990-01-01", "count": 1, "reason": "过早"}],
            [],
            MARKET,
        )

    assert exc_info.value.code == "market_range_incomplete"
