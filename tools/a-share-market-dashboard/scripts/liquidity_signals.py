"""Pure scoring: dates, units, missingness and coverage stay explicit."""

from datetime import date
import math

try:
    from . import liquidity_config as config
except ImportError:
    import liquidity_config as config


def normalize_points(rows, today=None):
    today = today or date.today()
    by_date = {}
    for row in rows:
        try:
            day = date.fromisoformat(str(row['date'])[:10])
            raw = row['value']
            if raw is None or isinstance(raw, bool):
                continue
            value = float(raw)
            if day <= today and math.isfinite(value):
                by_date[day.isoformat()] = value
        except (ValueError, TypeError, KeyError):
            continue
    return [{'date': day, 'value': value} for day, value in sorted(by_date.items())]


def score_label(score):
    if score >= 3: return '宽松'
    if score >= 1: return '偏松'
    if score == 0: return '中性'
    if score >= -2: return '偏紧'
    return '紧张'


def build_report(series, today=None):
    today = today or date.today()
    metrics = []
    alerts = []

    def metric(key, market, name, unit, rule, sources, kind, window=0, threshold=0, reference=False, optional=False, pending=False):
        inputs = [series.get(s, {}) for s in sources]
        histories = [normalize_points(s.get('points', []), today) for s in inputs]
        if len(histories) == 2:
            other = {p['date']: p['value'] for p in histories[1]}
            points = [{'date': p['date'], 'value': p['value'] - other[p['date']]} for p in histories[0] if p['date'] in other]
        else:
            points = histories[0]
        current = points[-1] if points else None
        days_old = (today - date.fromisoformat(current['date'])).days if current else None
        age_limit = config.MAX_WEEKLY_AGE_DAYS if key == 'walcl' else config.MAX_DAILY_AGE_DAYS
        minimum = window if kind in ('ma', 'sum') else window + 1
        available = bool(current) and (len(points) >= max(1, minimum) or (kind == 'curve' and current['value'] < 0))
        stale = any(s.get('status') == 'stale' for s in inputs) or (days_old is not None and days_old > age_limit)
        usable = available and not stale
        value = current['value'] if current else None
        change = baseline = None
        score = None
        if available:
            if window and kind not in ('ma', 'sum') and len(points) > window:
                baseline = points[-window-1]['value']
                change = value - baseline
            if kind == 'curve':
                score = -1 if value < 0 else (1 if value > 0 and change > 0 else 0)
            elif kind == 'bp':
                change = round(change * 100, 8)
                score = 1 if change <= -threshold else (-1 if change >= threshold else 0)
            elif kind == 'vix':
                score = -2 if value > 25 else (1 if value < 20 else 0)
            elif kind == 'rrp':
                change = 100 * change / baseline if baseline > 0 else None
                score = 1 if change is not None and change <= -threshold else 0
            elif kind == 'direction':
                score = (1 if change > 0 else -1) if change else 0
            elif kind == 'usd':
                change = 100 * change / baseline if baseline > 0 else None
                score = (1 if change < 0 else -1) if change else 0
            elif kind == 'percent':
                change = 100 * change / baseline if baseline > 0 else None
                score = (1 if change >= threshold else (-1 if change <= -threshold else 0)) if change is not None else None
            elif kind == 'sum':
                change = sum(p['value'] for p in points[-window:])
                score = (1 if change > 0 else -1) if change else 0
            elif kind == 'ma':
                baseline = sum(p['value'] for p in points[-window:]) / window
                change = (value / baseline - 1) * 100 if baseline else None
                score = (1 if value > baseline else -1) if value != baseline else 0
        status = 'missing' if not points else ('stale' if stale else ('insufficient' if not available else 'ok'))
        reasons = [s.get('error') for s in inputs if s.get('error')]
        reason = '；'.join(dict.fromkeys(reasons))
        if status == 'insufficient': reason = f'需要至少 {minimum} 个有效观测值，当前 {len(points)} 个'
        if status == 'stale' and not reason: reason = f'最近观测距今 {days_old} 天，超过新鲜度门槛'
        if status == 'missing' and not reason: reason = '暂无可用数据'
        item = {'id': key, 'market': market, 'name': name, 'unit': unit, 'rule': rule,
                'value': value, 'date': current['date'] if current else None, 'change': change,
                'baseline': baseline, 'score': score if usable and not reference else None,
                'status': status, 'reason': reason, 'reference': reference, 'optional': optional, 'pendingRule': pending,
                'source': ' / '.join(dict.fromkeys(s.get('source', '待获取') for s in inputs)),
                'sourceUrls': list(dict.fromkeys(s['sourceUrl'] for s in inputs if s.get('sourceUrl'))),
                'cached': any(s.get('cached') for s in inputs), 'points': points[-260:]}
        metrics.append(item)
        if usable and key == 'vix' and value > 25: alerts.append('VIX 高于 25：风险偏好收缩')
        if usable and key == 'curve' and value < 0: alerts.append('10Y−2Y 利差倒挂')
        if usable and key == 'spx' and value < baseline: alerts.append('标普500跌破 MA200')

    metric('curve', 'us', '10Y−2Y 利差', '%', '倒挂 −1；正利差且较20个观测日前走阔 +1；其余 0。', ['us_DGS10', 'us_DGS2'], 'curve', 20)
    metric('yield', 'us', '10Y 收益率', '%', '20个观测日变化：下降≥10bp +1；上升≥10bp −1。', ['us_DGS10'], 'bp', 20, 10)
    metric('vix', 'us', 'VIX 波动率', '点', '>25：−2；<20：+1；20至25：0。', ['us_VIX'], 'vix')
    rrp_pending = config.RRP_DECLINE_PERCENT is None
    rrp_rule = '评分规则待定：按用户要求暂留空，仅展示余额和历史，不参与合计。' if rrp_pending else f'20个观测日余额下降≥{config.RRP_DECLINE_PERCENT:g}%：+1；其余 0。'
    metric('rrp', 'us', '隔夜逆回购 RRP', '十亿美元', rrp_rule, ['us_RRP'], 'reference' if rrp_pending else 'rrp',
           0 if rrp_pending else 20, config.RRP_DECLINE_PERCENT, reference=rrp_pending, pending=rrp_pending)
    metric('walcl', 'us', '联储总资产 WALCL', '十亿美元', '较上期周度观测：扩表 +1；缩表 −1；不变 0。', ['us_WALCL'], 'direction', 1)
    metric('usd', 'us', '美元指数 DXY 趋势', '指数', f'DXY表示美元强弱；{config.USD_TREND_OBSERVATIONS}个观测日下跌（弱美元）+1；上涨（强美元）−1。', ['us_DXY_HISTORY'], 'usd', config.USD_TREND_OBSERVATIONS)
    metric('dxy', 'us', 'DXY 盘中报价', '指数', '新浪盘中报价仅供参考；美元强弱评分使用DXY日收盘趋势，不把盘中值混入。', ['us_DXY'], 'reference', reference=True)
    metric('spx', 'us', '标普500 / MA200', '点', '最新收盘高于200日均线 +1；低于 −1；相等 0。', ['us_SP500'], 'ma', 200)
    metric('margin', 'cn', '沪深融资余额', '亿元', '5个观测日变化≥+0.5%：+1；≤−0.5%：−1。仅融资余额，不含融券。', ['cn_margin'], 'percent', 5, .5)
    metric('flow', 'cn', '主力资金净流入', '亿元', '最近5个交易日净额合计：正 +1；负 −1。数据缺失自动隐藏。', ['cn_flow'], 'sum', 5, optional=True)
    metric('shibor', 'cn', 'Shibor 隔夜', '%', '5个观测日下降≥5bp：+1；上升≥5bp：−1。', ['cn_shibor'], 'bp', 5, 5)
    metric('south', 'cn', '南向资金净买入', '亿元', '港股通买入成交额减卖出成交额；沿用来源亿元单位，币种待核验，仅供参考，不计分。', ['cn_south'], 'reference', reference=True)
    metric('csi300', 'cn', '沪深300 / 年线', '点', f'最新收盘高于MA{config.CN_ANNUAL_MA}：+1；低于：−1；相等：0。', ['cn_CSI300'], 'ma', config.CN_ANNUAL_MA)
    markets = {}
    for market in ('cn', 'us'):
        scored = [m for m in metrics if m['market'] == market and not m['reference']]
        valid = [m for m in scored if m['score'] is not None]
        score = sum(m['score'] for m in valid) if valid else None
        markets[market] = {'score': score, 'label': score_label(score) if score is not None else '数据不足',
                           'valid': len(valid), 'total': len(scored), 'complete': len(valid) == len(scored)}
    alert_inputs = [m for m in metrics if m['id'] in ('vix', 'curve', 'spx')]
    return {'schemaVersion': 1, 'asOf': today.isoformat(), 'markets': markets, 'metrics': metrics,
            'alerts': alerts, 'alertsComplete': all(m['score'] is not None for m in alert_inputs)}
