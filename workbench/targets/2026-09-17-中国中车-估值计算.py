"""Calculate model, accounting reconciliations and dated trading windows."""
import importlib.util
import json
from datetime import datetime
from pathlib import Path
import sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('crrc_inputs', Path(__file__).with_name('2026-09-17-中国中车-估值复核.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
OUT, ROOT, save = mod.OUT, mod.ROOT, mod.save

def rows(name):
    return json.loads((OUT/(name+'.json')).read_text(encoding='utf-8'))['rows']

def financial(name, period):
    arr = [r for r in rows(name) if r.get('end_date') == period and r.get('ann_date', '') <= '20260917'
           and r.get('report_type', '1') in ('1', '4')]
    arr.sort(key=lambda r:(r.get('ann_date') or '', r.get('update_flag') or ''), reverse=True)
    return arr[0]

def value(r, k):
    v = r.get(k)
    return None if v is None else v/1e8

prices=sorted(rows('daily'), key=lambda r:r['trade_date'])
basics=sorted(rows('daily_basic'), key=lambda r:r['trade_date'])
adj={r['trade_date']:r['adj_factor'] for r in rows('adj_factor')}
flows=rows('moneyflow')
margins=sorted(rows('margin_detail'), key=lambda r:r['trade_date'])
windows=[]
for n in (5,10,20):
    start,end=prices[-n-1],prices[-1]
    matched=[r for r in flows if start['trade_date']<r['trade_date']<=end['trade_date']]
    ms,me=margins[-n-1],margins[-1]
    windows.append(dict(days=n,start=start['trade_date'],end=end['trade_date'],
        adjusted_return_pct=(end['close']*adj[end['trade_date']]/(start['close']*adj[start['trade_date']])-1)*100,
        large_net_100m=sum(r['buy_lg_amount']+r['buy_elg_amount']-r['sell_lg_amount']-r['sell_elg_amount'] for r in matched)/10000,
        financing_start=ms['trade_date'],financing_end=me['trade_date'],financing_100m=me['rzye']/1e8,
        financing_change_pct=(me['rzye']/ms['rzye']-1)*100))
history=[]
for period in ['20221231','20231231','20241231','20251231','20250630','20260630']:
    i,c,b,f=[financial(name,period) for name in ['income','cashflow','balancesheet','fina_indicator']]
    history.append(dict(period=period,revenue=value(i,'revenue'),profit=value(i,'n_income_attr_p'),
        recurring=value(f,'profit_dedt'),cfo=value(c,'n_cashflow_act'),capex=value(c,'c_pay_acq_const_fiolta'),
        fcf_proxy=value(c,'n_cashflow_act')-value(c,'c_pay_acq_const_fiolta'),gross_margin=f.get('grossprofit_margin'),
        roe=f.get('roe'),equity=value(b,'total_hldr_eqy_exc_min_int'),
        cash_equivalents=value(c,'c_cash_equ_end_period')))
b=financial('balancesheet','20260630')
shares=basics[-1]['total_share']/10000
eq=value(b,'total_hldr_eqy_exc_min_int')
vals=[eq*a*pb/shares for a,pb in zip([.92,.96,1],[1,1.1,1.2])]
price=prices[-1]['close']
l,m,h=vals
u,d=h/price-1,1-l/price
kelly=[dict(p=p,theoretical=p/d-(1-p)/u,full=min(1,max(0,p/d-(1-p)/u)),half=min(1,max(0,p/d-(1-p)/u))/2) for p in [.5,.6,.7,.8,.9]]
model=dict(name='中国中车',code='601766.SH',skill='4.5.0',as_of=datetime.now().isoformat(timespec='seconds'),
    price_date=prices[-1]['trade_date'],price=price,shares_100m=shares,equity_100m=eq,values=vals,
    assumptions={'asset_recognition':[.92,.96,1.0],'pb':[1,1.1,1.2],'normalized_eps':[.48,.50,.52], 'pe':[12,13,14.5]},
    cross_values=[.48*12,.50*13,.52*14.5],history=history,windows=windows,
    price_metrics={'mid_premium_pct':(price/m-1)*100,'upper_deviation_pct':(price/h-1)*100,
                   'mid_return_pct':(m/price-1)*100,'conservative_margin_pct':(1-price/l)*100,
                   'residual':price-m,'residual_range':[price-h,price-l]},
    reverse={'recognized_pb':price/(eq*.96/shares),'book_pb':price/(eq/shares),
             'eps_at_13pe':price/13,'profit_at_13pe_100m':price/13*shares,
             'a_price_equivalent_equity_100m':price*shares},
    kelly={'u':u,'d':d,'p0':d/(u+d),'rows':kelly},
    sensitivities=[[a,pb,eq*a*pb/shares] for a in [.8,.9,.92,.96,1] for pb in [1,1.1,1.2]],
    peer_basics={code:rows('daily_basic-'+code) for code in ['688187.SH','688009.SH']},
    locomotives_revenue_share=107/(131682442/1e5),
    event_price_return_0914_0916_pct=(prices[-1]['close']/next(r['close'] for r in prices if r['trade_date']=='20260914')-1)*100,
    average_amount_5_100m=sum(r['amount'] for r in prices[-5:])/5/100000,
    average_amount_20_100m=sum(r['amount'] for r in prices[-20:])/20/100000)
save('model.json',model)
save('financial-selected.json',{name:{period:financial(name,period) for period in ['20260630','20250630','20251231']}
                               for name in ['income','cashflow','balancesheet','fina_indicator']})
print(json.dumps(model,ensure_ascii=False,indent=2))

# Supplement the failed range-style Dragon/Tiger request with valid daily queries.
top=[mod.fetch(('top_list-'+r['trade_date'],'top_list',dict(ts_code='601766.SH',trade_date=r['trade_date']))) for r in prices[-5:]]
save('top_list-retry-log.json',top)

import requests
from bs4 import BeautifulSoup
urls={
 'nbs-202608':'https://www.stats.gov.cn/sj/sjjd/202609/t20260915_1965330.html',
 'nbs-202607':'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260817_1965049.html',
 'announcement-index':'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/601766.phtml'}
web=[]
for label,url in urls.items():
    try:
        res=requests.get(url,timeout=30)
        res.raise_for_status()
        res.encoding='gb18030' if 'sina.com' in url else 'utf-8'
        soup=BeautifulSoup(res.text,'html.parser')
        content=soup.select_one('.TRS_Editor') or soup.select_one('#wrap') or soup
        (OUT/(label+'.html')).write_bytes(res.content)
        (OUT/(label+'.txt')).write_text(content.get_text('\n',strip=True),encoding='utf-8')
        web.append(dict(name=label,url=url,status='ok',retrieved_at=datetime.now().isoformat(timespec='seconds')))
    except Exception as exc:
        web.append(dict(name=label,url=url,status='error',error=str(exc)))
save('web-retrieval.json',web)
print(json.dumps(web,ensure_ascii=False))
