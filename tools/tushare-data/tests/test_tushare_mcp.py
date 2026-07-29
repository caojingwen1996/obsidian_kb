from pathlib import Path
import sys
import unittest


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.append(str(SCRIPT_DIR))

from mcp_server import handle
from tushare_client import (
    TushareClientError,
    a_share_ts_code,
    normalize_date,
    validate_params,
)


class TushareClientTests(unittest.TestCase):
    def test_a_share_code_normalization(self):
        self.assertEqual(a_share_ts_code("600150"), "600150.SH")
        self.assertEqual(a_share_ts_code("000001"), "000001.SZ")
        self.assertEqual(a_share_ts_code("600150.SH"), "600150.SH")

    def test_date_normalization(self):
        self.assertEqual(normalize_date("20260729"), "2026-07-29")
        self.assertEqual(normalize_date("2026-07-29"), "2026-07-29")

    def test_daily_basic_param_validation(self):
        params = validate_params("daily_basic", {"ts_code": "600150", "trade_date": "2026-07-29"})
        self.assertEqual(params["ts_code"], "600150.SH")
        self.assertEqual(params["trade_date"], "20260729")

    def test_stock_daily_param_validation(self):
        params = validate_params("daily", {"ts_code": "000001", "start_date": "2026-07-01"})
        self.assertEqual(params["ts_code"], "000001.SZ")
        self.assertEqual(params["start_date"], "20260701")

    def test_daily_basic_requires_code(self):
        with self.assertRaises(TushareClientError):
            validate_params("daily_basic", {})

    def test_moneyflow_param_validation(self):
        params = validate_params("moneyflow", {"ts_code": "600879", "start_date": "2026-07-01"})
        self.assertEqual(params["ts_code"], "600879.SH")
        self.assertEqual(params["start_date"], "20260701")

    def test_margin_detail_param_validation(self):
        params = validate_params("margin_detail", {"ts_code": "000001.SZ", "trade_date": "2026-07-29"})
        self.assertEqual(params["ts_code"], "000001.SZ")
        self.assertEqual(params["trade_date"], "20260729")


class McpServerTests(unittest.TestCase):
    def test_initialize_response(self):
        response = handle({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
        self.assertEqual(response["result"]["serverInfo"]["name"], "tushare-data")

    def test_tools_list_contains_daily_basic(self):
        response = handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        names = [tool["name"] for tool in response["result"]["tools"]]
        self.assertEqual(names, [
            "get_stock_basic",
            "get_stock_daily",
            "get_stock_valuation",
            "get_stock_moneyflow",
            "get_margin_detail",
            "get_financial_statements",
            "get_dividend_history",
            "get_index_constituents",
        ])


if __name__ == "__main__":
    unittest.main()
