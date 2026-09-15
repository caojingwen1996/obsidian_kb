import json, os, sys
from pathlib import Path
from datetime import datetime
from statistics import mean
ROOT=Path(__file__).resolve().parents[1]; P=ROOT/'sources/assets/徐工机械/2026-09-15-1800'
os.environ['NO_PROXY']='api.tushare.pro'
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient
pro=TushareClient().pro()
calls=[('etfshare','fund_share',dict(ts_code='159542.SZ',start_date='20260701',end_date='20260915')),('etfnav','fund_nav',dict(ts_code='159542.SZ',start_date='20260701',end_date='20260915')),('etfportfolio','fund_portfolio',dict(ts_code='159542.SZ',period='20260630')),('cashflow_extra','cashflow',dict(ts_code='000425.SZ',period='20260630',fields='ts_code,ann_date,end_date,n_cashflow_act,c_pay_acq_const_fiolta'))]
calls += [(code+'adj','adj_factor',dict(ts_code=code,start_date='20260801',end_date='20260915')) for code in ['600031.SH','000157.SZ','000528.SZ']]
for key,method,args in calls:
    o=dict(source='Tushare supplemental API',method=method,arguments=args,retrieved_at=datetime.now().astimezone().isoformat())
    try:
        frame=getattr(pro,method)(**args);o.update(status='ok',rows=json.loads(frame.to_json(orient='records',force_ascii=False)),row_count=len(frame))
    except Exception as e:o.update(status='error',message=str(e))
    (P/f'{key}.json').write_text(json.dumps(o,ensure_ascii=False,indent=2),encoding='utf-8')
    print(key,json.dumps(o if key in ['cashflow_extra','etfportfolio'] else {k:o.get(k) for k in ['status','row_count','message']},ensure_ascii=False))
calc=json.loads((P/'calculation.json').read_text(encoding='utf-8'))
d=calc['recent_days']; up=[r for r in d if '20260904'<=r['trade_date']<='20260909'];down=[r for r in d if '20260910'<=r['trade_date']<='20260915']
wave=dict(up_n=len(up),up_vol=mean(r['vol'] for r in up),up_return=(8.38/7.93-1)*100,down_n=len(down),down_vol=mean(r['vol'] for r in down),down_return=(7.81/8.38-1)*100,ratio=mean(r['vol'] for r in down)/mean(r['vol'] for r in up))
calc['wave']=wave
shares=json.loads((P/'etfshare.json').read_text(encoding='utf-8')).get('rows',[])
navs={r['nav_date']:r['unit_nav'] for r in json.loads((P/'etfnav.json').read_text(encoding='utf-8')).get('rows',[])}
shares.sort(key=lambda r:r['trade_date'],reverse=True)
flows=[dict(date=r['trade_date'],change=r['fd_share']-shares[i+1]['fd_share'],nav=navs.get(r['trade_date']),estimate=(r['fd_share']-shares[i+1]['fd_share'])*navs[r['trade_date']]/10000 if navs.get(r['trade_date']) else None) for i,r in enumerate(shares[:-1])]
calc['etf']={n:dict(start=flows[n-1]['date'],end=flows[0]['date'],net=sum(r['estimate'] for r in flows[:n]) if all(r['estimate'] is not None for r in flows[:n]) else None,share_change=sum(r['change'] for r in flows[:n])) for n in [1,5,20]} if len(flows)>=20 else {'gap':'不足20日'}
aligned=[r for r in flows if r['date']<='20260914']
calc['etf_aligned']={n:dict(start=aligned[n-1]['date'],end=aligned[0]['date'],net=sum(r['estimate'] for r in aligned[:n]) if all(r['estimate'] is not None for r in aligned[:n]) else None,share_change=sum(r['change'] for r in aligned[:n])) for n in [1,5,20]}
calc['peer_adj']={code:sorted(set(r['adj_factor'] for r in json.loads((P/(code+'adj.json')).read_text(encoding='utf-8')).get('rows',[]))) for code in ['600031.SH','000157.SZ','000528.SZ']}
(P/'calculation.json').write_text(json.dumps(calc,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:calc[k] for k in ['wave','etf','etf_aligned','peer_adj']},ensure_ascii=False,indent=2))
