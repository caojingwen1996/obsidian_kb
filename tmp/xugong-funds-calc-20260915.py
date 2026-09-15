import json
from pathlib import Path
from statistics import mean
P=Path(__file__).resolve().parents[1]/'sources/assets/徐工机械/2026-09-15-1800'
def obj(k): return json.loads((P/f'{k}.json').read_text(encoding='utf-8'))
def rows(k):
    o=obj(k); r=o.get('payload',o).get('rows',[])
    for x in r:
        for f in ('trade_date','nav_date'): 
            if f in x: x[f]=x[f].replace('-','')
    return sorted(r,key=lambda x:x.get('trade_date',x.get('nav_date','')),reverse=True)
d=rows('daily'); m=rows('moneyflow'); f=rows('margin'); v=rows('valuation')
a={r['trade_date']:r['adj_factor'] for r in rows('adj')}
for r in d: r['adj_close']=r['close']*a[r['trade_date']]/a[d[0]['trade_date']]
def ret(data,n,offset=0): return (data[offset]['adj_close' if 'adj_close' in data[offset] else 'close']/data[offset+n]['adj_close' if 'adj_close' in data[offset+n] else 'close']-1)*100
result={'latest':d[0],'ma':{n:mean(r['adj_close'] for r in d[:n]) for n in [5,10,20,60,120]},'return':{n:ret(d,n) for n in [1,5,20]},'dates':{n:[d[n-1]['trade_date'],d[0]['trade_date']] for n in [5,20]},'valuation':v[0], 'adj_changes_60':sorted(set(a[r['trade_date']] for r in d[:60]))}
result['volume']={n:{'dates':[d[n]['trade_date'],d[1]['trade_date']], 'mean_vol':mean(r['vol'] for r in d[1:n+1]),'ratio':d[0]['vol']/mean(r['vol'] for r in d[1:n+1]),'mean_amount':mean(r['amount'] for r in d[1:n+1]),'mean_turnover':mean(r['turnover_rate'] for r in v[1:n+1])} for n in [5,20]}
result['five_windows']=[{'start':d[o+4]['trade_date'],'end':d[o]['trade_date'],'mean_vol':mean(r['vol'] for r in d[o:o+5]),'return':ret(d,5,o)} for o in [0,5]]
group={}
for name,sign in [('up',1),('down',-1),('flat',0)]:
    sample=[r for i,r in enumerate(d[:20]) if (1 if r['adj_close']>d[i+1]['adj_close'] else -1 if r['adj_close']<d[i+1]['adj_close'] else 0)==sign]
    group[name]={'n':len(sample),'mean_vol':mean(r['vol'] for r in sample) if sample else None}
result['groups']=group
result['flow']={n:{s:sum(r['buy_'+s+'_amount']-r['sell_'+s+'_amount'] for r in m[:n])/10000 for s in ['sm','md','lg','elg']}|{'start':m[n-1]['trade_date'],'end':m[0]['trade_date'],'positive_large_days':sum(r['buy_lg_amount']+r['buy_elg_amount']>r['sell_lg_amount']+r['sell_elg_amount'] for r in m[:n])} for n in [1,5,10,20]}
result['margin']={n:dict(start=f[n-1]['trade_date'],end=f[0]['trade_date'],net=sum(r['rzmre']-r['rzche'] for r in f[:n])/1e8,opening=f[n]['rzye']/1e8,closing=f[0]['rzye']/1e8,identity_error=(f[0]['rzye']-f[n]['rzye']-sum(r['rzmre']-r['rzche'] for r in f[:n]))) for n in [1,5,20]}
result['margin_latest']=f[0]
result['conservation_max_wanyuan']=max(abs(sum(r['buy_'+s+'_amount']-r['sell_'+s+'_amount'] for s in ['sm','md','lg','elg'])) for r in m)
result['recent_days']=[{k:r[k] for k in ['trade_date','close','high','low','vol','pct_chg']}|{'v20':r['vol']/mean(z['vol'] for z in d[i+1:i+21]),'large':(m[i]['buy_lg_amount']+m[i]['buy_elg_amount']-m[i]['sell_lg_amount']-m[i]['sell_elg_amount'])/10000} for i,r in enumerate(d[:21])]
result['comparators']={k:{n:ret(rows(k),n) for n in [1,5,20]} for k in ['csi300','peer600031','peer000157','peer000528']}
b=rows('breadth');result['breadth']={s:sum(1 for r in b if (r['pct_chg']>0 if s=='up' else r['pct_chg']<0 if s=='down' else r['pct_chg']==0)) for s in ['up','down','flat']}
result['extra']={k:rows(k)[:10] for k in ['block','holders','top10','unlock','pledge','repurchase','holdertrade']}
result['top']=[q for q in obj('top')['queries'] if q.get('rows') or q['status']!='ok']
result['financial']={k:[{f:r.get(f) for f in ['end_date','revenue','total_revenue','n_income_attr_p','n_cashflow_act','c_pay_acq_const_fiolta','money_cap','total_liab','total_assets']} for r in x.get('rows',[])[:1]] for k,x in obj('financial')['payload']['statements'].items()}
(P/'calculation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
