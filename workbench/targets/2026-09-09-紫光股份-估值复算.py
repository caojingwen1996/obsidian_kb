from pathlib import Path
import sys, json, datetime
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient, frame_to_rows
OUT=ROOT/'sources/assets/紫光股份/2026-09-09-revalue'
OUT.mkdir(parents=True,exist_ok=True)
client=TushareClient(cache_ttl_seconds=0,retries=1)
pro=client.pro()
jobs=[('stock_basic',dict(ts_code='000938.SZ')),('daily',dict(ts_code='000938.SZ',start_date='20250801',end_date='20260909')),('daily_basic',dict(ts_code='000938.SZ',start_date='20250801',end_date='20260909',fields='ts_code,trade_date,close,pe_ttm,pb,total_share,float_share,total_mv,turnover_rate,dv_ttm')),('moneyflow',dict(ts_code='000938.SZ',start_date='20260701',end_date='20260909')),('margin_detail',dict(ts_code='000938.SZ',start_date='20260701',end_date='20260909')),('stk_holdernumber',dict(ts_code='000938.SZ',start_date='20250101',end_date='20260909')),('dividend',dict(ts_code='000938.SZ')),('income',dict(ts_code='000938.SZ',start_date='20220101',end_date='20260909')),('balancesheet',dict(ts_code='000938.SZ',start_date='20220101',end_date='20260909')),('cashflow',dict(ts_code='000938.SZ',start_date='20220101',end_date='20260909')),('fina_indicator',dict(ts_code='000938.SZ',start_date='20220101',end_date='20260909')),('top10_holders',dict(ts_code='000938.SZ',period='20260630')),('top10_floatholders',dict(ts_code='000938.SZ',period='20260630')),('block_trade',dict(ts_code='000938.SZ',start_date='20260801',end_date='20260909')),('stk_holdertrade',dict(ts_code='000938.SZ',start_date='20260101',end_date='20260909')),('repurchase',dict(ts_code='000938.SZ',start_date='20260101',end_date='20260909')),('shibor',dict(start_date='20260801',end_date='20260909')),('cn_cpi',dict(start_m='202606',end_m='202608')),('cn_ppi',dict(start_m='202606',end_m='202608')),('cn_m',dict(start_m='202606',end_m='202608'))]
def get(job):
    name,params=job
    try:
        rows=frame_to_rows(getattr(pro,name)(**params),set())
        (OUT/(name+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
        return dict(api=name,params=params,rows=len(rows),retrieved=datetime.datetime.now().isoformat())
    except Exception as e:
        return dict(api=name,params=params,error=str(e),retrieved=datetime.datetime.now().isoformat())
with ThreadPoolExecutor(max_workers=4) as pool:
    results=list(pool.map(get,jobs))
for code in ['000977.SZ','000063.SZ','301165.SZ','603019.SH','002396.SZ']:
    rows=frame_to_rows(pro.daily_basic(ts_code=code,start_date='20260901',end_date='20260909'),set())
    (OUT/(code+'-peer.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'retrieval.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
