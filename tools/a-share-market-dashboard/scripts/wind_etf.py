"""Wind MCP ETF net creation/redemption collector, isolated from public sources."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import fcntl
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from threading import Lock, Thread
import time
from urllib.error import HTTPError
from urllib.request import Request, HTTPRedirectHandler, build_opener
from uuid import uuid4

try:
    from . import liquidity_config as config
except ImportError:
    import liquidity_config as config

ENDPOINT = 'https://mcp.wind.com.cn/vserver_wind_tools/mcp/'
SOURCE = 'Wind MCP · 沪深股票型ETF申赎净流入'
SOURCE_URL = 'https://www.wind.com.cn/'
FLOW_TOOL = 'fund_get_listed_historical_price'
FLOW_FIELD = 'f_mf_netsubamt'
QUERIES = ('全部上海证券交易所上市的股票型ETF', '全部深圳证券交易所上市的股票型ETF')
_LOCK = Lock()
_JOBS = set()


class WindETFError(Exception):
    """Only fixed diagnostic codes may leave the transport layer."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise WindETFError('redirect_refused')


def authorization(environ=None, config_path=None):
    environ = os.environ if environ is None else environ
    token = environ.get('WIND_API_KEY', '').strip()
    if token:
        return token if token.startswith('Bearer ') else 'Bearer ' + token
    path = Path(config_path) if config_path else Path.home() / '.codex' / 'config.toml'
    try:
        try:
            import tomllib
        except ImportError:
            try:
                import tomli as tomllib
            except ImportError:
                # The existing macOS Python 3.9 runtime bundles this TOML reader.
                from pip._vendor import tomli as tomllib
        config = tomllib.loads(path.read_text(encoding='utf-8'))['mcp_servers']['wind-tools']
        env_name = config.get('bearer_token_env_var')
        if env_name and environ.get(env_name):
            return 'Bearer ' + environ[env_name].strip()
        header = config.get('http_headers', {}).get('Authorization', '')
        if header.startswith('Bearer ') and header[7:].strip():
            return header
    except Exception:
        pass
    raise WindETFError('credentials_missing')


def decode_rpc(raw, request_id):
    try:
        if raw.lstrip().startswith('{'):
            candidates = [json.loads(raw)]
        else:
            candidates = []
            for event in raw.replace('\r\n', '\n').split('\n\n'):
                data = '\n'.join(line[5:].lstrip() for line in event.splitlines() if line.startswith('data:'))
                if data:
                    candidates.append(json.loads(data))
        for payload in candidates:
            if payload.get('id') == request_id:
                if 'error' in payload:
                    raise WindETFError('rpc_error')
                return payload['result']
    except (ValueError, KeyError, TypeError, AttributeError):
        pass
    raise WindETFError('invalid_rpc_response')


class WindClient:
    def __init__(self, auth=None):
        if not config.WIND_ENABLED:
            raise WindETFError('disabled_by_user')
        self._auth = auth or authorization()
        self._session = None
        self._protocol = '2025-03-26'
        result = self.rpc('initialize', {'protocolVersion': self._protocol, 'capabilities': {},
                                       'clientInfo': {'name': 'liquidity-dashboard', 'version': '1.0'}})
        self._protocol = result.get('protocolVersion', self._protocol)
        self.rpc('notifications/initialized', {}, notification=True)

    def rpc(self, method, params, notification=False):
        if not config.WIND_ENABLED:
            raise WindETFError('disabled_by_user')
        if method == 'tools/call':
            # One account is shared by ETF workers and the other dashboard collectors.
            rate_path = Path(__file__).resolve().parents[1] / 'data' / 'Wind' / 'request.lock'
            rate_path.parent.mkdir(parents=True, exist_ok=True)
            with rate_path.open('a+', encoding='utf-8') as guard:
                fcntl.flock(guard, fcntl.LOCK_EX)
                guard.seek(0)
                try:
                    previous = float(guard.read() or 0)
                except ValueError:
                    previous = 0
                time.sleep(max(0, min(1.3, previous + 1.3 - time.time())))
                guard.seek(0)
                guard.truncate()
                guard.write(str(time.time()))
                guard.flush()
        request_id = uuid4().hex
        body = {'jsonrpc': '2.0', 'method': method, 'params': params}
        if not notification:
            body['id'] = request_id
        headers = {'Authorization': self._auth, 'Accept': 'application/json, text/event-stream',
                   'Content-Type': 'application/json', 'MCP-Protocol-Version': self._protocol}
        if self._session:
            headers['Mcp-Session-Id'] = self._session
        try:
            request = Request(ENDPOINT, data=json.dumps(body, ensure_ascii=False).encode('utf-8'), headers=headers)
            with build_opener(NoRedirect()).open(request, timeout=30) as response:
                if method == 'initialize':
                    self._session = response.headers.get('Mcp-Session-Id')
                if notification:
                    return None
                raw = response.read(8_000_001)
                if len(raw) > 8_000_000:
                    raise WindETFError('response_too_large')
                return decode_rpc(raw.decode('utf-8'), request_id)
        except HTTPError as error:
            raise WindETFError('authorization_failed' if error.code in (401, 403) else
                               'rate_limited' if error.code == 429 else 'http_error') from None
        except WindETFError:
            raise
        except Exception:
            raise WindETFError('transport_error') from None

    def call(self, tool_name, arguments):
        if tool_name not in ('fund_screener', FLOW_TOOL, 'fund_get_basic_info',
                             'economic_get_indicator_series', 'get_index_kline', 'get_index_fundamentals'):
            raise WindETFError('unsupported_tool')
        credit_path = Path(__file__).resolve().parents[1] / 'data' / 'Wind' / 'credits.json'
        if time.time() - read_json(credit_path).get('failedAtEpoch', 0) < 3600:
            raise WindETFError('credits_exhausted')
        result = self.rpc('tools/call', {'name': 'market_call_tool', 'arguments': {
            'toolName': tool_name, 'arguments': json.dumps(arguments, ensure_ascii=False)}})
        if result.get('isError'):
            code = result.get('structuredContent', {}).get('code')
            if code == 402:
                write_json(credit_path, {'failedAtEpoch': time.time(), 'error': 'credits_exhausted'})
                raise WindETFError('credits_exhausted')
            raise WindETFError('rate_limited' if code == 429 else 'upstream_unavailable')
        text = '\n'.join(item.get('text', '') for item in result.get('content', []) if item.get('type') == 'text')
        if not text:
            raise WindETFError('empty_result')
        return text


def table_rows(text, required_headers):
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith('|')]
    if len(lines) < 2:
        raise WindETFError('invalid_table')
    headers = [cell.strip() for cell in lines[0].strip('|').split('|')]
    if not set(required_headers).issubset(headers):
        raise WindETFError('unexpected_fields')
    rows = []
    for line in lines[2:]:
        cells = [cell.strip() for cell in line.strip('|').split('|')]
        if len(cells) != len(headers):
            raise WindETFError('invalid_table')
        rows.append(dict(zip(headers, cells)))
    return rows


def parse_universe(text, exchange):
    total = re.search(r'查到\s*([\d,]+)\s*条基金数据', text)
    rows = table_rows(text, ['基金代码', '基金简称', '基金成立日'])
    if not total or '超出展示上限' in text or int(total[1].replace(',', '')) != len(rows) or not rows:
        raise WindETFError('universe_truncated')
    codes = []
    for row in rows:
        code = row['基金代码']
        prefix = '5' if exchange == 'SH' else '1'
        if not re.fullmatch(prefix + r'\d{5}\.(OF|' + exchange + r')', code):
            raise WindETFError('unexpected_fund_code')
        codes.append(code)
    if len(codes) != len(set(codes)):
        raise WindETFError('duplicate_fund_code')
    return codes


def parse_flows(text, requested, latest_allowed):
    if '均无行情数据' in text:
        raise WindETFError('no_data')
    actual = re.search(r'已返回[^\n]*?\s(\d{4}-\d{2}-\d{2})\s*的行情数据', text)
    if not actual or date.fromisoformat(actual[1]) > latest_allowed:
        raise WindETFError('invalid_trade_date')
    rows = table_rows(text, ['基金代码', '申赎净流入额（元）'])
    values, missing = {}, []
    for row in rows:
        code = row['基金代码']
        if code not in requested or code in values or code in missing:
            raise WindETFError('unexpected_fund_code')
        try:
            value = Decimal(row['申赎净流入额（元）'].replace(',', ''))
            if not value.is_finite():
                raise InvalidOperation
            values[code] = value
        except InvalidOperation:
            missing.append(code)
    missing.extend(sorted(set(requested) - set(values) - set(missing)))
    return actual[1], values, missing


def not_yet_listed(client, codes, actual):
    excluded = []
    for start in range(0, len(codes), 50):
        group = codes[start:start + 50]
        text = client.call('fund_get_basic_info', {'windCodes': group, 'includeFields': ['f_info_loflisteddate']})
        rows = table_rows(text, ['基金代码', '上市日期'])
        seen = set()
        for row in rows:
            code = row['基金代码']
            if code not in group or code in seen:
                raise WindETFError('unexpected_fund_code')
            seen.add(code)
            try:
                listed = date.fromisoformat(row['上市日期'])
            except ValueError:
                continue
            if listed > date.fromisoformat(actual):
                excluded.append({'code': code, 'listedDate': listed.isoformat()})
    return excluded


def read_json(path):
    try:
        result = json.loads(path.read_text(encoding='utf-8'))
        return result if isinstance(result, dict) else {}
    except (OSError, ValueError):
        return {}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid4().hex + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def fetch_universe(client, root, today):
    cached = read_json(root / 'universe.json')
    if cached.get('date') == today.isoformat() and cached.get('queries') == list(QUERIES) and cached.get('codes'):
        return cached['codes']
    codes = []
    for query, exchange in zip(QUERIES, ('SH', 'SZ')):
        codes.extend(parse_universe(client.call('fund_screener', {'query': query}), exchange))
    if len(codes) != len(set(codes)):
        raise WindETFError('duplicate_fund_code')
    write_json(root / 'universe.json', {'date': today.isoformat(), 'queries': list(QUERIES), 'codes': codes})
    return codes


def collect_day(client, codes, requested_date, progress, checkpoint_dir=None):
    batches = [codes[i:i + 50] for i in range(0, len(codes), 50)]
    def batch(group, day):
        path = None
        if checkpoint_dir:
            digest = sha256(','.join(group).encode()).hexdigest()[:20]
            path = Path(checkpoint_dir) / (day.isoformat() + '-' + digest + '.json')
            cached = read_json(path)
            if (cached.get('codes') == group and cached.get('requestedDate') == day.isoformat()
                    and 0 <= time.time() - cached.get('fetchedAtEpoch', 0) < 3600):
                return parse_flows(cached['text'], group, day)
        for attempt in range(3):
            try:
                text = client.call(FLOW_TOOL, {'windCodes': group, 'includeFields': [FLOW_FIELD],
                                              'tradeDate': day.isoformat()})
                parsed = parse_flows(text, group, day)
                if path and not parsed[2]:
                    write_json(path, {'codes': group, 'requestedDate': day.isoformat(),
                                      'fetchedAtEpoch': time.time(), 'text': text})
                return parsed
            except WindETFError as error:
                if str(error) not in ('upstream_unavailable', 'transport_error', 'http_error') or attempt == 2:
                    raise
                time.sleep(.5 * (attempt + 1))
    # Discover the actual common date before dispatching the remaining batches.
    for offset in range(15):
        try:
            actual, values, missing = batch(batches[0], requested_date - timedelta(days=offset))
            break
        except WindETFError as error:
            if str(error) != 'no_data' or offset == 14:
                raise
    completed = 1
    progress(actual, completed, len(batches), len(values), len(codes))
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(batch, group, date.fromisoformat(actual)) for group in batches[1:]]
        for future in as_completed(futures):
            day, group_values, group_missing = future.result()
            if day != actual:
                raise WindETFError('mixed_trade_dates')
            values.update(group_values)
            missing.extend(group_missing)
            completed += 1
            progress(actual, completed, len(batches), len(values), len(codes))
    excluded = not_yet_listed(client, missing, actual) if missing else []
    eligible = len(codes) - len(excluded)
    if len(excluded) != len(missing) or not eligible or len(values) != eligible:
        raise WindETFError('coverage_incomplete')
    progress(actual, completed, len(batches), len(values), eligible)
    total = sum(values.values(), Decimal(0)) / Decimal('100000000')
    coverage = {'date': actual, 'received': len(values), 'expected': eligible,
                'screened': len(codes), 'excludedNotListed': excluded}
    return {'date': actual, 'value': float(total)}, coverage, values


ERROR_MESSAGES = {
    'credits_exhausted': 'Wind账户积分不足（402），恢复积分后重试。',
    'rate_limited': 'Wind请求过于频繁，请稍后重试。',
    'credentials_missing': '未读到Wind凭证；可设置WIND_API_KEY或检查现有Codex Wind配置。',
    'authorization_failed': 'Wind鉴权失败，请检查密钥与数据权限。',
    'universe_truncated': 'Wind基金名单被截断或数量不一致，未生成市场合计。',
    'coverage_incomplete': '部分ETF申赎数据缺失，未用缺项小计替代市场合计。',
    'mixed_trade_dates': 'Wind各批次实际交易日不一致，未合并。',
}


def refresh_etf(root, today, client_factory=WindClient, scheduled=False):
    """Serialize UI and scheduled processes; one scheduled attempt per Shanghai day."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with (root / 'refresh.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {'skipped': 'running'}
        state = read_json(root / 'status.json')
        if scheduled and state.get('scheduledAttemptDate') == today.isoformat():
            return {'skipped': 'already_attempted_today'}
        _refresh_etf(root, today, client_factory, scheduled)
        return read_json(root / 'status.json')


def refresh_is_running(root):
    path = Path(root) / 'refresh.lock'
    if not path.exists():
        return False
    with path.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
    return False


def _refresh_etf(root, today, client_factory, scheduled):
    root = Path(root)
    start = time.time()
    previous_state = read_json(root / 'status.json')
    state = {'running': True, 'startedEpoch': start, 'lastAttemptEpoch': start,
             'message': '正在取得Wind股票型ETF名单', 'completedBatches': 0, 'totalBatches': 0,
             'scheduledAttemptDate': today.isoformat() if scheduled else previous_state.get('scheduledAttemptDate')}
    write_json(root / 'status.json', state)
    def progress(day, completed, total, received, expected):
        state.update({'message': '正在读取Wind申赎数据', 'date': day, 'completedBatches': completed,
                      'totalBatches': total, 'received': received, 'expected': expected})
        write_json(root / 'status.json', state)
    try:
        client = client_factory()
        codes = fetch_universe(client, root, today)
        current = read_json(root / 'series.json')
        points = {p['date']: p for p in current.get('points', [])}
        coverages = current.get('dailyCoverage', {})
        requested = today
        # Seed the latest and previous observation. Further history accumulates
        # from dated universes; do not backfill 60 days with today's survivor list.
        for _ in range(2 if len(points) < 2 else 1):
            point, coverage, values = collect_day(client, codes, requested, progress, root / 'batches')
            coverage['universeDate'] = today.isoformat()
            points[point['date']] = point
            coverages[point['date']] = coverage
            ordered = [points[d] for d in sorted(points)[-500:]]
            current = {'id': 'cn_etf_flow', 'unit': '亿元', 'scope': '沪深股票型ETF',
                       'basis': 'net_creation_redemption', 'transport': 'wind-mcp', 'source': SOURCE,
                       'sourceUrl': SOURCE_URL, 'points': ordered, 'dailyCoverage': coverages,
                       'fetchedAtEpoch': time.time(), 'fetchedAt': datetime.now(timezone.utc).isoformat()}
            write_json(root / 'series.json', current)
            write_json(root / ('constituents-' + point['date'] + '.json'), {
                'date': point['date'], 'universeDate': today.isoformat(), 'field': FLOW_FIELD, 'unit': '元',
                'values': {code: str(value) for code, value in values.items()}})
            requested = date.fromisoformat(point['date']) - timedelta(days=1)
        state.update({'running': False, 'message': 'Wind申赎数据已更新', 'error': '', 'finishedEpoch': time.time()})
        # Checkpoints resume failed jobs only. A later explicit refresh must ask
        # Wind again, including any same-day corrections to published amounts.
        for checkpoint in (root / 'batches').glob('*.json'):
            checkpoint.unlink()
    except Exception as error:
        code = str(error) if isinstance(error, WindETFError) else 'internal_error'
        message = ERROR_MESSAGES.get(code, 'Wind取数未完成；保留上次完整数据，请稍后刷新。')
        state.update({'running': False, 'message': message, 'error': code,
                      'finishedEpoch': time.time()})
    finally:
        write_json(root / 'status.json', state)


def etf_snapshot(cache_dir, force=False, today=None):
    if not config.WIND_ENABLED:
        return disabled_etf()
    today = today or datetime.now(timezone(timedelta(hours=8))).date()
    root = Path(cache_dir) / 'wind-etf'
    key = str(root.resolve())
    with _LOCK:
        current, state = read_json(root / 'series.json'), read_json(root / 'status.json')
        elapsed = time.time() - state.get('lastAttemptEpoch', 0)
        external_running = refresh_is_running(root)
        if force and key not in _JOBS and not external_running and elapsed >= 3:
            _JOBS.add(key)
            state = {**state, 'running': True, 'error': '', 'message': '正在连接Wind MCP', 'lastAttemptEpoch': time.time()}
            write_json(root / 'status.json', state)
            def work():
                try:
                    refresh_etf(root, today)
                finally:
                    with _LOCK:
                        _JOBS.discard(key)
            Thread(target=work, name='wind-etf-refresh', daemon=True).start()
        elif state.get('running') and key not in _JOBS and not external_running:
            state = {**state, 'running': False, 'error': 'interrupted', 'message': '上次Wind更新中断，请点击刷新重试。'}
    points = current.get('points', [])
    latest = points[-1]['date'] if points else None
    status = 'missing' if not points else 'stale' if state.get('error') else 'ok'
    return {**current, 'points': points, 'status': status, 'cached': bool(points), 'transport': 'wind-mcp',
            'coverage': current.get('dailyCoverage', {}).get(latest), 'refresh': state,
            'error': state.get('message', '尚无已完成更新；每天09:00自动取数，也可手动刷新。') if state.get('error') or not points else ''}


def disabled_etf():
    return {'id': 'cn_etf_flow', 'points': [], 'unit': '亿元', 'source': '待接入非Wind数据源',
            'status': 'missing', 'transport': 'disabled', 'cached': False,
            'error': '已停用Wind；ETF申赎尚无替代来源，不展示原Wind缓存。'}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='更新ETF申赎数据；定时模式每天只尝试一次。')
    parser.add_argument('--scheduled', action='store_true', help='使用北京时间每日一次保护')
    args = parser.parse_args()
    if not config.WIND_ENABLED:
        print(json.dumps({'status': 'disabled', 'message': 'Wind已按用户要求停用'}, ensure_ascii=False))
        raise SystemExit(0)
    root = Path(__file__).resolve().parents[1] / 'data' / '资金面日报' / 'cache' / 'wind-etf'
    today = datetime.now(timezone(timedelta(hours=8))).date()
    result = refresh_etf(root, today, scheduled=args.scheduled)
    current = read_json(root / 'series.json')
    print(json.dumps({'status': result, 'dataDate': (current.get('points') or [{}])[-1].get('date'),
                      'updatedAt': current.get('fetchedAt')}, ensure_ascii=False))
    raise SystemExit(1 if result.get('error') else 0)
