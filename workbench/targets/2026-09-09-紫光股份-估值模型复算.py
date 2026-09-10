from pathlib import Path
import json, datetime, math
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'sources/assets/紫光股份/2026-09-09-revalue'
def rows(n): return json.loads((P/(n+'.json')).read_text(encoding='utf-8'))
def latest(n): return sorted(rows(n),key=lambda x:x.get('trade_date',''))[-1]
def period(n,d):
    return next(x for x in rows(n) if x.get('end_date','').replace('-','')==d and x.get('report_type','1')=='1')
S=latest('daily_basic')['total_share']/10000
price=latest('daily_basic')['close']
years=(datetime.date(2026,12,31)-datetime.date(2026,9,9)).days/365
discount=1.12**years
fx=500883534.62/1e8
np_h1=period('fina_indicator','20260630')['profit_dedt']/1e8
normal_h1=np_h1-fx*.75*.8798
scenarios=[]
for name,profit,distribution,pe,distpe,cashratio,growth in [('悲观',30,2,24,12,.65,.10),('基准',35,2.5,28,14,.80,.15),('乐观',40,3,32,16,.90,.20)]:
    core=profit-distribution
    end_equity=core*pe+distribution*distpe
    fv=end_equity/S/discount
    cash=[profit*cashratio*(1+growth)**i for i in range(1,6)]
    pv=sum(v/(1.12**i) for i,v in enumerate(cash,1))
    tv=cash[-1]*1.03/(.12-.03)/1.12**5
    cash_value=(pv+tv)/S/discount
    scenarios.append(dict(name=name,profit=profit,distribution_profit=distribution,core_profit=core,core_pe=pe,distribution_pe=distpe,year_end_equity=end_equity,fair_value=fv,h2_required=profit-normal_h1,cash_conversion=cashratio,cash_growth=growth,cashflows_2027_2031=cash,forecast_pv_at_2026_end=pv,terminal_pv_at_2026_end=tv,terminal_share=tv/(pv+tv),cash_pressure_value=cash_value))
L,M,H=[x['fair_value'] for x in scenarios]
u=H/price-1;d=1-L/price
kelly=[dict(p=p,theoretical=p/d-(1-p)/u,constrained=max(0,min(1,p/d-(1-p)/u)),half=max(0,min(1,p/d-(1-p)/u))/2) for p in [.5,.6,.7,.8,.9]]
flows={}
daily=sorted(rows('daily'),key=lambda x:x['trade_date']);mf=sorted(rows('moneyflow'),key=lambda x:x['trade_date']);margin=sorted(rows('margin_detail'),key=lambda x:x['trade_date'])
for n in [5,10,20]:
    flows[n]=dict(start=daily[-n-1]['trade_date'],end=daily[-1]['trade_date'],price_return=price/daily[-n-1]['close']-1,large_net=sum(x['buy_lg_amount']+x['buy_elg_amount']-x['sell_lg_amount']-x['sell_elg_amount'] for x in mf[-n:])/10000,margin_change=margin[-1]['rzye']/margin[-n-1]['rzye']-1)
debt=[]
for date,lease,other,div,rep in [('20260630',709541544.43,1963853.04,791780085.62,4446099542),('20251231',725671416.43,9540163117.01,0,0)]:
    b=period('balancesheet',date);c=period('cashflow-explicit',date)
    expanded=(b['st_borr']+b['lt_borr']+b['non_cur_liab_due_1y']+lease+(b['lt_payable'] or 0)+div+rep)/1e8
    core=expanded-(other+div+rep)/1e8
    debt.append(dict(period=date,core_debt=core,expanded_debt=expanded,cash=c['c_cash_equ_end_period']/1e8,short_investments=b['trad_asset']/1e8,strict_net_cash=c['c_cash_equ_end_period']/1e8-core,extended_net_cash=c['c_cash_equ_end_period']/1e8-expanded))
base=scenarios[1]
required_total=(price*S*discount-base['distribution_profit']*base['distribution_pe'])/base['core_pe']+base['distribution_profit']
base_2025=period('fina_indicator','20251231')['profit_dedt']/1e8
reverse_growth=lambda target,n,ref:(target/ref)**(1/n)-1
matrix=[[((profit-2.5)*pe+2.5*14)/S/discount for pe in [24,28,32]] for profit in [30,35,40]]
cash_base=base['cash_pressure_value']
model=dict(version='4.4.3-recalculation',as_of='2026-09-09',price_date='2026-09-08',price=price,shares_in_100m=S,years=years,discount=discount,normalised_h1_sensitivity=normal_h1,normalised_h1_range=[np_h1-fx*.75,np_h1-fx*.75*.81],scenarios=scenarios,kelly=dict(u=u,d=d,break_even=d/(u+d),odds=u/d,rows=kelly),price_position=dict(premium_mid=price/M-1,deviation_upper=price/H-1,upside_mid=M/price-1,conservative_margin=1-price/L,outside_upper=max(0,price-H),mid_residual=price-M),reverse=dict(required_profit=required_total,required_h2=required_total-normal_h1,required_cash_conversion=base['cash_conversion']*price/cash_base,required_profit_growth_3y=reverse_growth(required_total,3,base_2025),growth_years_at_20pct=math.log(required_total/base_2025)/math.log(1.2),required_ict_multiple=(price*S*discount-35)/32.5),flows=flows,debt=debt,sensitivity_matrix=matrix,issuance=dict(new_shares_max=4.3,diluted_shares=S+4.3,baseline_no_savings=M*S/(S+4.3),annual_savings_upper=(33.9+16.2)*.03*.75,with_upper_savings=(base['year_end_equity']+(33.9+16.2)*.03*.75*28)/(S+4.3)/discount),repurchase_cost_stress=44.46099542/S,baseline_higher_discount=base['year_end_equity']/S/1.14**years)
(ROOT/'workbench/targets/2026-09-09-紫光股份-估值模型.json').write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(model,ensure_ascii=False,indent=2))
