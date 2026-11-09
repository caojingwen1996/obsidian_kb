"""Fixed Wind MCP requests for the dashboard; callable by Python without an AI client."""

import argparse
from datetime import date, datetime, timedelta, timezone
import fcntl
import json
import math
from pathlib import Path
import threading
import time
from zoneinfo import ZoneInfo

try:
    from .wind_etf import WindClient, WindETFError, read_json, write_json, etf_snapshot, config
except ImportError:
    from wind_etf import WindClient, WindETFError, read_json, write_json, etf_snapshot, config

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data' / 'Wind' / 'cache'
URL = 'https://www.wind.com.cn/'
# code, label, source unit, output unit, multiplier, freshness allowance (days).
# The policy rate is an event series; its observation date is the last rate change.
SERIES = {
    'us_VIX': ('G0003892', 'VIX收盘', None, '点', 1, 7),
    'us_RRP': ('G1168931', '隔夜逆回购国债第一批次', '十亿美元', '十亿美元', 1, 7),
    'us_WALCL': ('G1100075', '联储总资产', '百万美元', '十亿美元', .001, 14),
    'cn_south': ('M0329522', '港股通当日净买入（人民币）', '亿元', '亿元', 1, 7),
    'pending-macro-0': ('M0039354', '实际GDP当季同比', '%', '%', 1, 180),
    'pending-macro-1': ('M0017126', '制造业PMI', '%', '点', 1, 75),
    'pending-macro-2': ('M5650805', '城镇调查失业率', '%', '%', 1, 75),
    'pending-macro-3': ('M0001428', '社会消费品零售同比（1—2月合并）', '%', '%', 1, 75),
    'pending-commodity-0': ('G0000027', '美国CPI未季调同比', '%', '%', 1, 75),
    'pending-commodity-1': ('G0000029', '美国核心CPI未季调同比', '%', '%', 1, 75),
    'pending-commodity-2': ('M0001227', '中国PPI同比', '%', '%', 1, 75),
    'pending-commodity-3': ('S5111926', '布伦特欧洲现货FOB', '美元/桶', '美元/桶', 1, 7),
    'pending-money-0': ('M0000162', '联邦基金目标利率上限（最近变更日）', '%', '%', 1, None),
    'pending-fiscal-0': ('G0003351', '美国月度财政赤字（盈余为负）', '百万美元', '亿美元', .01, 75),
    'pending-credit-0': ('M5525763', '社融存量同比', '%', '%', 1, 75),
    'pending-credit-1': ('M0009970', '人民币贷款余额同比', '%', '%', 1, 75),
    'pending-credit-3': ('M0002004', '商业银行不良贷款率', '%', '%', 1, 180),
    'pending-capital-1': ('M0067855', '在岸美元兑人民币', None, '元', 1, 7),
    'pending-capital-3': ('B3159602', '全部海外持有人美债余额', '十亿美元', '万亿美元', .001, 105),
}
_jobs = set()
_jobs_lock = threading.Lock()


def now_text():
    return datetime.now(timezone.utc).isoformat()


def new_client():
    if time.time() - read_json(ROOT / 'data' / 'Wind' / 'credits.json').get('failedAtEpoch', 0) < 3600:
        raise WindETFError('credits_exhausted')
    return WindClient()


def number(value):
    if isinstance(value, bool):
        raise ValueError('invalid_number')
    result = float(value)
    if not math.isfinite(result):
        raise ValueError('invalid_number')
    return result


def call_json(client, tool, arguments):
    for attempt in range(3):
        try:
            result = json.loads(client.call(tool, arguments))
            if not isinstance(result, dict):
                raise ValueError('invalid_tool_payload')
            if result.get('error'):
                raise WindETFError('upstream_unavailable')
            return result
        except WindETFError as error:
            if str(error) != 'rate_limited' or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise WindETFError('upstream_unavailable')


def parse_edb(payload, key, today):
    code, label, expected_unit, unit, scale, _ = SERIES[key]
    matches = [item for item in payload.get('metrics', []) if item.get('meta', {}).get('code') == code]
    if len(matches) != 1:
        raise ValueError('requested_series_missing')
    item = matches[0]
    meta = item['meta']
    if expected_unit and meta.get('unit') != expected_unit:
        raise ValueError('unit_mismatch')
    days, values = item.get('date', []), item.get('value', [])
    if len(days) != len(values):
        raise ValueError('unaligned_series')
    points, seen = {}, set()
    for raw_day, raw_value in zip(days, values):
        day = datetime.strptime(raw_day, '%Y%m%d').date()
        if day > today or day in seen:
            raise ValueError('invalid_observation_date')
        seen.add(day)
        if raw_value is not None:
            points[day.isoformat()] = number(raw_value) * scale
    if not points:
        raise ValueError('empty_series')
    return {'id': key, 'code': code, 'name': label, 'unit': unit,
            'source': 'Wind MCP · ' + label, 'sourceUrl': URL, 'upstream': meta.get('source'),
            'frequency': meta.get('freq'), 'windUpdatedDate': meta.get('updateDate'),
            'points': [{'date': day, 'value': points[day]} for day in sorted(points)]}


def cached_fetch(key, loader, cache_dir=CACHE, force=False, ttl=3600):
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / (key + '.json')
    with (cache_dir / (key + '.lock')).open('a', encoding='utf-8') as guard:
        fcntl.flock(guard, fcntl.LOCK_EX)
        previous = read_json(path)
        if not force and 0 <= time.time() - previous.get('attemptEpoch', 0) < (60 if previous.get('error') else ttl):
            return previous
        try:
            result = {**loader(), 'status': 'ok', 'error': '', 'fetchedAt': now_text()}
        except (WindETFError, ValueError, TypeError, KeyError, IndexError, AttributeError, OverflowError, OSError) as error:
            # Raw upstream exceptions may contain request/credential material.
            exhausted = isinstance(error, WindETFError) and str(error) == 'credits_exhausted'
            result = {**previous, 'status': 'stale' if previous.get('points') or previous.get('chartPayload') or previous.get('peTtm') else 'missing',
                      'errorCode': 'credits_exhausted' if exhausted else 'unavailable',
                      'error': 'Wind账户积分不足（402）；恢复积分后重试。' if exhausted else
                      'Wind取数或口径核验未通过，保留上次成功值；稍后重试。'}
        result.update(attemptEpoch=time.time(), checkedAt=now_text())
        write_json(path, result)
        return result


def edb_series(key, client=None, cache_dir=CACHE, force=False, today=None):
    today = today or datetime.now(ZoneInfo('Asia/Shanghai')).date()
    code = SERIES[key][0]
    def loader():
        payload = call_json(client or new_client(), 'economic_get_indicator_series', {
            'metricCodes': [code], 'startDate': (today - timedelta(days=1100)).isoformat(),
            'endDate': today.isoformat()})
        return parse_edb(payload, key, today)
    result = cached_fetch(key, loader, cache_dir, force)
    limit = SERIES[key][-1]
    if result.get('points') and limit is not None:
        if (today - date.fromisoformat(result['points'][-1]['date'])).days > limit:
            result = {**result, 'status': 'stale', 'error': '最新数据期较早，等待来源更新。'}
    return result


def liquidity_adapters(today=None, force=False):
    def adapter(key):
        def fetch():
            result = edb_series(key, today=today, force=force)
            if not result.get('points'):
                raise WindETFError(result.get('errorCode', 'upstream_unavailable'))
            points = result['points']
            if key in ('us_VIX', 'cn_south'):
                try:
                    from .liquidity_data import closed_daily_points
                except ImportError:
                    from liquidity_data import closed_daily_points
                points = closed_daily_points(points, 'us' if key == 'us_VIX' else 'hk')
            return {**result, 'points': points}
        return [fetch]
    return {key: adapter(key) for key in ('us_VIX', 'us_RRP', 'us_WALCL', 'cn_south')}


def risk_reading(raw, key):
    points = raw.get('points', [])
    latest = points[-1] if points else {}
    previous = points[-2] if len(points) > 1 else {}
    return {'id': key, 'name': raw.get('name'), 'value': latest.get('value'),
            'previous': previous.get('value'), 'date': latest.get('date'), 'previousDate': previous.get('date'),
            'unit': raw.get('unit'), 'source': raw.get('source', 'Wind MCP'), 'code': raw.get('code'),
            'fetchedAt': raw.get('fetchedAt'), 'checkedAt': raw.get('checkedAt'),
            'importedAt': raw.get('importedAt'),
            'status': raw.get('status', 'missing'), 'error': raw.get('error', '')}


def refresh_risk(cache_dir=CACHE, force=False):
    # Initialize lazily so an unavailable credential does not hide existing caches.
    client = None
    def get_client():
        nonlocal client
        if client is None:
            client = new_client()
        return client
    class LazyClient:
        def call(self, tool, args):
            return get_client().call(tool, args)
    readings = {}
    for key in SERIES:
        if key.startswith('pending-') and key != 'pending-capital-1':
            # USD/CNY is now supplied by the Yahoo chart adapter.
            readings[key] = risk_reading(edb_series(key, LazyClient(), cache_dir, force), key)
    result = {'indicators': readings, 'checkedAt': now_text(), 'attemptEpoch': time.time()}
    write_json(Path(cache_dir) / 'risk.json', result)
    return result


def risk_snapshot(cache_dir=CACHE):
    cache_dir = Path(cache_dir)
    result = read_json(cache_dir / 'risk.json')
    key = str(cache_dir.resolve())
    with _jobs_lock:
        if time.time() - result.get('attemptEpoch', 0) >= 3600 and key not in _jobs:
            _jobs.add(key)
            def worker():
                try:
                    refresh_risk(cache_dir)
                finally:
                    with _jobs_lock:
                        _jobs.discard(key)
            threading.Thread(target=worker, daemon=True, name='wind-risk').start()
        running = key in _jobs
    etf = etf_snapshot(ROOT / 'data' / '资金面日报' / 'cache')
    points = etf.get('points', [])
    if points and (date.today() - date.fromisoformat(points[-1]['date'])).days > 7:
        etf = {**etf, 'status': 'stale', 'error': 'ETF最新数据期较早，等待每日更新。'}
    return {**result, 'running': running, 'indicators': {
        **result.get('indicators', {}), 'pending-structure-3': risk_reading(etf, 'pending-structure-3')}}


def parse_kline(payload, start, end):
    table = payload['data']
    names = [column['name'] for column in table['columns']]
    day_index, close_index = names.index('TIME'), names.index('MATCH')
    points = {}
    for row in table['rows']:
        day = date.fromisoformat(row[day_index][:10])
        value = number(row[close_index])
        if not start <= day <= end or day.weekday() > 4 or value <= 0 or day.isoformat() in points:
            raise ValueError('invalid_daily_bar')
        points[day.isoformat()] = value
    if not points or (date.fromisoformat(min(points)) - start).days > 7 or (end - date.fromisoformat(max(points))).days > 7:
        raise ValueError('truncated_history')
    ordered_days = sorted(date.fromisoformat(day) for day in points)
    if any((b - a).days > 10 for a, b in zip(ordered_days, ordered_days[1:])):
        raise ValueError('history_gap')
    for year in range(start.year + (start.month != 1), end.year):
        if sum(day.startswith(str(year)) for day in points) < 200:
            raise ValueError('incomplete_year')
    return {'points': [{'date': day, 'value': points[day]} for day in sorted(points)]}


def parse_valuation(payload, day):
    tables = payload['data']['data']
    pe = percentile = count = first = last = None
    chinese_day = f'{int(day[:4])}年{int(day[5:7])}月{int(day[8:])}日'
    for table in tables:
        names = [c['name'] for c in table['columns']]
        for row in table['rows']:
            if 'Wind代码' in names and row[names.index('Wind代码')] != 'NDX.GI':
                raise ValueError('wrong_valuation_entity')
            for name, value in zip(names, row):
                if chinese_day not in name:
                    continue
                if name.endswith('市盈率PE_TTM') and '近十年' not in name and 'Wind代码' in names:
                    pe = number(value)
                elif 'PE_TTM' in name and '分位数' in name and 'Wind代码' in names:
                    percentile = number(value)
                elif '有效观测数' in name:
                    count = number(value)
                elif '最早日期' in name:
                    first = date.fromisoformat(str(value)[:10])
                elif '最晚日期' in name:
                    last = date.fromisoformat(str(value)[:10])
    if pe is None or pe <= 0:
        raise ValueError('unverified_pe_ttm')
    verified = (percentile is not None and 0 <= percentile <= 100 and count is not None and count >= 2000
                and first and last and last.isoformat() == day and (last - first).days >= 3645)
    return {'peTtm': pe, 'pePercentile10y': percentile if verified else None,
            'valuationDate': day, 'valuationSourceUrl': URL,
            'valuationNote': f'Wind NDX.GI PE-TTM；估值日 {day}。' +
            (f'近十年分位由Wind提供，{int(count)}个有效观测，{first}至{last}。' if verified else '近十年分位证据不完整，暂不展示。')}


def nasdaq_snapshot(cache_dir=CACHE, force=False):
    def loader():
        client = new_client()
        local = datetime.now(ZoneInfo('America/New_York'))
        end = local.date() if (local.hour, local.minute) >= (16, 15) else local.date() - timedelta(days=1)
        points = []
        for year in range(1996, end.year + 1, 5):
            start, stop = date(year, 1, 1), min(date(year + 4, 12, 31), end)
            chunk = cached_fetch('ndx-' + str(year), lambda: parse_kline(call_json(client, 'get_index_kline', {
                'windcode': 'NDX.GI', 'begin_date': start.isoformat(), 'end_date': stop.isoformat(),
                'period': '10', 'count': 0}), start, stop), cache_dir,
                force=force and stop == end, ttl=3600 if stop == end else 86400 * 30)
            if chunk.get('status') != 'ok':
                raise ValueError('history_segment_unavailable')
            points.extend(chunk['points'])
        day = points[-1]['date']
        chart = {'chart': {'result': [{'meta': {
            'symbol': '^NDX', 'dataGranularity': '1d', 'gmtoffset': -18000,
            'regularMarketPrice': points[-1]['value'], 'regularMarketTime': stamp(day)},
            'timestamp': [stamp(p['date']) for p in points],
            'indicators': {'quote': [{'close': [p['value'] for p in points]}]}}], 'error': None}}
        return {'chartPayload': chart, 'dataDate': day}
    result = cached_fetch('nasdaq', loader, cache_dir, force)
    if not result.get('chartPayload'):
        raise WindETFError('nasdaq_unavailable')
    day = result['dataDate']
    if (datetime.now(ZoneInfo('America/New_York')).date() - date.fromisoformat(day)).days > 7:
        result = {**result, 'status': 'stale', 'error': 'Wind最新交易日较早，等待更新。'}
    return {**result, 'valuation': nasdaq_valuation(day, cache_dir, force)}


def nasdaq_valuation(day, cache_dir=CACHE, force=False):
    return cached_fetch('pe-' + day, lambda: parse_valuation(call_json(new_client(), 'get_index_fundamentals', {
        'question': f'查询纳斯达克100指数NDX.GI本身{day}的市盈率PE_TTM（滚动12个月利润口径，不是静态PE）。'
                    '请同时返回该PE_TTM的近十年历史分位、有效观测数及起止日期，列名明确保留PE_TTM。'
                    '不查成分股，不用不同估值口径替代。'}), day), cache_dir, force)

def stamp(day):
    return int(datetime.fromisoformat(day + 'T16:00:00').replace(tzinfo=ZoneInfo('America/New_York')).timestamp())


if __name__ == '__main__':
    if not config.WIND_ENABLED:
        print(json.dumps({'status': 'disabled', 'message': 'Wind已按用户要求停用'}, ensure_ascii=False))
        raise SystemExit(0)
    parser = argparse.ArgumentParser(description='直接调用Wind MCP，无需AI会话')
    parser.add_argument('--dataset', choices=['risk', 'liquidity', 'nasdaq', 'all'], default='all')
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    if args.refresh:
        # Explicit recovery after a user has restored their credits.
        (ROOT / 'data' / 'Wind' / 'credits.json').unlink(missing_ok=True)
    results = {}
    if args.dataset in ('risk', 'all'):
        results.update(refresh_risk(force=args.refresh)['indicators'])
    if args.dataset in ('liquidity', 'all'):
        for key in ('us_VIX', 'us_RRP', 'us_WALCL', 'cn_south'):
            results[key] = risk_reading(edb_series(key, force=args.refresh), key)
    if args.dataset in ('nasdaq', 'all'):
        try:
            result = nasdaq_snapshot(force=args.refresh)
            results['nasdaq'] = {'status': result['status'], 'date': result['dataDate'],
                                 'valuationStatus': result['valuation']['status']}
        except WindETFError:
            results['nasdaq'] = {'status': 'missing'}
    print(json.dumps(results, ensure_ascii=False, indent=2))
