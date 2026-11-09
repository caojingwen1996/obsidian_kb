"""Reusable daily market service. Python and MCP share these implementations."""

from datetime import datetime, timezone
import math
from decimal import Decimal

from tushare_client import DATASETS, TushareClient, TushareClientError, normalize_date


SERIES = {
    "get_fund_adjustments": ("fund_adj", "基金复权因子", {"adj_factor": "factor"}),
    "get_index_daily": ("index_daily", "国内指数日线，须指定准确市场后缀", {"close": "index_points", "amount": "CNY_thousand", "vol": "lots"}),
    "get_index_valuation": ("index_dailybasic", "Tushare指数估值，不等同中证官方算法", {"pe_ttm": "multiple", "total_mv": "CNY", "float_mv": "CNY"}),
    "get_global_index_daily": ("index_global", "国际指数日线；SPX为标普500，IXIC不等于NDX", {"close": "index_points", "vol": "provider_native"}),
    "get_shibor": ("shibor", "Shibor全期限利率，on为隔夜", {"rates": "percent"}),
    "get_us_treasury_curve": ("us_tycr", "美国国债全期限收益率，含10Y-2Y利差", {"rates": "percent", "spread_10y_2y": "percentage_points"}),
    "get_fx_daily": ("fx_daily", "外汇bid/ask日线，默认USDJPY；不是盘中报价", {"bid_close": "quote_currency_per_base_currency", "ask_close": "quote_currency_per_base_currency"}),
}
SPECIAL = {
    "get_southbound_flow": "港股通每日买入减卖出得到南向净买入；保留原始亿元单位及日期，缺项不计算",
    "get_etf_flow_estimate": "沪深股票型ETF份额变动乘当日净值估算，排除QDII，返回覆盖及异常名单，最多32自然日",
    "get_fund_daily": "ETF日线及可选前/后复权；仅日线，不提供盘中前高",
    "get_market_turnover": "沪深股票成交额，SH_MARKET+SZ_MARKET，同日完整配对",
    "get_market_margin_history": "沪深融资历史及净买入，排除北交所，缺一市场不合计",
    "get_market_margin_ratio": "沪深融资余额占股票市场流通市值；margin与daily_info同日配对，分母含B股，排除北交所",
}


def finite(value):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None


def payload(dataset, rows, start_date, end_date, units, limit=None, **metadata):
    if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 10000):
        raise TushareClientError("tushare-params", "limit must be an integer between 1 and 10000")
    dates = [r.get("trade_date", r.get("date")) for r in rows]
    visible = rows[-limit:] if limit else rows
    return {
        "provider": "Tushare", "dataset": dataset, "frequency": "daily",
        "status": "ok" if rows else "empty", "units": units,
        "requested_start": normalize_date(start_date), "requested_end": normalize_date(end_date),
        "observed_start": dates[0] if dates else None, "observed_end": dates[-1] if dates else None,
        "served_at": datetime.now(timezone.utc).isoformat(),
        "rows": visible, "row_count": len(visible), "total_row_count": len(rows),
        "truncated": len(visible) < len(rows), "latest": rows[-1] if rows else None,
        "coverage_note": "Observed rows only; no trading-calendar completeness claim. served_at is not the observation or upstream refresh time.",
        **metadata,
    }


class MarketData:
    """One configured client can be reused for all tools and datasets."""

    def __init__(self, client=None):
        self.client = client or TushareClient()

    def query(self, tool, *, start_date, end_date, ts_code=None, adjustment="none", use_cache=True, limit=None):
        if tool not in SERIES and tool not in SPECIAL:
            raise TushareClientError("mcp-tool", "unsupported shared market tool")
        if adjustment != "none" and tool != "get_fund_daily":
            raise TushareClientError("tushare-adjustment", "adjustment is only supported for fund daily")
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 10000):
            raise TushareClientError("tushare-params", "invalid limit")
        if not isinstance(use_cache, bool):
            raise TushareClientError("tushare-params", "use_cache must be boolean")
        if tool == "get_southbound_flow":
            if ts_code is not None:
                raise TushareClientError("tushare-params", "southbound aggregate does not accept ts_code")
            return self.southbound_flow(start_date, end_date, use_cache, limit)
        if tool == "get_etf_flow_estimate":
            if ts_code is not None:
                raise TushareClientError("tushare-params", "ETF market estimate does not accept ts_code")
            from tushare_etf_flow import etf_flow_history
            return etf_flow_history(self.client, start_date, end_date, use_cache, limit)
        if tool == "get_fund_daily":
            return self.fund_daily(ts_code, start_date, end_date, adjustment, use_cache, limit)
        if tool == "get_market_margin_ratio":
            if ts_code is not None:
                raise TushareClientError("tushare-params", "market aggregate does not accept ts_code")
            return self.margin_ratio(start_date, end_date, use_cache, limit)
        if tool in {"get_market_turnover", "get_market_margin_history"}:
            if ts_code is not None:
                raise TushareClientError("tushare-params", "market aggregate does not accept ts_code")
            return self.market_totals(tool, start_date, end_date, use_cache, limit)
        dataset, _, units = SERIES[tool]
        params = {}
        if tool == "get_fx_daily":
            ts_code = ts_code or "USDJPY.FXCM"
        if ts_code is not None:
            params["ts_code"] = ts_code
        if dataset == "us_tycr":
            params["fields"] = ",".join(DATASETS[dataset]["fields"])
        rows = self.client.history(dataset, start_date, end_date, use_cache=use_cache, **params)
        if dataset == "us_tycr":
            rows = [{**r, "spread_10y_2y": finite(r.get("y10")) - finite(r.get("y2"))
                     if finite(r.get("y10")) is not None and finite(r.get("y2")) is not None else None} for r in rows]
        return payload(dataset, rows, start_date, end_date, units, limit,
                       adjustment="none", requested_code=ts_code)

    def southbound_flow(self, start_date, end_date, use_cache=True, limit=None):
        raw = self.client.history("ggt_daily", start_date, end_date, use_cache=use_cache)
        rows = []
        for item in raw:
            buy, sell = finite(item.get("buy_amount")), finite(item.get("sell_amount"))
            complete = buy is not None and sell is not None and buy >= 0 and sell >= 0
            net = float(Decimal(str(buy)) - Decimal(str(sell))) if complete else None
            rows.append({**item, "net_buy_yi": net, "complete": complete})
        result = payload("ggt_daily", rows, start_date, end_date,
            {"buy_amount": "provider_currency_100_million", "sell_amount": "provider_currency_100_million",
             "net_buy_yi": "provider_currency_100_million", "buy_volume": "ten_thousand_transactions",
             "sell_volume": "ten_thousand_transactions"}, limit,
            formula="net_buy_yi=buy_amount-sell_amount", adjustment="none",
            currency="provider_unspecified", scope="Tushare ggt_daily港股通每日成交统计，非北向资金",
            source_note="金额沿用接口亿元单位；币种待核验，未换汇；笔数不是成交股数；不与旧东财历史拼接")
        if any(not r["complete"] for r in rows):
            result["status"] = "partial"
        return result

    def fund_daily(self, ts_code, start_date, end_date, adjustment="none", use_cache=True, limit=None):
        if adjustment not in {"none", "qfq", "hfq"}:
            raise TushareClientError("tushare-adjustment", "adjustment must be none, qfq or hfq")
        raw = self.client.history("fund_daily", start_date, end_date, ts_code=ts_code, use_cache=use_cache)
        rows = raw
        anchor_date = anchor_factor = None
        if adjustment != "none" and raw:
            factors = self.client.history("fund_adj", start_date, end_date, ts_code=ts_code, use_cache=use_cache)
            factors = {r["trade_date"]: finite(r.get("adj_factor")) for r in factors}
            if any(not factors.get(r["trade_date"]) or factors[r["trade_date"]] <= 0 for r in raw):
                raise TushareClientError("tushare-adjustment", "missing or invalid factor for price date")
            anchor_date = raw[-1]["trade_date"]
            anchor_factor = factors[anchor_date]
            rows = []
            previous = None
            for r in raw:
                factor = factors[r["trade_date"]]
                scale = factor / anchor_factor if adjustment == "qfq" else factor
                if any(finite(r.get(k)) is None or finite(r[k]) <= 0 for k in ("open", "high", "low", "close")):
                    raise TushareClientError("tushare-adjustment", "invalid OHLC price")
                row = {**r, **{k: float(r[k]) * scale for k in ("open", "high", "low", "close")}, "raw": dict(r), "adj_factor": factor}
                # Raw pre_close/change cannot be mixed with adjusted OHLC.
                row.update(pre_close=previous, change=row["close"]-previous if previous else None,
                           pct_chg=(row["close"]/previous-1)*100 if previous else None)
                previous = row["close"]
                rows.append(row)
        return payload("fund_daily", rows, start_date, end_date,
                       {"prices": "CNY", "amount": "CNY_thousand", "vol": "lots"}, limit,
                       adjustment=adjustment, anchor_date=anchor_date, anchor_factor=anchor_factor,
                       adjustment_rule="qfq=raw*factor/last_price_date_factor_in_requested_range; hfq=raw*factor; volume/amount unchanged",
                       requested_code=ts_code)

    def margin_ratio(self, start_date, end_date, use_cache=True, limit=None):
        margin = self.client.history("margin", start_date, end_date, use_cache=use_cache,
                                     fields="trade_date,exchange_id,rzye")
        inputs = {"SSE": margin, "SZSE": margin}
        for code in ("SH_MARKET", "SZ_MARKET"):
            inputs[code] = self.client.history("daily_info", start_date, end_date,
                ts_code=code, fields="trade_date,ts_code,float_mv", use_cache=use_cache)
        grouped = {}
        for code, records in inputs.items():
            identity = "exchange_id" if code in ("SSE", "SZSE") else "ts_code"
            field = "rzye" if identity == "exchange_id" else "float_mv"
            for record in records:
                if record.get(identity) != code:
                    continue
                values = grouped.setdefault(record["trade_date"], {})
                value = finite(record.get(field))
                if code in values and values[code] != value:
                    raise TushareClientError("tushare-data", "conflicting market values")
                values[code] = value
        rows = []
        for day, values in sorted(grouped.items()):
            missing = [code for code in inputs if values.get(code) is None or
                       values[code] < 0 or (code.endswith("_MARKET") and values[code] == 0)]
            balance = sum(values[c] for c in ("SSE", "SZSE")) if not any(c in missing for c in ("SSE", "SZSE")) else None
            cap = sum(values[c] for c in ("SH_MARKET", "SZ_MARKET")) if not any(c in missing for c in ("SH_MARKET", "SZ_MARKET")) else None
            rows.append({"trade_date": day, "complete": not missing, "missing_inputs": missing,
                         "financing_balance_yi": balance / 1e8 if balance is not None else None,
                         "float_market_cap_yi": cap,
                         "financing_ratio_pct": balance / 1e8 / cap * 100 if not missing else None})
        result = payload("margin+daily_info", rows, start_date, end_date,
                         {"financing_balance_yi": "CNY_hundred_million", "float_market_cap_yi": "CNY_hundred_million", "financing_ratio_pct": "percent"}, limit,
                         market_scope=["SSE", "SZSE"], denominator_scope=["SH_MARKET", "SZ_MARKET"],
                         calculation="(SSE.rzye+SZSE.rzye)/1e8/(SH_MARKET.float_mv+SZ_MARKET.float_mv)*100",
                         scope_note="交易所融资余额（含证券类两融标的）/沪深股票市场流通市值（含B股）；排除北交所，不是仅融资标的股票占比。")
        if any(not row["complete"] for row in rows):
            result["status"] = "partial"
        return result

    def market_totals(self, tool, start_date, end_date, use_cache=True, limit=None):
        turnover = tool == "get_market_turnover"
        dataset = "daily_info" if turnover else "margin"
        expected = ("SH_MARKET", "SZ_MARKET") if turnover else ("SSE", "SZSE")
        key = "ts_code" if turnover else "exchange_id"
        raw = []
        if turnover:
            for code in expected:
                raw.extend(self.client.history(dataset, start_date, end_date, ts_code=code, use_cache=use_cache))
        else:
            raw = self.client.history(dataset, start_date, end_date, use_cache=use_cache)
        fields = ("amount",) if turnover else ("rzye", "rzmre", "rzche")
        grouped = {}
        for row in raw:
            if row.get(key) in expected:
                day = grouped.setdefault(row["trade_date"], {})
                if row[key] in day and day[row[key]] != row:
                    raise TushareClientError("tushare-data", "conflicting market rows")
                day[row[key]] = row
        rows = []
        for date, markets in sorted(grouped.items()):
            missing = [m for m in expected if m not in markets]
            item = {"trade_date": date, "complete": not missing, "missing_markets": missing}
            for field in fields:
                values = [finite(markets.get(m, {}).get(field)) for m in expected]
                item[field] = sum(values) if all(v is not None for v in values) else None
                if item[field] is None:
                    item["complete"] = False
            if turnover:
                # daily_info.amount is CNY hundred-million; no second unit conversion.
                item["turnover_yi"] = item["amount"]
            else:
                item["financing_balance_yi"] = item["rzye"]/1e8 if item["rzye"] is not None else None
                item["financing_net_buy_yi"] = (item["rzmre"]-item["rzche"])/1e8 if item["rzmre"] is not None and item["rzche"] is not None else None
            rows.append(item)
        result = payload(dataset, rows, start_date, end_date,
                         {"amount": "CNY_hundred_million", "turnover_yi": "CNY_hundred_million"} if turnover else
                         {"rzye": "CNY", "rzmre": "CNY", "rzche": "CNY", "financing_balance_yi": "CNY_hundred_million", "financing_net_buy_yi": "CNY_hundred_million"},
                         limit, market_scope=list(expected))
        if any(not r["complete"] for r in rows):
            result["status"] = "partial"
        return result


def market_tools():
    result = []
    for name in [*SPECIAL, *SERIES]:
        props = {
            "start_date": {"type": "string", "description": "Inclusive YYYY-MM-DD or YYYYMMDD"},
            "end_date": {"type": "string", "description": "Inclusive YYYY-MM-DD or YYYYMMDD"},
            "use_cache": {"type": "boolean", "default": True},
            "limit": {"type": "integer", "minimum": 1, "maximum": 10000, "description": "Return latest N rows, ascending; metadata keeps full requested range"},
        }
        required = ["start_date", "end_date"]
        if name in {"get_fund_daily", "get_fund_adjustments", "get_index_daily", "get_index_valuation", "get_global_index_daily", "get_fx_daily"}:
            props["ts_code"] = {"type": "string", "description": "Exact provider code, e.g. 159941.SZ, 000922.CSI, SPX, USDJPY.FXCM"}
            if name != "get_fx_daily":
                required.append("ts_code")
        if name == "get_fund_daily":
            props["adjustment"] = {"type": "string", "enum": ["none", "qfq", "hfq"], "default": "none"}
        result.append({"name": name, "description": SPECIAL[name] if name in SPECIAL else SERIES[name][1],
                       "inputSchema": {"type": "object", "properties": props, "required": required, "additionalProperties": False}})
    return result
