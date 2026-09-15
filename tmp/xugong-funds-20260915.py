"""Fresh local MCP evidence and reproducible volume audit for XCMG."""
import json, os, subprocess, sys
from pathlib import Path
from datetime import datetime
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'sources/assets/徐工机械/2026-09-15-1800'
OUT.mkdir(parents=True,exist_ok=True)
os.environ['NO_PROXY']='api.tushare.pro'
os.environ['PYTHONIOENCODING']='utf-8'
base=dict(ts_code='000425.SZ',start_date='20260701',end_date='20260915',use_cache=False,limit=1000)
calls=[('basic','get_stock_basic',dict(ts_code='000425.SZ',use_cache=False)),('daily','get_stock_daily',dict(base,start_date='20250915')),('valuation','get_stock_valuation',base),('moneyflow','get_stock_moneyflow',base),('margin','get_margin_detail',base),('holders','get_shareholder_count',dict(base,start_date='20250101')),('financial','get_financial_statements',dict(ts_code='000425.SZ',period='20260630',use_cache=False)),('dividend','get_dividend_history',dict(ts_code='000425.SZ',use_cache=False)),('huijin','check_central_huijin_holding',dict(ts_code='000425.SZ',use_cache=False))]
requests=[dict(jsonrpc='2.0',id=0,method='initialize',params={})]+[dict(jsonrpc='2.0',id=i+1,method='tools/call',params=dict(name=n,arguments=a)) for i,(_,n,a) in enumerate(calls)]
run=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'tools/tushare-data/scripts/mcp_server.py')],input='\n'.join(json.dumps(r) for r in requests)+'\n',capture_output=True,text=True,encoding='utf-8',timeout=180)
responses={r['id']:r for r in map(json.loads,run.stdout.splitlines())}
audit=[]
def save(key,obj):
    obj['retrieved_at']=datetime.now().astimezone().isoformat()
    (OUT/f'{key}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
for i,(key,tool,args) in enumerate(calls):
    response=responses[i+1]
    payload=response['result']['structuredContent']
    save(key,dict(source='local MCP stdio',tool=tool,arguments=args,response=response,payload=payload))
    audit.append(dict(key=key,status='error' if payload.get('error') else 'ok',rows=payload.get('row_count'),message=payload.get('message')))
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient
pro=TushareClient().pro()
extras=[('adj','adj_factor',dict(ts_code='000425.SZ',start_date='20250915',end_date='20260915')),('block','block_trade',dict(ts_code='000425.SZ',start_date='20260701',end_date='20260915')),('repurchase','repurchase',dict(ts_code='000425.SZ',start_date='20260101',end_date='20260915')),('holdertrade','stk_holdertrade',dict(ts_code='000425.SZ',start_date='20260101',end_date='20260915')),('pledge','pledge_stat',dict(ts_code='000425.SZ')),('unlock','share_float',dict(ts_code='000425.SZ',start_date='20260915',end_date='20270315')),('chips','cyq_perf',dict(ts_code='000425.SZ',start_date='20260801',end_date='20260915')),('hk','hk_hold',dict(ts_code='000425.SZ',start_date='20260801',end_date='20260915')),('top10','top10_holders',dict(ts_code='000425.SZ',period='20260630')),('csi300','index_daily',dict(ts_code='000300.SH',start_date='20260701',end_date='20260915')),('peer600031','daily',dict(ts_code='600031.SH',start_date='20260701',end_date='20260915')),('peer000157','daily',dict(ts_code='000157.SZ',start_date='20260701',end_date='20260915')),('peer000528','daily',dict(ts_code='000528.SZ',start_date='20260701',end_date='20260915')),('breadth','daily',dict(trade_date='20260915'))]
for key,method,args in extras:
    obj=dict(source='Tushare supplemental API',method=method,arguments=args)
    try:
        frame=getattr(pro,method)(**args)
        obj.update(status='ok',rows=json.loads(frame.to_json(orient='records',force_ascii=False)),row_count=len(frame))
    except Exception as exc: obj.update(status='error',message=str(exc))
    save(key,obj)
    audit.append(dict(key=key,status=obj['status'],rows=obj.get('row_count'),message=obj.get('message')))
days=json.loads((OUT/'daily.json').read_text(encoding='utf-8'))['payload']['rows'][:20]
top=[]
for day in days:
    date=day['trade_date'].replace('-','')
    try:
        frame=pro.top_list(trade_date=date,ts_code='000425.SZ')
        top.append(dict(trade_date=date,status='ok',rows=json.loads(frame.to_json(orient='records',force_ascii=False))))
    except Exception as exc: top.append(dict(trade_date=date,status='error',message=str(exc)))
save('top',dict(source='Tushare top_list by trading date',queries=top))
save('audit',dict(calls=audit))
print(json.dumps(audit,ensure_ascii=False))
