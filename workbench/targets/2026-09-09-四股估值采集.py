from pathlib import Path
import sys,json,datetime
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient,frame_to_rows
OUT=ROOT/'sources/assets/2026-09-09-四股估值复算'
OUT.mkdir(parents=True,exist_ok=True)
stocks={'中国中车':'601766.SH','徐工机械':'000425.SZ','华润江中':'600750.SH','国药股份':'600511.SH'}
pro=TushareClient(cache_ttl_seconds=0,retries=1).pro()
jobs=[]
for name,code in stocks.items():
 for api in ['stock_basic','daily','daily_basic','adj_factor','moneyflow','margin_detail','stk_holdernumber','income','balancesheet','cashflow','fina_indicator','dividend','repurchase','stk_holdertrade','block_trade']:
  params={'ts_code':code}
  if api in ['daily','daily_basic','adj_factor','moneyflow','margin_detail']:params.update(start_date='20260601',end_date='20260908')
  if api in ['income','balancesheet','cashflow','fina_indicator']:params.update(start_date='20220101',end_date='20260909')
  if api in ['repurchase','stk_holdertrade','block_trade','stk_holdernumber']:params.update(start_date='20250101',end_date='20260909')
  if api=='cashflow':params['fields']='ts_code,ann_date,f_ann_date,end_date,report_type,n_cashflow_act,c_pay_acq_const_fiolta,c_cash_equ_end,n_cashflow_inv_act,n_cash_flows_fnc_act,free_cashflow'
  jobs.append((name,api,params))
for api,params in [('cn_cpi',{'start_m':'202606','end_m':'202608'}),('cn_ppi',{'start_m':'202606','end_m':'202608'}),('shibor',{'start_date':'20260801','end_date':'20260909'}),('cn_m',{'start_m':'202606','end_m':'202608'}),('shibor_lpr',{'start_date':'20260701','end_date':'20260909'}),('yc_cb',{'start_date':'20260801','end_date':'20260909','curve_type':'0','curve_term':10}),('daily',{'trade_date':'20260908'}),('daily',{'trade_date':'20260901'})]:
 jobs.append(('共同市场',api,params))
def get(j):
 name,api,params=j;folder=OUT/name;folder.mkdir(exist_ok=True)
 suffix='-'+params['trade_date'] if 'trade_date' in params else ''
 result={'company':name,'api':api,'params':params,'retrieved':datetime.datetime.now().isoformat()}
 try:
  rows=frame_to_rows(getattr(pro,api)(**params),set())
  (folder/(api+suffix+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
  result['rows']=len(rows)
 except Exception as e:result['error']=str(e)
 print(json.dumps(result,ensure_ascii=False),flush=True)
 return result
with ThreadPoolExecutor(max_workers=4) as pool:
 results=list(pool.map(get,jobs))
(OUT/'retrieval.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')