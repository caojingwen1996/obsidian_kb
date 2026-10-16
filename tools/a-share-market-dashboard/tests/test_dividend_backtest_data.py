import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen
import zipfile

from scripts.local_proxy import create_server, read_dividend_backtest_data


class DividendBacktestDataTest(unittest.TestCase):
    def fixture(self, root, value='70', formula=''):
        directory = root / 'sources/automations/中证红利信号'
        directory.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(directory / '中证红利每日信号.xlsx', 'w') as package:
            package.writestr('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>原始字段</t></si></sst>')
            package.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>中文</t></is></c></row><row r="3"><c r="A3"><v>{value}</v></c><c r="C3">{formula}</c></row></sheetData></worksheet>')
        (directory / '中证红利指数日线.json').write_text(json.dumps({'data': [{'tradeDate': '20260105', 'close': 100}]}), encoding='utf-8')
        return directory

    def test_reads_current_file_each_time_without_writing_or_fetching(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.fixture(root)
            before = (directory / '中证红利每日信号.xlsx').read_bytes()
            data = read_dividend_backtest_data(root)
            self.assertEqual(data['rows'], [['原始字段'], ['中文'], ['70', None, None]])
            self.assertEqual(data['indexPoints'], [{'date': '2026-01-05', 'close': 100}])
            self.assertEqual((directory / '中证红利每日信号.xlsx').read_bytes(), before)
            self.fixture(root, value='80')
            self.assertEqual(read_dividend_backtest_data(root)['rows'][2][0], '80')

    def test_uncached_formula_and_invalid_archive_are_rejected(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.fixture(root, formula='<f>A3+1</f>')
            with self.assertRaisesRegex(ValueError, '计算缓存'):
                read_dividend_backtest_data(root)
            (directory / '中证红利每日信号.xlsx').write_bytes(b'corrupt')
            with self.assertRaises(zipfile.BadZipFile):
                read_dividend_backtest_data(root)

    def test_endpoint_rejects_path_parameters_and_reports_missing_files(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            dashboard = root / 'tools/dashboard/page.html'
            dashboard.parent.mkdir(parents=True)
            dashboard.write_text('<html></html>', encoding='utf-8')
            server = create_server(port=0, dashboard_path=dashboard)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_address[1]}/api/dividend-backtest-data'
            try:
                with urlopen(base, timeout=3) as response:
                    self.assertEqual(json.loads(response.read())['schemaVersion'], 1)
                with self.assertRaises(HTTPError) as invalid:
                    urlopen(base + '?path=/private/file', timeout=3)
                self.assertEqual(invalid.exception.code, 400)
                (root / 'sources/automations/中证红利信号/中证红利每日信号.xlsx').unlink()
                with self.assertRaises(HTTPError) as missing:
                    urlopen(base, timeout=3)
                self.assertEqual(missing.exception.code, 404)
            finally:
                server.shutdown(); server.server_close(); thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
