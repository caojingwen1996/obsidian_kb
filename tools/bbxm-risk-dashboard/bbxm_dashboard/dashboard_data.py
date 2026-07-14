from bisect import bisect_right

from .errors import DashboardDataError


def build_dashboard_payload(
    risk_records: list[dict],
    excel_warnings: list[str],
    market: dict,
) -> dict:
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
        points.append(
            {
                "risk_date": record["date"],
                "market_date": market_date,
                "close": close_by_date[market_date],
                "count": record["count"],
                "reason": record["reason"],
            }
        )

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
        "range": {
            "start": risk_records[0]["date"],
            "end": risk_records[-1]["date"],
        },
        "index_series": market_rows,
        "risk_points": points,
    }
