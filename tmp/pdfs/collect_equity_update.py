from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "tushare-data" / "scripts"))

from tushare_client import TushareClient  # noqa: E402


SYMBOLS = ("000528.SZ", "002050.SZ")
START = "2025-08-26"
END = "2026-08-26"
MONEY_START = "2026-05-27"


def rows(client: TushareClient, method: str, **params):
    try:
        return {
            "status": "已获取",
            "rows": client.call_frame(method, use_cache=False, **params),
        }
    except Exception as error:  # preserve source failures as data gaps
        return {
            "status": "未获取到",
            "error": f"{type(error).__name__}: {error}",
            "rows": [],
        }


def main() -> None:
    client = TushareClient()
    result = {}
    for symbol in SYMBOLS:
        result[symbol] = {
            "daily": rows(client, "daily", ts_code=symbol, start_date=START, end_date=END),
            "valuation": rows(client, "daily_basic", ts_code=symbol, start_date=START, end_date=END),
            "moneyflow": rows(client, "moneyflow", ts_code=symbol, start_date=MONEY_START, end_date=END),
            "margin": rows(client, "margin_detail", ts_code=symbol, start_date=MONEY_START, end_date=END),
            "income_h1": rows(
                client,
                "income",
                ts_code=symbol,
                period="20260630",
                fields=(
                    "ts_code,ann_date,f_ann_date,end_date,report_type,basic_eps,diluted_eps,total_revenue,"
                    "revenue,operate_profit,total_profit,n_income,n_income_attr_p,minority_gain,ebit,ebitda"
                ),
            ),
            "balance_h1": rows(
                client,
                "balancesheet",
                ts_code=symbol,
                period="20260630",
                fields=(
                    "ts_code,ann_date,f_ann_date,end_date,report_type,total_assets,total_liab,total_hldr_eqy_exc_min_int,"
                    "money_cap,accounts_receiv,inventories,fix_assets,total_cur_assets,total_cur_liab,st_borr,lt_borr"
                ),
            ),
            "cashflow_h1": rows(
                client,
                "cashflow",
                ts_code=symbol,
                period="20260630",
                fields=(
                    "ts_code,ann_date,f_ann_date,end_date,report_type,n_cashflow_act,n_cashflow_inv_act,n_cash_flows_fnc_act,"
                    "c_pay_acq_const_fiolta,c_cash_equ_end_period"
                ),
            ),
            "dividend": rows(
                client,
                "dividend",
                ts_code=symbol,
                fields="ts_code,end_date,ann_date,div_proc,stk_div,cash_div_tax,record_date,ex_date,pay_date",
            ),
        }
    out = ROOT / "tools" / "a-share-market-dashboard" / "data" / "equity-update-2026-08-27.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
