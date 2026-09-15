"""Reproducible funds snapshot: real local MCP first, supplemental APIs second."""
import json, os, subprocess, sys
from pathlib import Path
from datetime import datetime
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'sources/assets/云铝股份/2026-09-15-fund-flow'
OUT.mkdir(parents=True, exist_ok=True)
os.environ['NO_PROXY'] = 'api.tushare.pro'
os.environ['PYTHONIOENCODING'] = 'utf-8'
base = dict(ts_code='000807.SZ', start_date='20260701', end_date='20260915', use_cache=False, limit=1000)
calls = [
 ('basic','get_stock_basic',dict(ts_code='000807.SZ',use_cache=False)),
 ('daily','get_stock_daily',dict(base,start_date='20250915')),
 ('valuation','get_stock_valuation',base),
 ('moneyflow','get_stock_moneyflow',base),
 ('margin','get_margin_detail',base),
 ('holders','get_shareholder_count',dict(base,start_date='20250101')),
 ('huijin','check_central_huijin_holding',dict(ts_code='000807.SZ',use_cache=False)),
 ('financial','get_financial_statements',dict(ts_code='000807.SZ',period='20260630',use_cache=False)),
 ('dividend','get_dividend_history',dict(ts_code='000807.SZ',use_cache=False)),
]
reqs=[dict(jsonrpc='2.0',id=0,method='initialize',params={})]
reqs += [dict(jsonrpc='2.0',id=i+1,method='tools/call',params=dict(name=n,arguments=a)) for i,(_,n,a) in enumerate(calls)]
run=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'tools/tushare-data/scripts/mcp_server.py')],input='\n'.join(json.dumps(r) for r in reqs)+'\n',text=True,encoding='utf-8',capture_output=True,timeout=240)
responses={r['id']:r for r in map(json.loads,run.stdout.splitlines()) if 'id' in r}
audit=[]
for i,(key,name,args) in enumerate(calls):
    response=responses.get(i+1,{})
    payload=response.get('result',{}).get('structuredContent',{})
    obj=dict(source='local MCP stdio',tool=name,arguments=args,retrieved_at=datetime.now().astimezone().isoformat(),response=response,payload=payload)
    (OUT/f'{key}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    audit.append(dict(key=key,tool=name,status='error' if payload.get('error') or not response else 'ok',row_count=payload.get('row_count'),message=payload.get('message')))
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient
pro=TushareClient().pro()
extra=[
 ('adj','adj_factor',dict(ts_code='000807.SZ',start_date='20250915',end_date='20260915')),
 ('block','block_trade',dict(ts_code='000807.SZ',start_date='20260701',end_date='20260915')),
 ('top','top_list',dict(ts_code='000807.SZ',start_date='20260701',end_date='20260915')),
 ('repurchase','repurchase',dict(ts_code='000807.SZ',start_date='20260101',end_date='20260915')),
 ('holdertrade','stk_holdertrade',dict(ts_code='000807.SZ',start_date='20260101',end_date='20260915')),
 ('pledge','pledge_stat',dict(ts_code='000807.SZ')),
 ('unlock','share_float',dict(ts_code='000807.SZ',start_date='20260915',end_date='20270315')),
 ('chips','cyq_perf',dict(ts_code='000807.SZ',start_date='20260801',end_date='20260915')),
 ('hk','hk_hold',dict(ts_code='000807.SZ',start_date='20260801',end_date='20260915')),
 ('top10','top10_holders',dict(ts_code='000807.SZ',period='20260630')),
 ('top10prev','top10_holders',dict(ts_code='000807.SZ',period='20260331')),
 ('csi300','index_daily',dict(ts_code='000300.SH',start_date='20260701',end_date='20260915')),
 ('peer601600','daily',dict(ts_code='601600.SH',start_date='20260701',end_date='20260915')),
 ('peer002532','daily',dict(ts_code='002532.SZ',start_date='20260701',end_date='20260915')),
 ('peer600219','daily',dict(ts_code='600219.SH',start_date='20260701',end_date='20260915')),
 ('etfshare','fund_share',dict(ts_code='512400.SH',start_date='20260801',end_date='20260915')),
 ('etfnav','fund_nav',dict(ts_code='512400.SH',start_date='20260801',end_date='20260915')),
 ('etfportfolio','fund_portfolio',dict(ts_code='512400.SH',period='20260630')),
]
for key,method,args in extra:
    obj=dict(source='Tushare supplemental API (no corresponding MCP tool)',method=method,arguments=args,retrieved_at=datetime.now().astimezone().isoformat())
    try:
        frame=getattr(pro,method)(**args)
        obj.update(status='ok',rows=json.loads(frame.to_json(orient='records',force_ascii=False)),row_count=len(frame))
    except Exception as exc:
        obj.update(status='error',message=str(exc))
    (OUT/f'{key}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    audit.append({k:obj.get(k) for k in ['status','row_count','message']}|dict(key=key,tool=method))
(OUT/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(audit,ensure_ascii=False,indent=2))
