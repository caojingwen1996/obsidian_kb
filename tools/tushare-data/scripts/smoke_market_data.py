"""Opt-in account smoke check; only metadata is printed or persisted."""

import argparse
import json
from pathlib import Path

from tushare_client import TushareClient, TushareClientError
from tushare_market_data import MarketData


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    parser.add_argument("--env-file", action="append", default=[])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    service = MarketData(TushareClient(extra_env_paths=args.env_file, retries=0))
    cases = [
        ("get_fund_daily", {"ts_code": "159941.SZ", "adjustment": "qfq"}),
        ("get_fund_daily", {"ts_code": "515450.SH", "adjustment": "qfq"}),
        ("get_fund_adjustments", {"ts_code": "159941.SZ"}),
        *[("get_index_daily", {"ts_code": code}) for code in ["000922.CSI", "000001.SH", "000300.SH", "000985.CSI"]],
        ("get_index_valuation", {"ts_code": "000300.SH"}),
        ("get_global_index_daily", {"ts_code": "SPX"}),
        ("get_shibor", {}), ("get_market_turnover", {}), ("get_market_margin_history", {}),
        ("get_us_treasury_curve", {}), ("get_fx_daily", {"ts_code": "USDJPY.FXCM"}),
    ]
    records = []
    for name, params in cases:
        record = {"tool": name, "parameters": params, "start_date": args.start_date, "end_date": args.end_date}
        try:
            result = service.query(name, start_date=args.start_date, end_date=args.end_date, use_cache=False, **params)
            record.update({k: result[k] for k in ("status", "row_count", "observed_start", "observed_end")})
        except TushareClientError as error:
            record.update(status="error", source=error.source)
        records.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    return 0 if all(r["status"] == "ok" and r["row_count"] for r in records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
