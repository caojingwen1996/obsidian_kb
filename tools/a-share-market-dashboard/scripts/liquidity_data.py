"""Public-data adapters and per-series last-success cache for liquidity reports."""

from concurrent.futures import Future, ThreadPoolExecutor
import csv
from datetime import date, datetime, timedelta, timezone
from io import StringIO
import json
import re
from pathlib import Path
from threading import Lock
import time
from urllib.parse import urlencode
from urllib.request import Request, build_opener
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    from . import liquidity_config as config
    from .liquidity_signals import normalize_points, build_report
    from .liquidity_monitor import build_funding_monitor, monitor_adapters, MONITOR_UNITS, observation
    from .wind_etf import etf_snapshot, disabled_etf
except ImportError:
    import liquidity_config as config
    from liquidity_signals import normalize_points, build_report
    from liquidity_monitor import build_funding_monitor, monitor_adapters, MONITOR_UNITS, observation
    from wind_etf import etf_snapshot, disabled_etf

SERIES_UNITS = {'us_DGS10': '%', 'us_DGS2': '%', 'us_VIX': '点', 'us_RRP': '十亿美元',
                'us_WALCL': '十亿美元', 'us_DXY_HISTORY': '指数', 'us_SP500': '点',
                'cn_margin': '亿元', 'cn_flow': '亿元', 'cn_shibor': '%',
                'cn_south': '亿元', 'cn_CSI300': '点', 'us_DXY': '指数'}
SERIES_UNITS.update(MONITOR_UNITS)
_REPORT_LOCK = Lock()
_LAST_REPORT = {}


def closed_daily_points(points, market, now=None):
    now = now or datetime.now(timezone.utc)
    zone, closing = {'cn': ('Asia/Shanghai', (15, 15)), 'hk': ('Asia/Hong_Kong', (16, 15)),
                     'us': ('America/New_York', (16, 15)), 'fx': ('America/New_York', (17, 15))}[market]
    try:
        local = now.astimezone(ZoneInfo(zone))
    except ZoneInfoNotFoundError:
        # Conservative US winter close if the OS lacks the timezone database.
        local = now.astimezone(timezone(timedelta(hours=-5 if market in ('us', 'fx') else 8)))
    cutoff = local.date() if (local.hour, local.minute) >= closing else local.date() - timedelta(days=1)
    return [point for point in points if str(point['date'])[:10] <= cutoff.isoformat()]


def request_text(url):
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*',
                                  'Referer': 'https://finance.sina.com.cn/' if 'sinajs.cn/' in url else url})
    with build_opener().open(request, timeout=config.REQUEST_TIMEOUT_SECONDS) as response:
        content = response.read(8_000_001)
        if len(content) > 8_000_000:
            raise ValueError('response_too_large')
        return content.decode('gb18030' if 'sinajs.cn/' in url else 'utf-8-sig')


def shared_fetch(fetch):
    """Share identical requests within one refresh, including in-flight failures."""
    pending, lock = {}, Lock()
    def get(url):
        with lock:
            owner = url not in pending
            future = pending.setdefault(url, Future())
        if owner:
            try:
                future.set_result(fetch(url))
            except Exception as error:
                future.set_exception(error)
        return future.result()
    return get


def fred_series(symbol, scale=1, fetch=request_text, today=None):
    start = (today or date.today()) - timedelta(days=550)
    url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?' + urlencode({'id': symbol, 'cosd': start.isoformat()})
    rows = csv.DictReader(StringIO(fetch(url)))
    points = []
    for row in rows:
        raw = row.get(symbol)
        if raw and raw != '.':
            points.append({'date': row.get('DATE') or row.get('observation_date'), 'value': float(raw) * scale})
    return points, 'FRED · ' + symbol, 'https://fred.stlouisfed.org/series/' + symbol


def eastmoney(report, sort, filters='', fetch=request_text, size=320):
    params = {'reportName': report, 'columns': 'ALL', 'pageSize': size, 'pageNumber': 1,
              'sortColumns': sort, 'sortTypes': -1}
    if filters: params['filter'] = filters
    url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?' + urlencode(params)
    payload = json.loads(fetch(url))
    rows = (payload.get('result') or {}).get('data')
    if not rows: raise ValueError('empty_eastmoney_response')
    return rows


def field_points(rows, day, field, scale=1):
    return [{'date': r[day][:10], 'value': float(r[field]) * scale}
            for r in rows if r.get(day) and r.get(field) is not None]


def bond_series(years, fetch=request_text):
    rows = eastmoney('RPTA_WEB_TREASURYYIELD', 'SOLAR_DATE', fetch=fetch)
    field = 'EMG00001310' if years == 10 else 'EMG00001306'
    return field_points(rows, 'SOLAR_DATE', field), '东财 · 美国国债收益率', 'https://data.eastmoney.com/cjsj/zmgzsyl.html'


def vix_series(fetch=request_text):
    url = 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'
    rows = csv.DictReader(StringIO(fetch(url)))
    points = [{'date': datetime.strptime(r['DATE'], '%m/%d/%Y').date().isoformat(), 'value': r['CLOSE']} for r in rows]
    return points, 'CBOE · VIX 收盘', url


def rrp_series(fetch=request_text, today=None):
    today = today or date.today()
    url = 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?' + urlencode({
        'startDate': (today - timedelta(days=120)).isoformat(), 'endDate': today.isoformat()})
    rows = json.loads(fetch(url))['repo']['operations']
    totals = {}
    for row in rows:
        day = row['operationDate'][:10]
        totals[day] = totals.get(day, 0) + float(row['totalAmtAccepted']) / 1e9
    return [{'date': d, 'value': v} for d, v in totals.items()], '纽约联储 · 隔夜逆回购', url


def margin_series(fetch=request_text):
    rows = eastmoney('RPTA_RZRQ_LSHJ', 'DIM_DATE', fetch=fetch)
    return field_points(rows, 'DIM_DATE', 'RZYE', 1e-8), '东财 · 沪深融资余额', 'https://data.eastmoney.com/rzrq/'


def shibor_series(fetch=request_text):
    rows = eastmoney('RPT_IMP_INTRESTRATEN', 'REPORT_DATE',
                    '(MARKET_CODE="001")(CURRENCY_CODE="CNY")(INDICATOR_ID="001")', fetch)
    return field_points(rows, 'REPORT_DATE', 'IR_RATE'), '东财转发 · Shibor 隔夜', 'https://data.eastmoney.com/shibor/shibor.aspx'


def south_series(fetch=request_text):
    rows = eastmoney('RPT_MUTUAL_DEAL_HISTORY', 'TRADE_DATE', '(MUTUAL_TYPE in ("002","004"))', fetch)
    by_day = {}
    for row in rows:
        if row.get('NET_DEAL_AMT') is not None:
            by_day.setdefault(row['TRADE_DATE'][:10], {})[row['MUTUAL_TYPE']] = float(row['NET_DEAL_AMT']) / 100
    points = [{'date': d, 'value': sum(v.values())} for d, v in by_day.items() if set(v) == {'002', '004'}]
    return closed_daily_points(points, 'hk'), '东财 · 沪深港通南向净买入', 'https://data.eastmoney.com/hsgt/index.html'


def csi_series(fetch=request_text):
    url = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?' + urlencode({'param': 'sh000300,day,,,400,qfq'})
    node = json.loads(fetch(url))['data']['sh000300']
    rows = node.get('day') or node.get('qfqday') or []
    return closed_daily_points([{'date': r[0], 'value': r[2]} for r in rows], 'cn'), '腾讯行情 · 沪深300日收盘', 'https://gu.qq.com/sh000300/zs'


def spx_stooq(fetch=request_text):
    url = 'https://stooq.com/q/d/l/?s=%5Espx&i=d'
    rows = csv.DictReader(StringIO(fetch(url)))
    return closed_daily_points([{'date': r['Date'], 'value': r['Close']} for r in rows], 'us'), 'Stooq · S&P 500日收盘', 'https://stooq.com/q/?s=%5Espx'


def spx_sina(fetch=request_text):
    url = 'https://stock.finance.sina.com.cn/usstock/api/jsonp.php/var%20data=/US_MinKService.getDailyK?symbol=.INX'
    text = fetch(url)
    match = re.search(r'var data=\((\[.*\])\);?\s*$', text, re.S)
    if not match: raise ValueError('invalid_sina_daily_response')
    rows = json.loads(match.group(1))
    return closed_daily_points([{'date': r['d'], 'value': r['c']} for r in rows], 'us'), '新浪 · 标普500日收盘', 'https://finance.sina.com.cn/stock/usstock/US100.shtml'


def dxy_sina(fetch=request_text):
    text = fetch('https://hq.sinajs.cn/list=DINIW')
    match = re.search(r'hq_str_DINIW="([^"]+)"', text)
    if not match: raise ValueError('invalid_sina_dxy_response')
    fields = match.group(1).split(',')
    return [{'date': fields[10], 'value': fields[1]}], '新浪 · 美元指数DXY盘中', 'https://finance.sina.com.cn/money/forex/hq/DINIW.shtml'


def dxy_history_sina(fetch=request_text):
    url = 'https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20_data=/NewForexService.getDayKLine?symbol=DINIW'
    match = re.search(r'var _data=\((".*")\);?\s*$', fetch(url), re.S)
    if not match: raise ValueError('invalid_dxy_history')
    rows = [row.split(',') for row in json.loads(match.group(1)).split('|') if row]
    points = [{'date': row[0], 'value': row[4]} for row in rows if len(row) >= 5]
    return closed_daily_points(points, 'fx'), '新浪 · 美元指数DXY日收盘', 'https://finance.sina.com.cn/money/forex/hq/DINIW.shtml'


def free_adapters(fetch=request_text, today=None):
    return {
        'us_DGS10': [lambda: fred_series('DGS10', fetch=fetch, today=today), lambda: bond_series(10, fetch)],
        'us_DGS2': [lambda: fred_series('DGS2', fetch=fetch, today=today), lambda: bond_series(2, fetch)],
        'us_VIX': [lambda: vix_series(fetch), lambda: fred_series('VIXCLS', fetch=fetch, today=today)],
        'us_RRP': [lambda: rrp_series(fetch, today), lambda: fred_series('RRPONTSYD', fetch=fetch, today=today)],
        'us_WALCL': [lambda: fred_series('WALCL', .001, fetch, today)],
        'us_DXY_HISTORY': [lambda: dxy_history_sina(fetch)],
        'us_SP500': [lambda: spx_sina(fetch), lambda: fred_series('SP500', fetch=fetch, today=today), lambda: spx_stooq(fetch)],
        'us_DXY': [lambda: dxy_sina(fetch)],
        'cn_margin': [lambda: margin_series(fetch)],
        'cn_shibor': [lambda: shibor_series(fetch)], 'cn_south': [lambda: south_series(fetch)],
        'cn_CSI300': [lambda: csi_series(fetch)],
    }


def read_cache(path):
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
        return value if isinstance(value, dict) and isinstance(value.get('points'), list) else {}
    except (OSError, ValueError):
        return {}


def load_series(key, adapters, cache_dir, force=False, today=None, expected_source=None):
    path = cache_dir / (key + '.json')
    cached = read_cache(path)
    if key in {'cn_margin_ratio', 'cn_south'} and expected_source == 'Tushare ' and not cached.get('source', '').startswith(expected_source):
        cached = {}
    if key in {'cn_flow', 'cn_super_flow', 'cn_small_flow'} and expected_source == 'AKShare ' and not cached.get('source', '').startswith(expected_source):
        cached = {}
    if not config.WIND_ENABLED and str(cached.get('source', '')).lower().startswith('wind'):
        cached = {}
    ttl = 60 if cached.get('status') in ('missing', 'stale') else config.CACHE_TTL_SECONDS
    if cached and (expected_source is None or cached.get("source", "").startswith(expected_source)) and not force and 0 <= time.time() - cached.get('lastAttemptEpoch', cached.get('fetchedAtEpoch', 0)) < ttl:
        return {**cached, 'cached': bool(cached.get('points')), 'status': cached.get('status', 'ok')}
    failures = []
    for adapter in adapters:
        try:
            response = adapter()
            metadata = {}
            if isinstance(response, dict):
                if response.get('unit') != SERIES_UNITS[key] or not response.get('source', '').startswith('Wind '):
                    raise ValueError('invalid_wind_series')
                rows, source, source_url = response['points'], response['source'], response['sourceUrl']
                metadata = {key: response.get(key) for key in ('status', 'error', 'fetchedAt', 'importedAt')}
            else:
                rows, source, source_url = response
            if not config.WIND_ENABLED and str(source).lower().startswith('wind'):
                raise ValueError('wind_disabled')
            points = normalize_points(rows, today)
            if not points: raise ValueError('empty_series')
            # The breadth page exposes only its current dated snapshot. Accumulate
            # observations without presenting the first capture as a full history.
            if key.startswith('cn_breadth_') and cached.get('source') == source:
                points = normalize_points(cached.get('points', []) + points, today)
            result = {'id': key, 'unit': SERIES_UNITS[key], 'points': points[-500:], 'source': source,
                      'sourceUrl': source_url, 'fetchedAt': datetime.now(timezone.utc).isoformat(),
                      'fetchedAtEpoch': time.time(), **metadata}
            cache_dir.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix('.tmp')
            temporary.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding='utf-8')
            temporary.replace(path)
            return {'status': 'ok', **result, 'cached': bool(metadata)}
        except Exception as error:
            # Fixed diagnostics never serialize response bodies or credential-bearing exception messages.
            failures.append('AKShare东方财富接口暂不可用' if type(error).__name__ == 'AKShareUnavailable' else
                            'Wind账户积分不足（402）' if type(error).__name__ == 'WindETFError' and str(error) == 'credits_exhausted' else type(error).__name__)
    failed = {**cached, 'id': key, 'points': cached.get('points', []), 'cached': bool(cached.get('points')),
              'status': 'stale' if cached.get('points') else 'missing', 'lastAttemptEpoch': time.time(),
              'error': '取数失败（' + ' / '.join(failures) + '）；可稍后刷新'}
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(failed, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        temporary.replace(path)
    except OSError:
        pass
    return failed


def wind_fetch_all(cache_dir, today=None):
    """Import normalized Wind snapshots. Never read MCP secrets or call tools from the browser."""
    result = {}
    for key, unit in SERIES_UNITS.items():
        cached = read_cache(cache_dir / 'wind' / (key + '.json'))
        valid = cached.get('id') == key and cached.get('unit') == unit and bool(cached.get('source'))
        if key == 'cn_etf_flow':
            valid = valid and cached.get('scope') == '沪深股票型ETF' and cached.get('basis') == 'net_creation_redemption'
        points = normalize_points(cached.get('points', []), today) if valid else []
        result[key] = {**cached, 'points': points, 'cached': True, 'status': 'ok' if points else 'missing',
                       'error': '' if points else '尚未导入符合口径的 Wind 数据'}
    return result


def etf_metric(raw, today=None):
    if raw.get('transport') == 'tushare-python':
        try:
            from .etf_estimate import RULE
        except ImportError:
            from etf_estimate import RULE
        name = 'ETF申赎净流入（估算）' if raw.get('complete') else 'ETF申赎净流入（样本估算）'
        metric = observation('cn_etf_flow', name, RULE, {'cn_etf_flow': raw}, today or date.today())
        metric.update(previous=None, percentile=None, sampleCount=0, excluded=raw.get('excluded', []), estimate=True)
        return metric
    rule = ('Wind按沪深交易所筛选股票型ETF（包含股票型分类下的港股通产品），'
            '汇总同日申赎净流入额；所有基金返回完整数值才生成合计，元换算为亿元。历史按观测日逐步累积。')
    if not config.WIND_ENABLED:
        rule = '沪深股票型ETF申赎净流入；尚无替代来源，不用成交额或价格变化替代。'
    return observation('cn_etf_flow', 'ETF配置盘', rule, {'cn_etf_flow': raw}, today or date.today())


def read_etf_metric(cache_dir, today=None):
    if config.ETF_ESTIMATE_ENABLED:
        try:
            from .etf_estimate import read_estimate
        except ImportError:
            from etf_estimate import read_estimate
        return etf_metric(read_estimate(cache_dir), today)
    return etf_metric(etf_snapshot(cache_dir, today=today) if config.WIND_ENABLED else disabled_etf(), today)


def liquidity_snapshot(cache_dir=None, force=False, provider=None, fetch=request_text, today=None):
    cache_dir = Path(cache_dir or Path(__file__).resolve().parents[1] / 'data' / '资金面日报' / 'cache')
    provider = provider or config.DATA_PROVIDER
    if provider not in ('free', 'wind', 'tushare'): raise ValueError('unsupported_liquidity_provider')
    if provider == 'wind' and not config.WIND_ENABLED: raise ValueError('wind_disabled')
    key = (str(cache_dir), provider)
    if config.ETF_ESTIMATE_ENABLED:
        try:
            from .etf_estimate import estimate_snapshot
        except ImportError:
            from etf_estimate import estimate_snapshot
        etf = estimate_snapshot(cache_dir, force, today)
    else:
        etf = (etf_snapshot(cache_dir, force, today) if config.WIND_ETF_ENABLED else None) if config.WIND_ENABLED else disabled_etf()
    def attach_etf(report):
        if etf is None:
            return report
        existing = report['fundingMonitor']
        metric = etf_metric(etf, today)
        return {**report, 'fundingMonitor': {**existing, 'cards': [metric if item['id'] == 'cn_etf_flow' else item
                                                                 for item in existing['cards']]}}
    with _REPORT_LOCK:
        previous = _LAST_REPORT.get(key)
        # Suppress duplicate in-flight refreshes and rapid retries of failing upstream services.
        if previous and time.monotonic() - previous[0] < (3 if force else 30):
            return attach_etf(previous[1])
        started = time.monotonic()
        if provider == 'wind':
            series = wind_fetch_all(cache_dir, today)
        else:
            fetch = shared_fetch(fetch)
            adapters = free_adapters(fetch, today)
            adapters.update(monitor_adapters(fetch, eastmoney, closed_daily_points, cache_dir, today))
            migrated = {}
            if provider == 'tushare':
                try:
                    from .shared_market_data import liquidity_adapters
                except ImportError:
                    from shared_market_data import liquidity_adapters
                migrated = liquidity_adapters(today)
                adapters.update(migrated)
            wind_migrated = {}
            if provider == 'tushare' and config.WIND_ENABLED:
                try:
                    from .wind_data import liquidity_adapters as wind_adapters
                except ImportError:
                    from wind_data import liquidity_adapters as wind_adapters
                wind_migrated = wind_adapters(today, force)
                adapters.update(wind_migrated)
            yahoo_migrated = {}
            if provider == 'tushare':
                try:
                    from .yahoo_data import liquidity_adapters as yahoo_adapters
                except ImportError:
                    from yahoo_data import liquidity_adapters as yahoo_adapters
                yahoo_migrated = yahoo_adapters()
                adapters.update(yahoo_migrated)
            if etf is not None:
                adapters.pop('cn_etf_flow', None)
            with ThreadPoolExecutor(max_workers=12) as pool:
                futures = {name: pool.submit(load_series, name, choices, cache_dir, force, today,
                           "Yahoo Finance " if name in yahoo_migrated else "Wind " if name in wind_migrated else "Tushare " if name in migrated else "AKShare " if name in {'cn_flow', 'cn_super_flow', 'cn_small_flow'} else None)
                           for name, choices in adapters.items()}
                series = {name: task.result() for name, task in futures.items()}
        report = build_report(series, today)
        report['fundingMonitor'] = build_funding_monitor(series, today)
        report.update({'provider': provider, 'fetchedAt': datetime.now(timezone.utc).isoformat(),
                       'elapsedSeconds': round(time.monotonic() - started, 2)})
        _LAST_REPORT[key] = (time.monotonic(), report)
        return attach_etf(report)


if __name__ == '__main__':
    report = liquidity_snapshot()
    print(json.dumps({k: v for k, v in report.items() if k != 'metrics'}, ensure_ascii=False, indent=2))
    for metric in report['metrics']:
        print(metric['name'], metric['date'], metric['status'], metric['source'])
