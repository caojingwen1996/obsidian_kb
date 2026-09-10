import json
import unittest
from threading import Thread
from unittest.mock import patch
from urllib.parse import quote
from urllib.request import urlopen

from scripts.local_proxy import create_server, fetch_stock_lookup, RouteError, UpstreamError
from tushare_client import TushareClientError


class StockLookupTests(unittest.TestCase):
    class Client:
        def stock_basic_rows(self):
            return [
                {"name": "国药股份", "symbol": "600511"},
                {"name": "国药一致", "ts_code": "000028.SZ"},
                {"name": "恩华药业", "symbol": "002262"},
            ]

    def test_exact_name_and_leading_zero(self):
        self.assertEqual(fetch_stock_lookup(" 国药股份 ", self.Client())["data"]["match"],
                         {"name": "国药股份", "code": "600511"})
        self.assertEqual(fetch_stock_lookup("恩华药业", self.Client())["data"]["match"]["code"], "002262")

    def test_partial_and_unknown_do_not_pick_first(self):
        data = fetch_stock_lookup("国药", self.Client())["data"]
        self.assertIsNone(data["match"])
        self.assertEqual(len(data["candidates"]), 2)
        self.assertIsNone(fetch_stock_lookup("不存在公司", self.Client())["data"]["match"])

    def test_duplicate_name_does_not_autofill(self):
        client = self.Client()
        client.stock_basic_rows = lambda: [{"name": "同名", "symbol": "600001"}, {"name": "同名", "symbol": "000001"}]
        self.assertIsNone(fetch_stock_lookup("同名", client)["data"]["match"])

    def test_invalid_query(self):
        with self.assertRaises(RouteError):
            fetch_stock_lookup("", self.Client())

    def test_source_failure_is_not_a_match(self):
        client = self.Client()
        with patch.object(client, "stock_basic_rows", side_effect=TushareClientError("tushare-token")):
            with self.assertRaises(UpstreamError) as result:
                fetch_stock_lookup("国药股份", client)
        self.assertEqual(result.exception.source, "tushare-token")

    def test_http_route(self):
        with patch("tushare_client.TushareClient", return_value=self.Client()):
            server = create_server(port=0)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with urlopen(f"http://127.0.0.1:{server.server_port}/api/stock-lookup?name={quote('国药股份')}") as response:
                    payload = json.load(response)
                self.assertEqual(payload["data"]["match"]["code"], "600511")
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
