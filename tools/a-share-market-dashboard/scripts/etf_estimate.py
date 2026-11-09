"""Dashboard cache for the shared Tushare share-change estimator."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from threading import Lock
import time
try:
    from .shared_market_data import CN, market_data
except ImportError:
    from shared_market_data import CN, market_data

SOURCE = 'Tushare · ETF份额变动×单位净值（估算）'
RULE = '连续交易日份额变化×当日单位净值；沪深股票型ETF，含港股通、排除QDII。异常份额折算单列；样本金额不代表完整市场，也不是现金实际到账额。'
_LOCK = Lock()


def read_estimate(cache_dir):
    try:
        result = json.loads((Path(cache_dir) / 'etf-estimate' / 'series.json').read_text(encoding='utf-8'))
        if result.get('source') == SOURCE and result.get('basis') == 'share_change_nav_v1':
            return result
    except (OSError, ValueError):
        pass
    return {'id': 'cn_etf_flow', 'points': [], 'source': SOURCE, 'sourceUrl': 'https://tushare.pro/document/2?doc_id=207',
            'unit': '亿元', 'transport': 'tushare-python', 'basis': 'share_change_nav_v1',
            'status': 'missing', 'error': '尚未成功读取ETF份额与净值，请刷新资金面看板。'}


def estimate_snapshot(cache_dir, force=False, today=None, api=None):
    with _LOCK:
        cached = read_estimate(cache_dir)
        ttl = 60 if cached.get('status') in ('missing', 'stale') else 3600
        if not force and time.time() - cached.get('lastAttemptEpoch', 0) < ttl:
            return {**cached, 'cached': True}
        end = (today or datetime.now(CN).date()) - timedelta(days=1)
        try:
            result = (api or market_data()).query('get_etf_flow_estimate',
                start_date=(end - timedelta(days=7)).isoformat(), end_date=end.isoformat(), use_cache=not force)
            usable = [row for row in result['rows'] if row['sample_net_flow_yi'] is not None]
            if not usable:
                raise ValueError('no_etf_estimates')
            latest = usable[-1]
            history = {p['date']: p for p in cached.get('points', [])}
            for row in result['rows']:
                history.pop(row['trade_date'], None)
            for row in usable:
                history[row['trade_date']] = {'date': row['trade_date'], 'value': row['sample_net_flow_yi']}
            cached = {**cached, 'points': sorted(history.values(), key=lambda x:x['date'])[-500:],
                      'status': 'ok', 'cached': False, 'complete': latest['complete'],
                      'coverage': {**latest['coverage'], 'universeDate': latest['trade_date']},
                      'excluded': latest['excluded'], 'latest': latest,
                      'fetchedAt': datetime.now(timezone.utc).isoformat(),
                      'error': '' if latest['complete'] else f"样本估算：覆盖{latest['coverage']['received']}/{latest['coverage']['expected']}只有明确上市日期的ETF；缺失或异常及上市日期不明的基金未计入，非完整市场合计。"}
        except Exception as error:
            cached = {**cached, 'status': 'stale' if cached.get('points') else 'missing', 'cached': bool(cached.get('points')),
                      'error': 'ETF份额／净值读取失败（' + type(error).__name__ + '），保留旧估算并标记待更新。'}
        cached['lastAttemptEpoch'] = time.time()
        directory = Path(cache_dir) / 'etf-estimate'
        directory.mkdir(parents=True, exist_ok=True)
        temporary = directory / 'series.tmp'
        temporary.write_text(json.dumps(cached, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        temporary.replace(directory / 'series.json')
        return cached
