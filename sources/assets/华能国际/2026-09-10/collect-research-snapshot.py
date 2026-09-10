"""Collect dated market, financial, ownership and trading inputs for 华能国际."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tools/tushare-data/scripts"))

from tushare_client import TushareClient  # noqa: E402


def clean(value):
    if hasattr(value, "item"):
        return value.item()
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean(item) for item in value]
    return value


def raw_rows(pro, dataset: str, **params):
    frame = getattr(pro, dataset)(**params)
    frame = frame.where(frame.notna(), None)
    return clean(frame.to_dict(orient="records"))


def safe(snapshot: dict, key: str, loader) -> None:
    try:
        snapshot[key] = {"status": "ok", "rows": loader()}
    except Exception as error:  # Evidence gaps must be preserved in the snapshot.
        snapshot[key] = {
            "status": "error",
            "error_type": type(error).__name__,
            "message": str(error),
        }


def main() -> None:
    client = TushareClient()
    pro = client.pro()
    code = "600011.SH"
    market_start = "20260701"
    market_end = "20260909"
    financial_start = "20220101"
    financial_end = "20260909"
    snapshot = {
        "security": {"ts_code": code, "name": "华能国际", "currency": "CNY"},
        "retrieved_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds"),
        "market_data_through": "2026-09-09",
    }

    safe(snapshot, "stock_basic", lambda: raw_rows(pro, "stock_basic", ts_code=code))
    safe(snapshot, "daily", lambda: raw_rows(pro, "daily", ts_code=code, start_date=market_start, end_date=market_end))
    safe(snapshot, "daily_basic", lambda: raw_rows(pro, "daily_basic", ts_code=code, start_date=market_start, end_date=market_end))
    safe(snapshot, "moneyflow", lambda: raw_rows(pro, "moneyflow", ts_code=code, start_date=market_start, end_date=market_end))
    safe(snapshot, "margin_detail", lambda: raw_rows(pro, "margin_detail", ts_code=code, start_date=market_start, end_date=market_end))
    safe(snapshot, "holder_number", lambda: raw_rows(pro, "stk_holdernumber", ts_code=code, start_date=financial_start, end_date=financial_end))
    safe(snapshot, "top10_holders", lambda: raw_rows(pro, "top10_holders", ts_code=code, start_date=financial_start, end_date=financial_end))
    safe(snapshot, "top10_floatholders", lambda: raw_rows(pro, "top10_floatholders", ts_code=code, start_date=financial_start, end_date=financial_end))
    safe(snapshot, "income", lambda: raw_rows(
        pro,
        "income",
        ts_code=code,
        start_date=financial_start,
        end_date=financial_end,
        fields=(
            "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,basic_eps,diluted_eps,"
            "total_revenue,revenue,total_cogs,oper_cost,sell_exp,admin_exp,fin_exp,rd_exp,"
            "operate_profit,total_profit,income_tax,n_income,n_income_attr_p,minority_gain"
        ),
    ))
    safe(snapshot, "balance_sheet", lambda: raw_rows(
        pro,
        "balancesheet",
        ts_code=code,
        start_date=financial_start,
        end_date=financial_end,
        fields=(
            "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,total_share,money_cap,"
            "trad_asset,accounts_receiv,oth_receiv,inventories,fix_assets,cip,intan_assets,goodwill,"
            "st_borr,lt_borr,bond_payable,lease_liab,non_cur_liab_due_1y,total_assets,total_liab,"
            "total_hldr_eqy_exc_min_int,minority_int,total_hldr_eqy_inc_min_int,oth_eqt_tools,oth_eqt_tools_p_shr"
        ),
    ))
    safe(snapshot, "cash_flow", lambda: raw_rows(
        pro,
        "cashflow",
        ts_code=code,
        start_date=financial_start,
        end_date=financial_end,
        fields=(
            "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,n_cashflow_act,"
            "c_pay_acq_const_fiolta,n_cashflow_inv_act,n_cash_flows_fnc_act,c_pay_dist_dpcp_int_exp"
        ),
    ))
    safe(snapshot, "fina_indicator", lambda: raw_rows(
        pro,
        "fina_indicator",
        ts_code=code,
        start_date=financial_start,
        end_date=financial_end,
        fields=(
            "ts_code,ann_date,end_date,eps,dt_eps,roe,roe_waa,roa,grossprofit_margin,"
            "netprofit_margin,debt_to_assets,ocfps,fcff,fcfe,netdebt,debt_to_eqt"
        ),
    ))
    safe(snapshot, "dividend", lambda: raw_rows(pro, "dividend", ts_code=code))
    safe(snapshot, "pledge_stat", lambda: raw_rows(pro, "pledge_stat", ts_code=code))
    safe(snapshot, "block_trade", lambda: raw_rows(pro, "block_trade", ts_code=code, start_date=market_start, end_date=market_end))
    safe(snapshot, "repurchase", lambda: raw_rows(pro, "repurchase", ts_code=code, start_date=financial_start, end_date=financial_end))
    safe(snapshot, "forecast", lambda: raw_rows(pro, "forecast", ts_code=code, start_date=financial_start, end_date=financial_end))
    safe(snapshot, "express", lambda: raw_rows(pro, "express", ts_code=code, start_date=financial_start, end_date=financial_end))
    peers = {}
    for peer_code, peer_name in {
        "600795.SH": "国电电力",
        "600027.SH": "华电国际",
        "601991.SH": "大唐发电",
        "000600.SZ": "建投能源",
    }.items():
        peer = {"name": peer_name}
        try:
            peer["daily_basic"] = raw_rows(pro, "daily_basic", ts_code=peer_code, trade_date=market_end)
        except Exception as error:
            peer["daily_basic_error"] = f"{type(error).__name__}: {error}"
        try:
            peer["income"] = raw_rows(pro, "income", ts_code=peer_code, period="20260630")
        except Exception as error:
            peer["income_error"] = f"{type(error).__name__}: {error}"
        peers[peer_code] = peer
    snapshot["peers"] = peers

    output = Path(__file__).with_name("research-inputs.json")
    output.write_text(json.dumps(clean(snapshot), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
