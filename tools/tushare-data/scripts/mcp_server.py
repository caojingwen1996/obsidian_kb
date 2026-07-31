"""Tushare MCP Server over stdio JSON-RPC."""

import json
import sys
import traceback

from tushare_client import DATASETS, TushareClient, TushareClientError, tushare_date


SERVER_NAME = "tushare-data"
SERVER_VERSION = "0.3.0"


def stderr_logger(event, **fields):
    details = " ".join(f"{key}={value}" for key, value in fields.items() if value is not None)
    print(f"{event} {details}".strip(), file=sys.stderr, flush=True)


def json_text(payload):
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def tool_result(payload, is_error=False):
    return {
        "content": [{"type": "text", "text": json_text(payload)}],
        "structuredContent": payload,
        "isError": bool(is_error),
    }


def field_schema(default_fields):
    return {
        "oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}],
        "default": list(default_fields),
    }


def common_query_props(default_fields):
    return {
        "fields": field_schema(default_fields),
        "use_cache": {"type": "boolean", "default": True},
        "limit": {"type": "integer", "minimum": 1, "maximum": 10000},
    }


def tools():
    return [
        {
            "name": "get_stock_basic",
            "description": "获取A股上市公司的基础资料，用于股票代码校验、公司身份识别和基础信息补全。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "可选，股票代码，例如 600150 或 600150.SH。"},
                    "name": {"type": "string", "description": "可选，公司简称。"},
                    "exchange": {"type": "string", "default": ""},
                    "list_status": {"type": "string", "default": "L", "description": "L上市 D退市 P暂停上市。"},
                    **common_query_props(DATASETS["stock_basic"]["fields"]),
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "get_stock_daily",
            "description": "获取A股个股历史日线行情。Tushare daily 返回不复权价格，本工具在结果中明确 adjustment=none。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "trade_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "end_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "adjustment": {"type": "string", "enum": ["none"], "default": "none"},
                    **common_query_props(DATASETS["daily"]["fields"]),
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_stock_valuation",
            "description": "获取A股个股估值、股息率、市值和交易活跃度数据。当前股息率使用 dv_ttm。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "trade_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "end_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    **common_query_props(DATASETS["daily_basic"]["fields"]),
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_stock_moneyflow",
            "description": "获取A股个股资金流向和大小单分档数据。Tushare moneyflow 为订单规模统计代理，不确认账户身份。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "trade_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "end_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    **common_query_props(DATASETS["moneyflow"]["fields"]),
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_margin_detail",
            "description": "获取A股个股融资融券交易明细，用于观察融资余额、融资买入、融资偿还和融券变化。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "trade_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "end_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    **common_query_props(DATASETS["margin_detail"]["fields"]),
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_market_margin",
            "description": "获取沪深市场融资融券交易汇总，用于观察全市场融资余额、融资买入、融资偿还和融资融券余额变化。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "trade_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "end_date": {"type": "string", "description": "YYYYMMDD 或 YYYY-MM-DD。"},
                    "exchange_id": {"type": "string", "description": "可选，交易所代码，例如 SSE 或 SZSE。"},
                    **common_query_props(DATASETS["margin"]["fields"]),
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "get_financial_statements",
            "description": "获取A股利润表、资产负债表和现金流量表核心科目，并保留报告期、公告日期、报表类型和合并口径信息。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "statement": {
                        "type": "string",
                        "enum": ["income", "balancesheet", "cashflow", "all"],
                        "default": "all",
                    },
                    "period": {"type": "string", "description": "报告期 YYYYMMDD 或 YYYY-MM-DD。"},
                    "start_date": {"type": "string", "description": "公告开始日期。"},
                    "end_date": {"type": "string", "description": "公告结束日期或报告期。"},
                    "report_type": {"type": "string"},
                    "comp_type": {"type": "string"},
                    "use_cache": {"type": "boolean", "default": True},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 10000},
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_dividend_history",
            "description": "获取A股历史分红方案及实施记录，默认优先保留已实施分红，并标识预案、通过和实施状态。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ts_code": {"type": "string", "description": "股票代码，例如 600150 或 600150.SH。"},
                    "ann_date": {"type": "string"},
                    "record_date": {"type": "string"},
                    "ex_date": {"type": "string"},
                    "implemented_only": {"type": "boolean", "default": False},
                    **common_query_props(DATASETS["dividend"]["fields"]),
                },
                "required": ["ts_code"],
                "additionalProperties": False,
            },
        },
        {
            "name": "get_index_constituents",
            "description": "获取指定A股指数在某个日期或日期范围内的成分股名单及权重。若指定日期无数据，返回最近且已生效的一期权重日期。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "index_code": {"type": "string", "description": "指数代码，例如 000300.SH。"},
                    "trade_date": {"type": "string", "description": "目标权重日期。"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    **common_query_props(DATASETS["index_weight"]["fields"]),
                },
                "required": ["index_code"],
                "additionalProperties": False,
            },
        },
    ]


def pop_common(arguments):
    arguments = dict(arguments or {})
    use_cache = arguments.pop("use_cache", True)
    limit = arguments.pop("limit", None)
    return arguments, use_cache, limit


def apply_limit(rows, limit):
    return rows[: int(limit)] if limit else rows


def query_dataset(client, dataset, arguments):
    params, use_cache, limit = pop_common(arguments)
    rows = client.call_frame(dataset, use_cache=use_cache, **params)
    return apply_limit(rows, limit)


def get_financial_statements(client, arguments):
    args = dict(arguments or {})
    statement = args.pop("statement", "all")
    use_cache = args.pop("use_cache", True)
    limit = args.pop("limit", None)
    datasets = ["income", "balancesheet", "cashflow"] if statement == "all" else [statement]
    payload = {}
    for dataset in datasets:
        rows = client.call_frame(dataset, use_cache=use_cache, **args)
        payload[dataset] = {
            "rows": apply_limit(rows, limit),
            "row_count": min(len(rows), int(limit)) if limit else len(rows),
        }
    return payload


def get_dividend_history(client, arguments):
    args, use_cache, limit = pop_common(arguments)
    implemented_only = bool(args.pop("implemented_only", False))
    rows = client.call_frame("dividend", use_cache=use_cache, **args)
    if implemented_only:
        rows = [row for row in rows if "实施" in str(row.get("div_proc") or "")]
    rows = apply_limit(rows, limit)
    return rows


def get_index_constituents(client, arguments):
    args, use_cache, limit = pop_common(arguments)
    requested_date = args.get("trade_date")
    rows = client.call_frame("index_weight", use_cache=use_cache, **args)
    actual_date = None
    if requested_date and not rows:
        target = tushare_date(requested_date)
        fallback_args = dict(args)
        fallback_args.pop("trade_date", None)
        fallback_args.setdefault("end_date", target)
        rows = client.call_frame("index_weight", use_cache=use_cache, **fallback_args)
        valid_dates = sorted({str(row.get("trade_date")) for row in rows if row.get("trade_date")})
        actual_date = valid_dates[-1] if valid_dates else None
        if actual_date:
            rows = [row for row in rows if row.get("trade_date") == actual_date]
    elif rows:
        actual_date = str(rows[0].get("trade_date") or "")
    rows = apply_limit(rows, limit)
    return {
        "requested_weight_date": requested_date,
        "actual_weight_date": actual_date,
        "rows": rows,
        "row_count": len(rows),
    }


def get_market_margin(client, arguments):
    args, use_cache, limit = pop_common(arguments)
    rows = client.call_frame("margin", use_cache=use_cache, **args)
    total_fields = ("rzye", "rzmre", "rzche", "rqye", "rqmcl", "rzrqye")
    totals_by_date = {}
    for row in rows:
        trade_date = row.get("trade_date") or "unknown"
        totals = totals_by_date.setdefault(trade_date, {field: 0 for field in total_fields})
        for field in total_fields:
            value = row.get(field)
            try:
                totals[field] += float(value)
            except (TypeError, ValueError):
                pass
    summaries = [
        {"trade_date": trade_date, **totals}
        for trade_date, totals in sorted(totals_by_date.items())
    ]
    visible_rows = apply_limit(rows, limit)
    return {"rows": visible_rows, "row_count": len(visible_rows), "summary": summaries}


def call_tool(name, arguments):
    arguments = arguments or {}
    client = TushareClient(logger=stderr_logger)
    if name == "get_stock_basic":
        rows = query_dataset(client, "stock_basic", arguments)
        return {"dataset": "stock_basic", "rows": rows, "row_count": len(rows)}
    if name == "get_stock_daily":
        args = dict(arguments)
        adjustment = args.pop("adjustment", "none")
        if adjustment != "none":
            raise TushareClientError("tushare-adjustment", "Tushare daily only returns unadjusted prices")
        rows = query_dataset(client, "daily", args)
        return {"dataset": "daily", "adjustment": "none", "rows": rows, "row_count": len(rows)}
    if name == "get_stock_valuation":
        rows = query_dataset(client, "daily_basic", arguments)
        return {"dataset": "daily_basic", "dividend_yield_field": "dv_ttm", "rows": rows, "row_count": len(rows)}
    if name == "get_stock_moneyflow":
        rows = query_dataset(client, "moneyflow", arguments)
        return {"dataset": "moneyflow", "rows": rows, "row_count": len(rows)}
    if name == "get_margin_detail":
        rows = query_dataset(client, "margin_detail", arguments)
        return {"dataset": "margin_detail", "rows": rows, "row_count": len(rows)}
    if name == "get_market_margin":
        return {"dataset": "margin", **get_market_margin(client, arguments)}
    if name == "get_financial_statements":
        statements = get_financial_statements(client, arguments)
        return {"dataset": "financial_statements", "statements": statements}
    if name == "get_dividend_history":
        rows = get_dividend_history(client, arguments)
        return {"dataset": "dividend", "rows": rows, "row_count": len(rows)}
    if name == "get_index_constituents":
        return {"dataset": "index_weight", **get_index_constituents(client, arguments)}
    raise TushareClientError("mcp-tool", f"unknown tool: {name}")


def handle(request):
    method = request.get("method")
    request_id = request.get("id")
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tools()}}
    if method == "tools/call":
        params = request.get("params") or {}
        try:
            payload = call_tool(params.get("name"), params.get("arguments") or {})
            return {"jsonrpc": "2.0", "id": request_id, "result": tool_result(payload)}
        except Exception as error:
            payload = {
                "error": type(error).__name__,
                "message": str(error),
                "source": getattr(error, "source", "tushare-mcp"),
                "trace": traceback.format_exc(limit=3),
            }
            return {"jsonrpc": "2.0", "id": request_id, "result": tool_result(payload, is_error=True)}
    if method and method.startswith("notifications/"):
        return None
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"method not found: {method}"},
    }


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
            response = handle(request)
        except Exception as error:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": str(error)},
            }
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
