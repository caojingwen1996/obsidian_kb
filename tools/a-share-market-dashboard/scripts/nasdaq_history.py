"""Extend NDX daily bars with an audited local seed; retain the rolling history."""
import copy
import json
import math
import os
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from threading import Lock

DATA_DIR = Path(__file__).resolve().parents[1] / 'data' / '市场总览'
SEED_PATH = DATA_DIR / 'nasdaq100-historical-seed.json'
CACHE_PATH = DATA_DIR / 'nasdaq100-daily-cache.json'
_HISTORY_LOCK = Lock()


def read_daily(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('symbol') != 'NDX' or data.get('priceType') != 'close' or data.get('frequency') != 'daily':
        raise ValueError('Historical index identity or frequency mismatch')
    rows = {}
    for row in data['daily']:
        day, close = row['date'], row['close']
        if datetime.strptime(day, '%Y-%m-%d').strftime('%Y-%m-%d') != day:
            raise ValueError('Invalid history date')
        if isinstance(close, bool) or not isinstance(close, (float, int)) or not math.isfinite(close) or close <= 0:
            raise ValueError('Invalid historical close')
        if day in rows and rows[day] != close:
            raise ValueError('Conflicting historical dates')
        rows[day] = close
    return rows


def extend_daily_chart(chart, seed_path=SEED_PATH, cache_path=CACHE_PATH):
    """Require matching overlap, keep live values, persist atomically; never synthesize prices."""
    result = chart['chart']['result'][0]
    meta = result['meta']
    if meta.get('dataGranularity') != '1d':
        raise ValueError('Daily bars required')
    zone = timezone(timedelta(seconds=meta.get('gmtoffset', 0)))
    as_of = datetime.fromtimestamp(meta['regularMarketTime'], zone).date().isoformat()
    live = {}
    for stamp, close in zip(result['timestamp'], result['indicators']['quote'][0]['close']):
        day = datetime.fromtimestamp(stamp, zone).date().isoformat()
        if day <= as_of and isinstance(close, (float, int)) and not isinstance(close, bool) and math.isfinite(close) and close > 0:
            live[day] = close
    if len(live) < 2:
        raise ValueError('Insufficient live history')
    with _HISTORY_LOCK:
        history = read_daily(Path(seed_path))
        cache_path = Path(cache_path)
        if cache_path.exists():
            history.update(read_daily(cache_path))
        overlap = sorted(history.keys() & live.keys())
        if len(overlap) < 20:
            raise ValueError('Historical join requires at least 20 shared daily closes')
        if any(abs(history[day] - live[day]) > 0.011 for day in overlap):
            raise ValueError('Historical and current daily closes disagree')
        merged = dict(history)
        merged.update(live)
        points = sorted((day, close) for day, close in merged.items() if '1996-01-01' <= day <= as_of)
        if points[0][0] != '1996-01-02':
            raise ValueError('Historical coverage does not start at 1996 first trading day')
        output = copy.deepcopy(chart)
        target = output['chart']['result'][0]
        target['timestamp'] = [datetime.strptime(day, '%Y-%m-%d').replace(hour=16, tzinfo=zone).timestamp() for day, _ in points]
        target['indicators']['quote'] = [{'close': [close for _, close in points]}]
        # Cache newer data even if a later upstream response is temporarily older.
        saved = {'schemaVersion': 1, 'symbol': 'NDX', 'frequency': 'daily', 'priceType': 'close',
                 'source': 'FRED/Nasdaq historical seed + verified live NDX daily closes',
                 'firstDate': min(merged), 'lastDate': max(merged),
                 'daily': [{'date': day, 'close': close} for day, close in sorted(merged.items())]}
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=cache_path.parent, delete=False) as handle:
                temporary = handle.name
                json.dump(saved, handle, ensure_ascii=False, separators=(',', ':'))
                handle.write('\n')
            os.replace(temporary, cache_path)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)
        return output
