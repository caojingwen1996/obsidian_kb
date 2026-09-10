"""Collect dated Tushare inputs for the 2026-09-10 神马电力 revaluation."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tools/tushare-data/scripts"))

from tushare_client import TushareClient  # noqa: E402


def rows(client: TushareClient, dataset: str, **params):
    return client.call_frame(dataset, use_cache=False, **params)


def clean(value):
    if hasattr(value, "item"):
        return value.item()
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean(item) for item in value]
    return value


def main() -> None:
    client = TushareClient()
    start = "2026-08-01"
    end = "2026-09-09"
    snapshot = {
        "security": {"ts_code": "603530.SH", "name": "神马电力", "currency": "CNY"},
        "retrieved_at": "2026-09-10 08:32:51 Asia/Shanghai",
        "market_data_through": "2026-09-09",
        "daily": rows(client, "daily", ts_code="603530.SH", start_date=start, end_date=end),
        "daily_basic": rows(client, "daily_basic", ts_code="603530.SH", start_date=start, end_date=end),
        "moneyflow": rows(client, "moneyflow", ts_code="603530.SH", start_date=start, end_date=end),
        "margin_detail": rows(client, "margin_detail", ts_code="603530.SH", start_date=start, end_date=end),
        "holder_number": rows(client, "stk_holdernumber", ts_code="603530.SH", start_date="2025-01-01", end_date="2026-09-09"),
        "income": rows(client, "income", ts_code="603530.SH", start_date="2022-01-01", end_date="2026-09-09"),
        "balance_sheet": rows(client, "balancesheet", ts_code="603530.SH", start_date="2022-01-01", end_date="2026-09-09"),
        "cash_flow": rows(client, "cashflow", ts_code="603530.SH", start_date="2022-01-01", end_date="2026-09-09"),
    }
    output = Path(__file__).with_name("valuation-inputs.json")
    output.write_text(json.dumps(clean(snapshot), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
