import errno
import io
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler

from scripts.local_proxy import fetch_upstream, fetch_upstream_text, upstream_error_fields
from scripts.local_proxy import fetch_market_margin, fetch_us_treasury_yield, fetch_us_dollar_index, fetch_usd_jpy


class ProxyTransportTests(unittest.TestCase):
    def test_all_four_routes_resolve_dashboard_local_configuration(self):
        routes = [
            (fetch_market_margin, 'market_margin_tool'),
            (fetch_us_treasury_yield, 'us_treasury_tool'),
            (fetch_us_dollar_index, 'us_dollar_tool'),
            (fetch_usd_jpy, 'usd_jpy_tool'),
        ]
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.env').write_text('TUSHARE_TOKEN=test-only-token\n', encoding='utf-8')
            api = object()
            provider = SimpleNamespace(pro_api=Mock(return_value=api))

            def read_data(client, args):
                self.assertIs(client.pro(), api)
                return {'rows': []}

            with patch.dict(os.environ, {}, clear=True), \
                    patch('scripts.local_proxy.__file__', str(root / 'scripts' / 'local_proxy.py')), \
                    patch('tushare_client.TUSHARE_DATA_DIR', root / 'shared'), \
                    patch('tushare_client.REPO_ROOT', root / 'wiki'), \
                    patch.dict('sys.modules', {'tushare': provider}), \
                    patch('scripts.local_proxy.write_proxy_log'):
                for route, tool_argument in routes:
                    with self.subTest(route=route.__name__):
                        self.assertEqual(route(**{tool_argument: read_data})['rows'], [])
                        provider.pro_api.assert_called_with('test-only-token')
                        supplied_client = object()
                        tool = Mock(return_value={})
                        route(client=supplied_client, **{tool_argument: tool})
                        self.assertIs(tool.call_args.args[0], supplied_client)

    def test_requests_follow_proxy_changes_without_restarting(self):
        observed = []

        def open_request(opener, request, timeout):
            proxy = next(handler for handler in opener.handlers if isinstance(handler, ProxyHandler))
            observed.append((proxy.proxies['https'], timeout))
            return io.BytesIO(b'{"data": 1}')

        with patch('urllib.request.getproxies', side_effect=[
            {'https': 'http://127.0.0.1:1111'},
            {'https': 'http://127.0.0.1:2222'},
        ]), patch('urllib.request.OpenerDirector.open', open_request), patch('scripts.local_proxy.write_proxy_log'):
            self.assertEqual(fetch_upstream('https://web.ifzq.gtimg.cn/', 'tencent-kline'), {'data': 1})
            self.assertEqual(fetch_upstream_text('https://youzhiyouxing.cn/data', 'temperature'), '{"data": 1}')
        self.assertEqual(observed, [('http://127.0.0.1:1111', 12), ('http://127.0.0.1:2222', 12)])

    def test_diagnostics_preserve_failure_type_without_sensitive_messages(self):
        error = URLError(ConnectionRefusedError(errno.ECONNREFUSED, 'private credential'))
        fields = upstream_error_fields(error)
        self.assertEqual(fields['reason_type'], 'ConnectionRefusedError')
        self.assertEqual(fields['errno'], errno.ECONNREFUSED)
        self.assertNotIn('private credential', str(fields))
        self.assertEqual(upstream_error_fields(HTTPError('https://example.com', 429, 'private', {}, None))['http_status'], 429)


if __name__ == '__main__':
    unittest.main()
