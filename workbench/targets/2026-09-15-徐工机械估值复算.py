"""Refresh market evidence for the 2026-09-15 XCMG valuation rerun."""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "sources/assets/徐工机械/2026-09-15"
TS_SCRIPTS = ROOT / "tools/tushare-data/scripts"
sys.path.insert(0, str(TS_SCRIPTS))

from tushare_client import TushareClient, frame_to_rows  # noqa: E402


def write_json(name: str, value: object) -> None:
    path = OUT / name
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = TushareClient()
    pro = client.pro()
    start = "20260801"
    end = "20260915"
    code = "000425.SZ"

    calls = {
        "stock_basic.json": lambda: frame_to_rows(
            pro.stock_basic(ts_code=code, fields="ts_code,symbol,name,area,industry,market,exchange,list_date,list_status")
        ),
        "daily.json": lambda: frame_to_rows(pro.daily(ts_code=code, start_date=start, end_date=end)),
        "daily_basic.json": lambda: frame_to_rows(
            pro.daily_basic(ts_code=code, start_date=start, end_date=end,
                            fields="ts_code,trade_date,close,turnover_rate,volume_ratio,pe,pe_ttm,pb,ps_ttm,dv_ratio,dv_ttm,total_share,total_mv,circ_mv")
        ),
        "adj_factor.json": lambda: frame_to_rows(pro.adj_factor(ts_code=code, start_date=start, end_date=end)),
        "moneyflow.json": lambda: frame_to_rows(pro.moneyflow(ts_code=code, start_date=start, end_date=end)),
        "margin_detail.json": lambda: frame_to_rows(pro.margin_detail(ts_code=code, start_date=start, end_date=end)),
        "stk_holdernumber.json": lambda: frame_to_rows(pro.stk_holdernumber(ts_code=code, start_date="20250101", end_date=end)),
    }
    peers = ["600031.SH", "000157.SZ", "000528.SZ"]
    for peer in peers:
        calls[f"daily_basic-{peer}.json"] = lambda peer=peer: frame_to_rows(
            pro.daily_basic(ts_code=peer, start_date="20260914", end_date=end,
                            fields="ts_code,trade_date,close,pe_ttm,pb,total_mv")
        )
        calls[f"daily-{peer}.json"] = lambda peer=peer: frame_to_rows(
            pro.daily(ts_code=peer, start_date=start, end_date=end)
        )
        calls[f"adj_factor-{peer}.json"] = lambda peer=peer: frame_to_rows(
            pro.adj_factor(ts_code=peer, start_date=start, end_date=end)
        )
    calls["market-daily-20260915.json"] = lambda: frame_to_rows(pro.daily(trade_date="20260915"))

    manifest: dict[str, object] = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "code": code,
        "query_range": {"start": start, "end": end},
        "files": {},
        "errors": {},
    }
    for name, call in calls.items():
        try:
            rows = call()
            write_json(name, rows)
            raw = (OUT / name).read_bytes()
            manifest["files"][name] = {
                "rows": len(rows),
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
        except Exception as exc:  # preserve each evidence gap without aborting other calls
            manifest["errors"][name] = f"{type(exc).__name__}: {exc}"

    write_json("retrieval.json", manifest)
    if not manifest["errors"]:
        def load(name: str) -> list[dict]:
            return json.loads((OUT / name).read_text(encoding="utf-8"))

        daily = sorted(load("daily.json"), key=lambda row: row["trade_date"], reverse=True)
        basic = sorted(load("daily_basic.json"), key=lambda row: row["trade_date"], reverse=True)
        money = sorted(load("moneyflow.json"), key=lambda row: row["trade_date"], reverse=True)
        margin = sorted(load("margin_detail.json"), key=lambda row: row["trade_date"], reverse=True)
        factors = {row["trade_date"]: row["adj_factor"] for row in load("adj_factor.json")}
        money_by_date = {row["trade_date"]: row for row in money}
        latest = daily[0]
        latest_basic = basic[0]
        windows = []
        for width in (5, 10, 20):
            start_row = daily[width]
            price_return = (
                latest["close"] * factors[latest["trade_date"]]
                / (start_row["close"] * factors[start_row["trade_date"]])
                - 1
            )
            large_flow = 0.0
            for row in daily[:width]:
                flow = money_by_date.get(row["trade_date"])
                if flow:
                    large_flow += (
                        flow["buy_lg_amount"] + flow["buy_elg_amount"]
                        - flow["sell_lg_amount"] - flow["sell_elg_amount"]
                    ) / 10000
            margin_return = margin[0]["rzye"] / margin[width]["rzye"] - 1
            windows.append({
                "width": width,
                "price_start": start_row["trade_date"],
                "price_end": latest["trade_date"],
                "price_return": price_return,
                "large_flow_100m": large_flow,
                "margin_start": margin[width]["trade_date"],
                "margin_end": margin[0]["trade_date"],
                "margin_return": margin_return,
            })

        shares_100m = latest_basic["total_share"] / 10000
        profits = [68.0, 75.0, 80.0]
        multiples = [12.0, 12.8, 14.0]
        values = [profit * multiple / shares_100m for profit, multiple in zip(profits, multiples)]
        price = latest["close"]
        upside = values[2] / price - 1
        downside = 1 - values[0] / price
        break_even_probability = downside / (upside + downside)
        kelly = []
        for probability in (0.5, 0.6, 0.7, 0.8, 0.9):
            theoretical = probability / downside - (1 - probability) / upside
            capped = min(1.0, max(0.0, theoretical))
            kelly.append({
                "probability": probability,
                "theoretical": theoretical,
                "long_only_full": capped,
                "half": capped / 2,
            })
        holders = sorted(
            [row for row in load("stk_holdernumber.json") if row.get("holder_num") is not None],
            key=lambda row: row["end_date"], reverse=True,
        )
        peer_rows = {}
        peer_windows = {}
        for peer in peers:
            rows = sorted(load(f"daily_basic-{peer}.json"), key=lambda row: row["trade_date"], reverse=True)
            peer_rows[peer] = rows[0] if rows else None
            peer_daily = sorted(load(f"daily-{peer}.json"), key=lambda row: row["trade_date"], reverse=True)
            peer_factors = {row["trade_date"]: row["adj_factor"] for row in load(f"adj_factor-{peer}.json")}
            peer_windows[peer] = {
                str(width): (
                    peer_daily[0]["close"] * peer_factors[peer_daily[0]["trade_date"]]
                    / (peer_daily[width]["close"] * peer_factors[peer_daily[width]["trade_date"]]) - 1
                )
                for width in (5, 10, 20)
            }
        market_rows = load("market-daily-20260915.json")
        market_breadth = {
            "trade_date": "20260915",
            "up": sum(row.get("pct_chg", 0) > 0 for row in market_rows),
            "down": sum(row.get("pct_chg", 0) < 0 for row in market_rows),
            "flat": sum(row.get("pct_chg", 0) == 0 for row in market_rows),
            "total": len(market_rows),
        }
        analysis = {
            "market": {
                "trade_date": latest["trade_date"],
                "close": price,
                "daily_pct": latest["pct_chg"],
                "turnover_rate": latest_basic["turnover_rate"],
                "pe_ttm": latest_basic["pe_ttm"],
                "pb": latest_basic["pb"],
                "total_share_100m": shares_100m,
                "total_mv_100m": latest_basic["total_mv"] / 10000,
            },
            "windows": windows,
            "margin_latest": {"trade_date": margin[0]["trade_date"], "rzye_100m": margin[0]["rzye"] / 1e8},
            "holders": holders[:6],
            "peers": peer_rows,
            "peer_windows": peer_windows,
            "market_breadth": market_breadth,
            "valuation": {
                "profits_100m": profits,
                "pe": multiples,
                "values": values,
                "reverse_profit_100m": price * shares_100m / 12.8,
                "mid_premium": price / values[1] - 1,
                "upper_deviation": price / values[2] - 1,
                "mid_return": values[1] / price - 1,
                "conservative_margin": 1 - price / values[0],
                "price_decomposition": {
                    "fair_value_mid": values[1],
                    "explainable_premium": 0.0,
                    "trading_deviation": price - values[1],
                },
                "kelly": {
                    "upside": upside,
                    "downside": downside,
                    "break_even_probability": break_even_probability,
                    "scenarios": kelly,
                    "boundary": "Two-point terminal-value sensitivity only; not a position recommendation.",
                },
            },
            "trigger_scan_counts": {
                "fundamental": {"total": 9, "favorable": 1, "current_deterioration": 3, "adverse": 1, "insufficient": 4, "not_applicable": 0},
                "liquidity": {"total": 14, "favorable": 1, "current_deterioration": 4, "adverse": 1, "insufficient": 8, "not_applicable": 0},
                "expectation": {"total": 9, "favorable": 3, "current_deterioration": 1, "adverse": 1, "insufficient": 4, "not_applicable": 0},
                "total": {"total": 32, "favorable": 5, "current_deterioration": 8, "adverse": 3, "insufficient": 16, "not_applicable": 0},
            },
            "actions": {"new_cash": "wait", "existing_holding": "review"},
        }
        write_json("market-analysis.json", analysis)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
