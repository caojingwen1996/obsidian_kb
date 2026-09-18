"""Refresh auditable inputs for the 2026-09-17 CRRC valuation."""
import json
import os
import sys
import hashlib
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'sources/assets/中国中车/2026-09-17'
OUT.mkdir(parents=True, exist_ok=True)
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'tools/tushare-data/scripts'))
os.environ['NO_PROXY'] = 'api.tushare.pro'
from tushare_client import TushareClient, frame_to_rows

def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')

jobs = []
for method in ['daily', 'daily_basic', 'adj_factor', 'moneyflow', 'margin_detail', 'block_trade', 'top_list']:
    jobs.append((method, method, dict(ts_code='601766.SH', start_date='20260701', end_date='20260916')))
for method in ['income', 'balancesheet', 'cashflow', 'fina_indicator']:
    jobs.append((method, method, dict(ts_code='601766.SH', start_date='20220101', end_date='20260917')))
for method in ['stk_holdernumber', 'stk_holdertrade', 'repurchase', 'dividend']:
    jobs.append((method, method, dict(ts_code='601766.SH')))
jobs += [('stock_basic', 'stock_basic', dict(ts_code='601766.SH', fields='ts_code,symbol,name,industry,market,list_date')),
         ('trade_cal', 'trade_cal', dict(exchange='SSE', start_date='20260914', end_date='20260917')),
         ('shibor_lpr', 'shibor_lpr', dict(start_date='20260801', end_date='20260917'))]
for code in ['688187.SH', '688009.SH']:
    jobs.append((f'daily_basic-{code}', 'daily_basic', dict(ts_code=code, start_date='20260916', end_date='20260916')))

def fetch(job):
    label, method, params = job
    result = {'source': 'local Tushare client', 'method': method, 'params': params,
              'retrieved_at': datetime.now().isoformat(timespec='seconds')}
    try:
        df = getattr(TushareClient().pro(), method)(**params)
        result.update(status='ok', rows=frame_to_rows(df))
    except Exception as exc:
        result.update(status='error', error=str(exc))
    save(label+'.json', result)
    return {'dataset': label, 'status': result['status'], 'rows': len(result.get('rows', [])), 'error': result.get('error')}

if __name__ == '__main__':
    for rel, name in [('workbench/targets/中国中车-机构级决策研报.md', 'previous-report.md'),
                      ('sources/automations/支柱产业/中国中车-机构级决策研报.html', 'previous-report.html')]:
        path = OUT / name
        if not path.exists():
            path.write_bytes((ROOT / rel).read_bytes())
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for fut in as_completed([pool.submit(fetch, job) for job in jobs]):
            item = fut.result()
            results.append(item)
            print(json.dumps(item, ensure_ascii=False), flush=True)
    save('retrieval.json', results)
    save('original-report-hash.json', {'sha256': hashlib.sha256((OUT/'previous-report.md').read_bytes()).hexdigest()})
