"""Reference-only A-share funding observations; never add to liquidity scores."""

from datetime import date
from html.parser import HTMLParser
import json
import math

try:
    from .liquidity_signals import normalize_points
    from . import liquidity_config as config
    from .akshare_data import shared_market_fund_flow
except ImportError:
    from liquidity_signals import normalize_points
    import liquidity_config as config
    from akshare_data import shared_market_fund_flow

MONITOR_UNITS = {
    'cn_margin_net': '亿元', 'cn_margin_ratio': '%', 'cn_super_flow': '亿元',
    'cn_small_flow': '亿元', 'cn_etf_flow': '亿元',
    'cn_breadth_ratio': '%', 'cn_breadth_up': '家', 'cn_breadth_down': '家',
    'cn_breadth_flat': '家', 'cn_breadth_total': '家',
    'cn_breadth_limit_up': '家', 'cn_breadth_limit_down': '家',
}
MARGIN_URL = 'https://data.eastmoney.com/rzrq/'
FLOW_URL = 'https://data.eastmoney.com/zjlx/dpzjlx.html'
BREADTH_URL = 'https://www.legulegu.com/stockdata/market-activity'
ETF_GAP = '尚未接入可核验的沪深股票型ETF申赎净流入；不以成交额或二级市场资金流替代。'


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def margin_monitor_series(rows, key):
    points = []
    for row in rows:
        value = None
        if key == 'cn_margin_net':
            bought, repaid = number(row.get('RZMRE')), number(row.get('RZCHE'))
            if bought is not None and repaid is not None:
                value = (bought - repaid) / 1e8
        else:
            balance, float_cap = number(row.get('RZYE')), number(row.get('LTSZ'))
            if balance is not None and balance >= 0 and float_cap is not None and float_cap > 0:
                value = balance / float_cap * 100
        if value is not None and row.get('DIM_DATE'):
            points.append({'date': row['DIM_DATE'][:10], 'value': value})
    return points, '东财 · 沪深融资统计', MARGIN_URL


def order_flow_series(load, key, close):
    rows = load()
    name = {'cn_flow': '主力', 'cn_super_flow': '超大单', 'cn_small_flow': '小单'}[key]
    field = name + '净流入-净额'
    points = []
    for row in rows:
        if '日期' not in row or field not in row:
            raise ValueError('invalid_akshare_flow_columns')
        try:
            day = date.fromisoformat(str(row['日期'])).isoformat()
        except ValueError:
            continue
        value = number(row[field])
        if value is not None:
            points.append({'date': day, 'value': value / 1e8})
    return close(points, 'cn'), f'AKShare · 东方财富沪深{name}净流入（订单估算）', FLOW_URL


class BreadthParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}
        self.in_time = False
        self.timestamp = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'data-chart' in attrs and attrs.get('id'):
            self.values[attrs['id']] = number(attrs['data-chart'])
        if tag == 'span' and 'market-activity-time' in attrs.get('class', '').split():
            self.in_time = True

    def handle_data(self, value):
        if self.in_time:
            self.timestamp += value.strip()

    def handle_endtag(self, tag):
        if tag == 'span':
            self.in_time = False


def breadth_snapshot(html):
    parser = BreadthParser()
    parser.feed(html)
    day = date.fromisoformat(parser.timestamp[:10]).isoformat()
    names = {'up': 'totalUp', 'down': 'totalDown', 'flat': 'priceStop',
             'total': 'total', 'limit_up': 'limitUp', 'limit_down': 'limitDown'}
    result = {key: parser.values.get(field) for key, field in names.items()}
    paused = parser.values.get('pricePaused')
    if any(v is None or v < 0 or not v.is_integer() for v in [*result.values(), paused]):
        raise ValueError('invalid_breadth_counts')
    if result['total'] <= 0 or sum(result[key] for key in ('up', 'down', 'flat')) + paused != result['total']:
        raise ValueError('incomplete_breadth_universe')
    if result['limit_up'] > result['up'] or result['limit_down'] > result['down']:
        raise ValueError('invalid_breadth_limits')
    # Match the publisher's denominator, which includes suspended stocks.
    result['ratio'] = result['up'] / result['total'] * 100
    return day, result


def breadth_series(fetch, key, close):
    day, values = breadth_snapshot(fetch(BREADTH_URL))
    points = close([{'date': day, 'value': values[key.removeprefix('cn_breadth_')]}], 'cn')
    return points, '乐咕乐股 · 沪深赚钱效应', BREADTH_URL


def imported_etf_series(cache_dir, today=None):
    """Optional verified aggregate import, never substitute turnover or order flow."""
    payload = json.loads((cache_dir / 'imports' / 'cn_etf_flow.json').read_text(encoding='utf-8'))
    if (payload.get('id') != 'cn_etf_flow' or payload.get('unit') != '亿元'
            or payload.get('scope') != '沪深股票型ETF'
            or payload.get('basis') != 'net_creation_redemption'
            or not payload.get('source') or not str(payload.get('sourceUrl', '')).startswith('https://')):
        raise ValueError('invalid_etf_definition')
    return normalize_points(payload.get('points', []), today), payload['source'], payload['sourceUrl']


def monitor_adapters(fetch, eastmoney, close, cache_dir, today=None):
    def margin(key):
        return margin_monitor_series(eastmoney('RPTA_RZRQ_LSHJ', 'DIM_DATE', fetch=fetch), key)
    adapters = {key: [lambda key=key: margin(key)] for key in ('cn_margin_net', 'cn_margin_ratio')}
    flow = shared_market_fund_flow()
    adapters.update({key: [lambda key=key: order_flow_series(flow, key, close)]
                     for key in ('cn_flow', 'cn_super_flow', 'cn_small_flow')})
    adapters.update({key: [lambda key=key: breadth_series(fetch, key, close)]
                     for key in MONITOR_UNITS if key.startswith('cn_breadth_')})
    adapters['cn_etf_flow'] = [lambda: imported_etf_series(cache_dir, today)]
    return adapters


def observation(key, name, rule, series, today):
    raw = series.get(key, {})
    points = normalize_points(raw.get('points', []), today)
    current = points[-1] if points else None
    previous = points[-2] if len(points) > 1 else None
    stale = raw.get('status') == 'stale' or (current and (today - date.fromisoformat(current['date'])).days > config.MAX_DAILY_AGE_DAYS)
    status = 'missing' if not current else 'stale' if stale else 'ok'
    window = points[-60:]
    percentile = None
    if len(window) == 60 and status == 'ok':
        values = [p['value'] for p in window]
        percentile = round(100 * (sum(v < current['value'] for v in values)
                                  + .5 * sum(v == current['value'] for v in values)) / 60)
    reason = raw.get('error', '')
    if status == 'stale' and not reason:
        reason = '观测已超过新鲜度门槛，仅保留历史读数。'
    if status == 'missing' and key == 'cn_etf_flow' and not reason:
        reason = ETF_GAP
    elif status == 'missing' and not reason:
        reason = '尚未取得有效观测。'
    direction = '待更新'
    if status == 'ok':
        direction = '净流入' if current['value'] > 0 else '净流出' if current['value'] < 0 else '净额为零'
        if key == 'cn_margin_net':
            direction = '净买入' if current['value'] > 0 else '净偿还' if current['value'] < 0 else '净额为零'
    return {'id': key, 'name': name, 'unit': MONITOR_UNITS[key], 'rule': rule,
            'value': current['value'] if current else None, 'date': current['date'] if current else None,
            'previous': previous, 'percentile': percentile, 'sampleCount': len(window),
            'direction': direction, 'status': status, 'reason': reason, 'reference': True,
            'score': None, 'change': None, 'baseline': None, 'points': points[-260:],
            'source': raw.get('source', '待获取'), 'sourceUrls': [raw['sourceUrl']] if raw.get('sourceUrl') else [],
            'cached': raw.get('cached', False), 'transport': raw.get('transport'),
            'updatedAt': raw.get('fetchedAt'),
            'coverage': raw.get('coverage'), 'refresh': raw.get('refresh')}


def build_funding_monitor(series, today=None):
    today = today or date.today()
    definitions = [
        ('cn_margin_net', '杠杆资金 · 融资', '沪深融资买入额减偿还额；正值为净买入，负值为净偿还，不用融资余额变化替代。'),
        ('cn_super_flow', '超大单资金', '东财沪深超大单净流入估算。订单规模是机构资金的观察代理，不能确认交易账户身份。'),
        ('cn_etf_flow', 'ETF配置盘', '沪深股票型ETF申购赎回净流入；申赎参与者身份未知，不能据此断言长期配置意图。'),
        ('cn_small_flow', '小单资金', '东财沪深小单净流入估算。小单是散户资金的观察代理，也可能包含机构拆单；不自动作为反向交易信号。'),
    ]
    cards = [observation(key, name, rule, series, today) for key, name, rule in definitions]
    ratio_source = series.get('cn_margin_ratio', {}).get('source', '')
    ratio_rule = ('同日沪深交易所融资余额 ÷ 沪深股票市场流通市值（含B股、排除北交所）× 100%；Tushare margin + daily_info，缺一市场不计算。'
                  if ratio_source.startswith('Tushare ') else '同日沪深融资余额 ÷ 东财流通市值 × 100%；不设未经确认的正常／过热阈值。')
    ratio = observation('cn_margin_ratio', '融资余额占流通市值', ratio_rule, series, today)
    breadth_rules = '乐咕乐股沪深样本：上涨家数 ÷ 总家数（含平盘、停牌）×100%；涨跌停按该来源统计，非统一10%估算。历史从本机成功采集开始累积。'
    breadth = [observation('cn_breadth_' + key, name, breadth_rules, series, today) for key, name in [
        ('ratio', '上涨个股占比'), ('up', '上涨家数'), ('down', '下跌家数'), ('flat', '平盘家数'),
        ('total', '统计总家数'), ('limit_up', '涨停家数'), ('limit_down', '跌停家数')]]
    return {'cards': cards, 'marginRatio': ratio, 'breadth': breadth,
            'note': '各项以自己的观测日期为准；仅作资金结构观察，不重复加入资金面评分。不同口径有交集，不能将四项金额相加。',
            'percentileRule': 'P值为最新读数在最近60个有效观测（含本次）中的分位：小于它的样本数加相等样本数的一半，再除以60；不足60个不计算。前次显示真实日期，不假定为昨日。'}
