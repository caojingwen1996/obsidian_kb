"""Daily ETF share-change estimates; no exchange cash-flow claim."""

from datetime import date
import math

from tushare_client import TushareClientError, normalize_date, tushare_date


def positive(value, zero=False):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) and (value >= 0 if zero else value > 0) else None
    except (TypeError, ValueError):
        return None


def by_code(rows, day, date_field):
    result = {}
    for row in rows:
        if row.get(date_field) != day:
            raise TushareClientError('tushare-data', 'ETF response date mismatch')
        code = row.get('ts_code')
        if not code or code in result:
            raise TushareClientError('tushare-data', 'missing or duplicate ETF identity')
        result[code] = row
    return result


def estimate_day(day, previous, funds, shares, prior_shares, navs, prior_navs):
    inputs = [by_code(rows, when, field) for rows, when, field in (
        (shares, day, 'trade_date'), (prior_shares, previous, 'trade_date'),
        (navs, day, 'nav_date'), (prior_navs, previous, 'nav_date'))]
    eligible, new, unknown = [], [], []
    seen = set()
    for fund in funds:
        code, name = fund.get('ts_code', ''), fund.get('name', '').upper()
        if (fund.get('fund_type') != '股票型' or 'ETF' not in name or
                'QDII' in name or '联接' in name or not code.endswith(('.SH', '.SZ'))):
            continue
        if code in seen:
            raise TushareClientError('tushare-data', 'duplicate ETF universe identity')
        seen.add(code)
        listed, delisted = fund.get('list_date'), fund.get('delist_date')
        if not listed:
            unknown.append(code)
        elif listed > day or (delisted and delisted <= day):
            continue
        elif listed > previous:
            new.append(code)
        else:
            eligible.append(fund)
    included, excluded = [], []
    for fund in eligible:
        code = fund['ts_code']
        current, prior, nav, old_nav = [table.get(code, {}) for table in inputs]
        quantities = [positive(row.get('fd_share'), zero=True) for row in (current, prior)]
        prices = [positive(row.get('unit_nav')) for row in (nav, old_nav)]
        adjusted = [positive(row.get('adj_nav')) for row in (nav, old_nav)]
        reason = None
        if any(value is None for value in quantities):
            reason = 'missing_share'
        elif any(value is None for value in prices + adjusted):
            reason = 'missing_nav_or_adjustment'
        elif not math.isclose(adjusted[0] / prices[0], adjusted[1] / prices[1], rel_tol=.001):
            # Adjustment changes can reflect splits or distributions. Do not
            # infer a split ratio from a factor that can also include dividends.
            reason = 'corporate_action_review'
        if reason:
            excluded.append({'ts_code': code, 'name': fund['name'], 'reason': reason})
            continue
        delta = quantities[0] - quantities[1]
        included.append({'ts_code': code, 'name': fund['name'], 'share_change_wan': delta,
                         'unit_nav': prices[0], 'net_flow_yi': delta * prices[0] / 10000})
    sample = sum(row['net_flow_yi'] for row in included) if included else None
    complete = bool(eligible) and not excluded and not unknown
    return {'trade_date': day, 'previous_trade_date': previous, 'complete': complete,
            'net_flow_yi': sample if complete else None, 'sample_net_flow_yi': sample,
            'coverage': {'expected': len(eligible), 'received': len(included),
                         'newly_listed': new, 'unknown_listing_date': unknown},
            'excluded': excluded, 'funds': included}


def etf_flow_history(client, start_date, end_date, use_cache=True, limit=None):
    # Bound batch cost: callers can persist daily results, rather than re-fetch
    # every ETF on hundreds of historical days for each dashboard refresh.
    start, end = [date.fromisoformat(normalize_date(tushare_date(v))) for v in (start_date, end_date)]
    if not 0 <= (end - start).days <= 31:
        raise TushareClientError('tushare-params', 'ETF estimate requires a range of at most 32 calendar days')
    from tushare_market_data import payload
    calendars = []
    for exchange in ('SSE', 'SZSE'):
        cal = client.call('trade_cal', exchange=exchange, start_date=start_date, end_date=end_date, use_cache=use_cache)
        calendars.append({r['cal_date']: r['pretrade_date'] for r in cal if r.get('is_open') == 1})
    if calendars[0] != calendars[1]:
        raise TushareClientError('tushare-data', 'exchange calendars disagree')
    funds = client.call('fund_basic', use_cache=use_cache)
    if calendars[0] and (not funds or len(funds) >= 15000):
        raise TushareClientError('tushare-data', 'ETF universe empty or possibly truncated')
    snapshots = {}
    def snapshot(day):
        if day not in snapshots:
            shares = []
            for market in ('SH', 'SZ'):
                rows = client.call('fund_share', trade_date=day, market=market, use_cache=use_cache)
                if len(rows) >= 2000:
                    raise TushareClientError('tushare-data', 'fund_share possibly truncated')
                shares.extend(rows)
            navs = client.call('fund_nav', nav_date=day, use_cache=use_cache)
            snapshots[day] = shares, navs
        return snapshots[day]
    rows = []
    for day, previous in sorted(calendars[0].items()):
        if not start.isoformat() <= day <= end.isoformat() or not previous or previous >= day:
            raise TushareClientError('tushare-data', 'invalid ETF trading calendar')
        shares, navs = snapshot(day)
        prior_shares, prior_navs = snapshot(previous)
        rows.append(estimate_day(day, previous, funds, shares, prior_shares, navs, prior_navs))
    result = payload('fund_basic+fund_share+fund_nav+trade_cal', rows, start_date, end_date,
                     {'net_flow_yi': 'CNY_hundred_million', 'sample_net_flow_yi': 'CNY_hundred_million'}, limit,
                     estimate=True, scope='沪深上市股票型ETF（含港股通、排除QDII及联接基金）',
                     formula='(当日份额-前一交易日份额，万份) × 当日单位净值（元） / 10000',
                     corporate_action_policy='净值复权比例变化超过0.1%的基金单列待核实，不推断拆分比例；非完备公司行为库。',
                     source_note='Tushare转供份额和净值，本地估算；并非交易所直接披露的现金净流入。')
    if any(not row['complete'] for row in rows):
        result['status'] = 'partial'
    return result
