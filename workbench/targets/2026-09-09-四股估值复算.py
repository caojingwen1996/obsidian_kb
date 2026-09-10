"""以本次原始快照重算；沿用并显式复核已有经营假设，输出六章报告。"""
from pathlib import Path
import json,re,datetime,subprocess
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'sources/assets/2026-09-09-四股估值复算'
STAMP=datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
NAMES={'中国中车':'601766.SH','徐工机械':'000425.SZ','华润江中':'600750.SH','国药股份':'600511.SH'}
STATES=['有利','当期恶化，持续性待确认','不利信号出现','证据不足','不适用']
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,s):p.write_text(s,encoding='utf-8')
def table(head,rows):return '\n'.join(['| '+' | '.join(head)+' |','| '+' | '.join(['---']*len(head))+' |']+['| '+' | '.join(map(str,row))+' |' for row in rows])+'\n\n'
def num(x):return '未获取到' if x is None else f'{x:.2f}'
def pct(x):return f'{x*100:+.2f}%'
def rows(n,a):return load(RAW/n/(a+'.json'))
def pick(n,a,end):
 arr=[x for x in rows(n,a) if x.get('end_date')==end and x.get('report_type','1')=='1']
 arr.sort(key=lambda x:(x.get('f_ann_date') or x.get('ann_date') or '',sum(v is not None for v in x.values())),reverse=True)
 if not arr:raise ValueError((n,a,end))
 return arr[0]
def val(row,key):return None if row.get(key) is None else row[key]/1e8
def historic(n):
 result=[]
 for dt in ['20221231','20231231','20241231','20251231','20250630','20260630']:
  i=pick(n,'income',dt);c=pick(n,'cashflow',dt);f=pick(n,'fina_indicator',dt)
  result.append([dt,val(i,'revenue'),val(i,'n_income_attr_p'),val(f,'profit_dedt'),val(c,'n_cashflow_act'),val(c,'c_pay_acq_const_fiolta'),val(c,'n_cashflow_act')-val(c,'c_pay_acq_const_fiolta')])
 return result
def merged(n,a):
 data=rows(n,a);extra=list((RAW/n).glob(a+'-*-20260909.json'))
 if a in ['daily','daily_basic']:extra=[RAW/n/(a+'-followup.json')]
 for p in extra:data+=load(p)['rows']
 return sorted({x['trade_date']:x for x in data}.values(),key=lambda x:x['trade_date'],reverse=True)
def markets(n):
 d=merged(n,'daily');m=merged(n,'moneyflow');a={x['trade_date']:x['adj_factor'] for x in merged(n,'adj_factor')};rz=merged(n,'margin_detail');out=[]
 for w in [5,10,20]:
  r=d[0]['close']*a[d[0]['trade_date']]/(d[w]['close']*a[d[w]['trade_date']])-1
  mf=sum(x['buy_lg_amount']+x['buy_elg_amount']-x['sell_lg_amount']-x['sell_elg_amount'] for x in m if d[w]['trade_date']<x['trade_date']<=d[0]['trade_date'])/10000
  rr=rz[0]['rzye']/rz[w]['rzye']-1
  out.append({'window':w,'start':d[w]['trade_date'],'end':d[0]['trade_date'],'return':r,'large_flow':mf,'rz_start':rz[w]['trade_date'],'rz_end':rz[0]['trade_date'],'rz_change':rr})
 return out,rz[0]
macro='9月9日国家统计局公布：8月CPI同比+0.8%（7月+0.5%），核心+1.0%；PPI同比+3.8%（7月+3.5%），环比由−0.7%转为+0.4%。当月价格压力回升已确认，尚不能据此认定货币政策被迫收紧。接口通胀表只到7月，本次改用国家统计局原文。'
macroref='[[sources/assets/2026-09-09-四股估值复算/共同市场/8月通胀解读.txt|国家统计局8月通胀解读原文]]'
industry={
'中国中车':'成熟轨道装备及维保利润池，系统集成、认证和存量服务是优势；城轨、新产业和海外项目回款构成约束。CR450等新技术不另计未验证期权；订单规模必须兑现为毛利与现金。',
'徐工机械':'成熟工程机械的设备替换、出口与矿机利润池，产品谱系及海外服务网络支持订单；海外竞争、汇率和回款压制净利。新能源机械已有产品但缺独立归母现金路径，维持整体正常化盈利估值，不单加期权。',
'华润江中':'成熟OTC品牌与渠道利润池，重复购买和终端覆盖提供优势；渠道库存、动销、药材和推广投入制约盈利恢复。新产品尚缺独立投入与成功率，不额外资本化。',
'国药股份':'成熟专业药品渠道、医院配送及权益法制造收益；许可和服务网络具有门槛，但不等于独占。毛利、应收和参股分红决定利润归属，新业务无独立可审计现金路径，不给期权溢价。'}
events={
'中国中车':'9月9日16:00—17:00半年度说明会；本次未取得完整问答，不预先计入新增订单或指引。已披露H1财报仍为经营基线；后续问答若改变项目回款或利润率，触发局部重算。',
'徐工机械':'9月5日投资者关系记录及9月1日回购公告已纳入核验；截至8月31日回购3,680.64万股、3.4485亿元，回购并非当日二级市场新增买盘。H1每股0.045元分红仍按预案识别，不提前算已到账。',
'华润江中':'9月3日实施公告：每股0.50元，9月10日登记、9月11日除息发放。9月9日收盘仍含息，不能提前除息或重复加分红收益。H1股本635,613,289股，7月完成注销25,000股，现股本635,588,289股，按最新股数计算。',
'国药股份':'9月5日股东会公告显示9月4日金融服务协议续签议案未通过；不能推断现有存款已冻结。国瑞拟出售部分股权尚未核验到交割完成，不提前加处置收益、全部亏损转回或剩余权益重估。'}
risks={
'中国中车':'回款恶化或项目资产减值超出8%的保守认可折扣，须重算PB；正常化EPS不能达到0.48—0.52元时同步下修盈利约束。新订单只有交付、利润率与回款得到验证后才支持上修。',
'徐工机械':'68—80亿元正常化归母需要盈利恢复，若扣非继续下降或融资期限持续缩短，不能维持原利润假设；基准75亿元较历史仍有恢复要求。FCF持续为负、海外毛利走低或续贷条件变差触发下修；60亿元×10倍为额外尾部。',
'华润江中':'9.22—9.85亿元正常化归母需要动销和全年现金持续性支持；若收入及扣非继续下滑、推广费用失效，重算EPS与PE。现金压力价值16.25元低于区间下限；除息后同步调整价格和未来分配口径。',
'国药股份':'核心盈利、权益法利润或分红现金继续下降，及医院回款恶化，将击中分拆合理PE。国瑞交割、金融服务替代安排或信用减值变化触发局部重算；现金化仅75%、零增长及11%回报要求对应区间以下尾部。'}
manifest=[]
for name,code in NAMES.items():
 old=next(p for p in (ROOT/'workbench/targets').glob('*'+name+'*机构级决策研报.md') if p.name.startswith('2026-'))
 backup=RAW/name/'previous-report.md'
 if not backup.exists():write(backup,old.read_text(encoding='utf-8-sig'))
 s=backup.read_text(encoding='utf-8-sig');oldhtml=next((ROOT/'sources/automations').rglob(old.stem+'.html'));new=old.with_name(name+'-机构级决策研报.md');html=oldhtml.with_name(name+'-机构级决策研报.html')
 if new.exists() and not (RAW/name/'model.json').exists():raise ValueError('目标已存在，需核验冲突 '+str(new))
 db=load(RAW/name/'daily_basic-followup.json')['rows'][0];price=db['close'];shares=db['total_share']/1e4
 b=pick(name,'balancesheet','20260630');eq=val(b,'total_hldr_eqy_exc_min_int');hist=historic(name);h=hist[-1];prev=hist[-2];annual=hist[3]
 ttm=annual[2]+h[2]-prev[2];ttmd=annual[3]+h[3]-prev[3];revchange=h[1]/prev[1]-1;profchange=h[3]/prev[3]-1
 method={'中国中车':'PB（归母净资产×资产认可比例×PB）','徐工机械':'正常化盈利估值（正常化归母利润×周期PE）','华润江中':'合理PE（正常化归母利润×合理PE）','国药股份':'合理PE（归母正常化利润按来源分拆）'}[name]
 if name=='中国中车':values=[eq*r*p/shares for r,p in zip([.92,.96,1],[1,1.1,1.2])];profits=[shares*x for x in [.48,.50,.52]];pes=[12,13,14.5];cross=[.48*12,.50*13,.52*14.5];reverse=price/(eq/shares*.96)
 elif name=='徐工机械':profits=[68,75,80];pes=[12,12.8,14];values=[p*pe/shares for p,pe in zip(profits,pes)];cross=[eq/shares*(.1097-.02)/(ke-.02) for ke in [.11,.10,.09]];reverse=price*shares/12.8
 elif name=='华润江中':profits=[shares*x for x in [1.45,1.50,1.55]];pes=[15,17,19];values=[p*pe/shares for p,pe in zip(profits,pes)];cross=[p*.65/.06/shares for p in profits];reverse=price*shares/17
 else:profits=[17.8,20,22.2];pes=None;values=[x/shares for x in [13*9+4.8*10,14.5*11+5.5*12,16*12+6.2*14]];cross=[(p/eq-g)/(ke-g)*eq/shares for p,ke,g in zip(profits,[.11,.10,.09],[0,.02,.025])];reverse=(price*shares-66)/11
 low,base,high=values;windows,rz=markets(name)
 kelly=json.loads(subprocess.check_output(['node',str(ROOT/'.agents/skills/bbxm-equity-research/scripts/calculate-kelly.cjs'),str(price),str(low),str(high),'.5','.6','.7','.8','.9'],text=True,encoding='utf-8'))
 fundamental=re.search(r'^\| 基本面状态 \| (.*?) \|$',s,re.M).group(1)
 fundamental=re.sub(r'综合：.*',{'中国中车':'综合：走弱。融资义务略降，但净现金明显减少、经营现金与FCF缺口扩大，利润增长未抵消现金压力。','徐工机械':'综合：走弱。融资期限短化、净负债扩大，FCF转负且扣非下降；经营现金增长尚不足以抵消这些约束。','华润江中':'综合：稳定。融资义务变化很小，现金减少同时理财增加；经营现金和FCF改善、扣非小幅下降，整体变化有限。','国药股份':'综合：走弱。融资义务增加、现金缓冲减少，经营现金缺口扩大且扣非利润下降。'}[name],fundamental)
 fundamental=fundamental.replace('（比较期','（2025年末',2).replace('；研发效率待验证','；研发投入效率待验证').replace('研发改善','研发费用负担下降').replace('研发恶化','研发费用负担上升')
 if name=='华润江中':fundamental=fundamental.replace('融资及长期付款义务1.59亿元（2025年末1.59亿元），融资负担较年末恶化','融资及长期付款义务1.5942亿元（2025年末1.5940亿元），融资负担微增')
 holder=sorted({x['end_date']:x for x in rows(name,'stk_holdernumber') if x.get('holder_num') is not None}.values(),key=lambda x:x['end_date'],reverse=True)[:4]
 holdertext='；'.join(x['end_date']+'：'+str(int(x['holder_num']))+'户' for x in holder)
 trend='减少、筹码户数趋于集中' if holder[0]['holder_num']<holder[1]['holder_num'] else '增加、筹码户数趋于分散'
 flowtext='9月9日复权价格5/10/20日'+ '/'.join(pct(x['return']) for x in windows)+'；大单及特大单净额代理'+ '/'.join(f"{x['large_flow']:+.2f}" for x in windows)+'亿元。融资余额截至9月8日'+f"{rz['rzye']/1e8:.2f}"+'亿元，独立5/10/20日变化'+ '/'.join(pct(x['rz_change']) for x in windows)+'。'
 reverseword=(f'现价在96%资产认可下隐含PB {reverse:.4f}倍，基准1.10倍；未折价账面PB {price*shares/eq:.4f}倍。' if name=='中国中车' else f'现价按基准倍数要求'+('核心归母' if name=='国药股份' else '正常化归母')+f'{reverse:.2f}亿元，属于价格要求，不是公司指引。')
 action='observe' if name=='国药股份' else 'wait'
 mainrows=[]
 for j,label in enumerate(['保守','基准','乐观']):
  formula=(f'{eq:.6f}×{[.92,.96,1][j]}×{[1,1.1,1.2][j]}/{shares:.8f}' if name=='中国中车' else f'{profits[j]:.8f}×{pes[j]}/{shares:.8f}' if name!='国药股份' else [f'(13×9+4.8×10)/{shares:.8f}',f'(14.5×11+5.5×12)/{shares:.8f}',f'(16×12+6.2×14)/{shares:.8f}'][j])
  mainrows.append([label,formula,f'{values[j]:.6f}元'])
 crossdesc={
 '中国中车':f'正常化盈利估值：EPS0.48/0.50/0.52×PE12/13/14.5＝{cross[0]:.2f}/{cross[1]:.2f}/{cross[2]:.2f}元。防范仅凭账面净资产判断便宜；与PB共享经营前提，仅作约束，不加权。',
 '徐工机械':f'PB/ROE：2025年ROE10.97%、g=2%、ke=11%/10%/9%，PB=(ROE−g)/(ke−g)，对应{cross[0]:.2f}/{cross[1]:.2f}/{cross[2]:.2f}元。防范正常化盈利恢复假设过强；低于盈利估值中枢，降低置信度，不机械平均。',
 '华润江中':f'可持续股东回报：正常化利润×65%现金转换率÷6%无增长现金收益率÷股数，得{cross[0]:.2f}/{cross[1]:.2f}/{cross[2]:.2f}元。防范利润未现金化及高倍数依赖增长；共享利润输入，是压力模型而非已实现FCFE，不加权。',
 '国药股份':f'PB/ROE：以正常化归母/归母净资产作为ROE，PB=(ROE−g)/(ke−g)，得到{cross[0]:.2f}/{cross[1]:.2f}/{cross[2]:.2f}元。防范低PE掩盖资本回报不足；共享正常化利润，非独立两票，不加权。'}[name]
 c3='## 3. 估值方法与假设\n\n### 计算结果速览\n\n'+f'> **估值中枢：{base:.2f}元/股；条件区间：{low:.2f}—{high:.2f}元/股。**\n>\n> **计算结论：公允价值内；新增资金 {action}，已有持仓 review。** 高于保守下限，区间本身不是安全底价。\n\n'
 c3+=table(['计算项目','一眼看结果','计算位置与边界'],[['主估值锚：'+method,' / '.join(f'{x:.2f}' for x in values)+'元','3.1—3.2，保守/基准/乐观；决定最终区间'],['交叉验证方法',' / '.join(f'{x:.2f}' for x in cross)+'元','3.3；'+crossdesc],['现价与位置',f'{price:.2f}元；相对中枢{pct(price/base-1)}','4.1：中枢潜在回报'+pct(base/price-1)],['反向估值',reverseword,'3.4；不等于公司预测'],['股数增加10%压力',f'中枢{base/1.1:.2f}元','仅假设股东总价值不变，不代表已公告发行']])
 c3+='### 3.1 主估值锚：'+method+'\n\n'+industry[name]+' 主估值锚决定区间（权重100%），交叉验证只作约束、不参与加权。净现金、债务及投资权益已体现在归母利润或净资产，不能在股东价值桥重复加减。倍数、认可比例及正常化利润为研究假设，非统计置信区间。\n\n'
 c3+='### 3.2 情景计算与假设复核\n\n'+table(['情景','可复算公式（利润/净资产亿元，股数亿股）','每股价值'],mainrows)
 c3+=f'当前总股本{shares:.8f}亿股，归母净资产{eq:.6f}亿元；2025归母{annual[2]:.2f}亿元，2026H1归母{h[2]:.2f}亿元，滚动归母{ttm:.2f}亿元、扣非{ttmd:.2f}亿元。财报与上一版为同一报告期，复核后未发现已披露数据推翻既有区间，故参数延续并重新执行运算；本次未因价格涨跌改变内在价值。\n\n'
 c3+=risks[name]+'\n\n'
 if name=='中国中车':c3+='资产认可比例92%/96%/100%、PB1.0/1.1/1.2；折扣模拟项目回收压力，不是已计提减值，也不等于正式NAV。高于上限须有资本回报、交付与回款改善证据，不能只增加资产规模。\n\n'
 elif name in ['徐工机械','华润江中']:
  c3+=table(['条件情景','正常化利润相对2025','若视作全年目标所需H2利润','对2025H2的要求'],[[['保守','基准','乐观'][j],pct(p/annual[2]-1),num(p-h[2])+'亿元',pct((p-h[2])/(annual[2]-prev[2])-1)] for j,p in enumerate(profits)])
  c3+='此表检验恢复要求；正常化盈利不是承诺2026年实现，也没有把半年利润简单乘二。保守端仍可能包含恢复，压力尾部另列，不把它误当现状不变的底价。\n\n'
 else:c3+='核心13/14.5/16亿元及权益法4.8/5.5/6.2亿元分别取PE9/11/12及10/12/14。核心TTM约13.78、权益法约5.41亿元；主锚是盈利来源分拆，不冒充完整分部资产SOTP。\n\n'
 c3+='### 3.3 交叉验证方法与防范的误判\n\n'+crossdesc+'\n\n'
 if name=='国药股份':
  cash=[p*c*(1+g)/(ke-g)/shares for p,c,ke,g in zip(profits,[.75,.85,.9],[.11,.10,.09],[0,.02,.025])]
  c3+=f'可持续股东回报交叉验证：利润×现金化率×(1+g)/(ke−g)/股数；现金化75%/85%/90%，ke11%/10%/9%，g0%/2%/2.5%，结果{cash[0]:.2f}/{cash[1]:.2f}/{cash[2]:.2f}元。防范权益法账面利润及回款未转为归母现金；此处不是完整DCF或已实现FCFE。现金保守值低于区间，限制入场确信度。已实施年股息0.8元按3%—4%要求收益率给20—26.67元，仅检验分配政策，不保证未来分红。\n\n'
 if name=='徐工机械':c3+=f'额外尾部：60亿元×10倍/股数＝{600/shares:.2f}元，低于{low:.2f}元下限。静态股息率TTM{db["dv_ttm"]:.2f}%只是历史分配，不能支持乐观盈利。\n\n'
 if name=='华润江中':c3+='PB/ROE只作一致性检查：PE价格隐含的PB需正常化资本回报支持，与利润输入代数相关，不能当独立估值背书。65%现金化压力值明显低于合理PE区间；这意味着利润持续性、增长及分配兑现仍有要求。\n\n'
 peers={'中国中车':['601006.SH','688187.SH'],'徐工机械':['600031.SH','000157.SZ'],'华润江中':['000999.SZ','600422.SH','600085.SH'],'国药股份':['601607.SH','000028.SZ']}[name]
 pr=[]
 for peer in peers:
  p=load(RAW/'共同市场'/('daily_basic-'+peer+'-20260909.json'))['rows'][0];pr.append([peer,num(p['close']),num(p.get('pe_ttm')),num(p.get('pb'))])
 c3+='9月9日A股同行行情对照，业务与权益结构并不相同；不是合理倍数抽样均值。缺少同行同口径分部费用与资本投入，不能断言费用领先。\n\n'+table(['证券','收盘价','PE TTM','PB'],pr)
 c3+='缺少完整逐年资本投入、营运资金和归母FCFE路径，因此不强凑DCF；所有交叉方法保留共享输入与数据缺口。\n\n### 3.4 敏感性、反向估值与稀释\n\n'
 if name=='中国中车':c3+=table(['资产认可比例 / PB','1.0','1.1','1.2'],[[r]+[num(eq*r*p/shares) for p in [1,1.1,1.2]] for r in [.8,.9,1]])
 elif name!='国药股份':c3+=table(['正常化利润 / PE']+[str(p) for p in pes],[[num(p)]+[num(p*pe/shares) for pe in pes] for p in profits])
 else:c3+=table(['核心利润 / 核心PE（权益法价值固定66亿元）','9','11','12'],[[p]+[num((p*pe+66)/shares) for pe in [9,11,12]] for p in [13,14.5,16]])
 c3+=reverseword+f' 现价总市值{price*shares:.2f}亿元。纯股数增加10%、股东总价值不变，中枢{base/1.1:.2f}元；这是独立压力，不是已知发行，真实融资须联动现金用途、利润、费用与分母。\n\n'
 if name=='国药股份':c3+=f'以基准现金17亿元、ke10%反推g=(市值×10%−17)/(市值+17)＝{(price*shares*.1-17)/(price*shares+17)*100:.2f}%；若现金13.35亿元、ke11%，隐含g为{(price*shares*.11-13.35)/(price*shares+13.35)*100:.2f}%。因此现价仍依赖现金化恢复。\n\n'
 # 财务及附注复用同一法定报告，历史表重新从本次API计算。
 c2=s[s.index('## 2.'):s.index('## 3.')]
 c2=re.sub(r'### 2\.[34] (?:历史财务[^\n]*|三至五年财务[^\n]*)\n.*?(?=### 2\.)',lambda m:m.group(0).split('\n')[0]+'\n\n'+table(['期间','收入','归母','扣非归母','CFO','购建现金','FCF代理'],[[x[0]]+[num(y) for y in x[1:]] for x in hist])+'本次重取Tushare并按报告期、合并口径及最新公告去重；不叠加重复记录。FCF代理=CFO−购建现金，不等于完整归母FCFE，未自动采用接口free_cashflow。\n\n',c2,flags=re.S)
 c2=re.sub(r'7月CPI同比.*?(?=\n\n|$)',macro+' '+macroref+'。',c2,flags=re.S)
 c2=c2.replace('上游以9月8日为截止，无需重做整份产业研究；','上游以9月8日为截止，本次9月9日再次核验公告目录；').replace('上述来自当日产研','上述来自9月8日产研').replace('主模型','合理PE估值')
 c2+='### 2.7 本次证据复核与口径补充\n\n'+events[name]+'\n\n'+macro+' '+macroref+'。\n\n'
 upstream={'中国中车':'2026-08-19-1421-中国中车-三要素分析','徐工机械':'2026-08-20-1028-徐工机械-三要素分析','华润江中':'2026-08-19-1510-华润江中-三要素分析','国药股份':'2026-09-08-1425-国药股份-产业思维分析'}[name]
 c2+='本次读取上游：[[workbench/targets/'+upstream+'|'+name+'产业基线]]；其旧行情和未来披露节点由本次事实覆盖，产业优势不自动转换为估值溢价。\n\n'
 c2+='上游核验范围：'+industry[name]+' 本次读取现有同股产业/三要素报告并用最新财报及公告补核；前三家缺独立新版产业筛选报告，当前以最低产业前提降级，不声称完成新一轮完整产业筛选，估值置信度中等。国药采用9月8日产业思维报告。\n\n'
 c2+='通胀分部传导：制造业务需分开金属/能源采购、订单调价与交付回款；药品业务需分开药材/采购价、终端售价、渠道库存和应收，不能将总PPI直接套为公司成本增幅。若成本上行无法转嫁，先影响毛利和营运现金，再影响正常化利润；若伴随信用收紧，再通过股权成本约束倍数，避免重复扣减。四家均保留采购价、售价和分部现金缺口，不仅凭宏观公布值改变数值假设。\n\n'
 transmission={
 '中国中车':[['铁路装备/维保','铁路更新支撑，项目预算限制数量','钢铝铜、能源与人工','订单议价和维保提供缓冲，调价时滞未知','交付及应收占用；检验铁路毛利和回款'],['城轨/新产业/海外','城轨项目及海外融资影响需求','材料、本地化与物流','业务和地区分散；项目价格竞争反证','收入未必转为现金，核验分部利润率及应收']],
 '徐工机械':[['国内整机','设备更新对冲地产相关需求弱势','钢材零件及能源','内销毛利下滑是转嫁受限反证','应收与库存占用，核验内销毛利和回款'],['海外/矿机/新能源','资源客户资本开支可能受益','物流、关税、电池电驱、本地化','海外毛利改善提供缓冲，汇率压归母','分部净利和资本投入未完整拆出，检验全年现金化']],
 '华润江中':[['OTC品牌及院外渠道','终端动销及实际购买力','药材、包装、人工和推广','品牌缓冲；H1收入下降是需求反证','缺单品价格和渠道库存，检验销量、销售费率及回款'],['新产品/产能','新需求尚需验证','研发及投产支出','缺独立提价和重复订单','未另赋价值，新增预算或低利用率触发复核']],
 '国药股份':[['药品流通','医院需求稳定但采购支付约束','药品采购与物流','低价差、账期长，转嫁能力有限','PPI上涨并非药品提价；检验购销差、应收天数'],['参股制造/工业及其他','产品需求与支付政策','原料、能源与研发','产品结构可能缓冲，未量化单品定价','权益法利润不等于现金；检验参股分红与国瑞亏损']]}
 c2+='通胀适用性：**中等暴露**；公司层通胀类型为**证据不足**（价格数据较新，但需求、成本与利润传导的同窗量价不齐）。\n\n'+table(['分部','需求影响','成本影响','定价时滞与反证/缓冲','利润现金与下一验证点'],transmission[name])
 c2+='情景映射：保守端要求按成本转嫁受阻、回款放慢审视利润或资产认可；基准须成本和订单/动销相对稳定且回款恢复；乐观须需求、利润率及现金共同改善。尚无可靠量价弹性，不杜撰通胀贡献金额或重复上调折现率。\n\n'
 c2=c2.replace('9月7日价格仍含息','9月9日价格仍含息').replace('低至中等暴露','中等暴露')
 c2+=f'复核快照：[[{(RAW/name/"income.json").relative_to(ROOT).as_posix()}|利润表]]、[[{(RAW/name/"balancesheet.json").relative_to(ROOT).as_posix()}|资产负债表]]、[[{(RAW/name/"cashflow-followup.json").relative_to(ROOT).as_posix()}|完整H1现金流与期初期末现金]]。现金等价物字段为c_cash_equ_end_period；六项附注沿用同一H1法定报告，对账未发现新差异；融资租赁与特殊付款须以正文附注明细为准，接口空字段不当零。\n\n'
 # 三表名称取技能唯一清单；逐项覆盖本次公司和市场证据。
 ref=(ROOT/'.agents/skills/bbxm-equity-research/references/valuation-bubble-trigger-scan.md').read_text(encoding='utf-8')
 scan=[]
 for line in ref.splitlines():
  cells=[x.strip() for x in line.strip('|').split('|')]
  if line.startswith('| ') and len(cells)==5 and cells[0] in ['现金流断点','盈利不匹配','宏观：货币条件收缩','中观：政策与主线资金迁移','微观：杠杆和承接逆转','叙事耗尽','财报与真实经营接管定价']:scan.append([cells[0],cells[1],'证据不足','',''])
 assert len(scan)==32
 def setrow(item,status,evidence,gap):
  a=next(x for x in scan if x[1]==item);a[2:]=[status,evidence,gap]
 bad='当期恶化，持续性待确认';good='有利';lack='证据不足';signal='不利信号出现'
 setrow('资本开支规模',bad if name=='徐工机械' else lack if name in ['中国中车','国药股份'] else good,f'H1购建现金{h[5]:.2f}亿元，同期{prev[5]:.2f}亿元，CFO{h[4]:.2f}亿元。','支出减少不写扩张恶化；投入与项目预算及造血的匹配尚需H2。徐工现金支出扩大且超过当期造血已确认，持续性待核。' if name=='徐工机械' else '不能仅由金额增减断言长期超支或资金中断；仍需项目承诺及年度回款。')
 setrow('经营现金流',good if h[4]>prev[4] else bad,f'H1 CFO{h[4]:.2f}亿元，同期{prev[4]:.2f}亿元。','同口径同比；季节性及全年回款待Q3、年报验证。')
 setrow('自由现金流',good if h[6]>prev[6] else bad,f'H1 FCF代理{h[6]:.2f}亿元，同期{prev[6]:.2f}亿元。','未包括全部股东现金权利；不把当期缺口自动认定持续断点。')
 setrow('投资资金来源',good if h[6]>0 else lack,f'H1经营现金{h[4]:.2f}亿元，购建{h[5]:.2f}亿元；融资结构及严格现金见2.5。','期初现金、营运收支及新增融资用途未逐项目穿透；借款余额不等于投资全部依赖外融。')
 cf=load(RAW/name/'cashflow-followup.json')['rows'][0]
 setrow('融资停止后的可持续性',lack,f'H1现金等价物{cf["c_cash_equ_end_period"]/1e8:.2f}亿元；融资及净现金对账见2.5。','缺授信到期表、项目现金预算、受限及必需现金穿透，不能算融资中断后生存期。')
 setrow('原材料与中间品成本',lack,'8月PPI同比+3.8%、7月+3.5%；公司H1合并成本已取得。','宏观价格不能替代单品采购价、库存结转及毛利归因。')
 inc=pick(name,'income','20260630');inc0=pick(name,'income','20250630');gm=1-inc['oper_cost']/inc['revenue'];gm0=1-inc0['oper_cost']/inc0['revenue']
 setrow('定价权与成本转嫁',signal if name=='国药股份' else bad if gm<gm0 else lack,f'H1毛利率{gm*100:.2f}%，同比{gm0*100:.2f}%。'+('2023/2024/2025毛利率8.03%/7.11%/6.59%，连续承压。' if name=='国药股份' else ''),'单品售价、数量、汇率及结构影响未分离；合并毛利不独立证明提价能力。')
 revstatus=signal if revchange>0 and profchange<0 else bad if profchange<0 else good
 revtext=f'H1收入{h[1]:.2f}亿元（同比{pct(revchange)}），扣非{h[3]:.2f}亿元（同比{pct(profchange)}）。'
 setrow('营收向利润的转化',revstatus,revtext,'增收不增利直接记录；收入利润同降则记录当期恶化。正常化恢复需后续兑现。')
 setrow('利润向自由现金流的转化',good if h[6]>prev[6] else bad,f'H1扣非{h[3]:.2f}亿元，FCF代理{h[6]:.2f}亿元，同比{prev[6]:.2f}亿元。','营运占用和资本付款时点可能影响；Q3及年度验证持续性。')
 setrow('通胀',bad,macro,'当月回升不等于持续恶化迫使加息，下一月与政策反应待验证。')
 sh=rows('共同市场','shibor');sh.sort(key=lambda x:x['date'],reverse=True)
 setrow('政策利率与债券收益率',lack,f'Shibor最新{sh[0]["date"]}隔夜{sh[0]["on"]}%，窗口首日{sh[-1]["date"]}为{sh[-1]["on"]}%；8月LPR较7月持平。','长端国债接口权限不足；短端不能替代股权折现率或长债趋势。')
 setrow('信用与融资条件',lack,'融资存量与现金按2026H1及2025年末对账，见六项核验。','未取得当前公司信用利差、授信使用及再融资条款；不以银行间利率替代。')
 setrow('高投资项目对低成本资金的依赖',good if name=='国药股份' else lack,f'H1购建{h[5]:.2f}亿元；融资结构见2.5。','国药建设投入较低，主要压力在营运资金。' if name=='国药股份' else '缺项目IRR与全期限融资成本，不能确认是否依赖持续低息。')
 setrow('监管与产业政策',lack,events[name],'公告事件不等于完整产业政策冲击；缺新增政策对公司利润定量归因。')
 for item,gap in [('ETF申赎','缺行业ETF份额申赎全样本，成交额不是净申购。'),('基金仓位','缺同窗基金全景配置，股东户数不能替代。'),('主线增量资金','缺行业资金总量与跨主线迁移。'),('新增融资集中度','缺全市场融资新增额的行业分布。')]:setrow(item,lack,'已取得公司成交、融资与股东数据；'+('户数见4.3。' if item=='基金仓位' else '截止日见4.3。'),gap)
 setrow('融资余额增速',lack,f'9月8日融资余额{rz["rzye"]/1e8:.2f}亿元；独立20交易日变化{pct(windows[-1]["rz_change"])}。','9月9日接口未返回；融资增长须与估值及成交匹配，不能仅凭增长判拥挤。')
 setrow('股价对杠杆资金的依赖',lack,flowtext,'价格截止9日、融资截止8日；未取得边际买方身份和融资退出事件，不能建立因果。')
 setrow('龙头表现',lack,'9月9日同业PE/PB及价格见3.3。','缺同行利好事件反应和盈利修订同窗对照，单点价格不能验证龙头失效。')
 broad=[]
 for dt in ['20260902','20260909']:
  rr=load(RAW/'共同市场'/('daily--'+dt+'.json'))['rows'];up=sum(x['pct_chg']>0 for x in rr);down=sum(x['pct_chg']<0 for x in rr);broad.append((dt,up,down,up/len(rr)))
 setrow('市场广度',bad if broad[1][3]<broad[0][3] else lack,'；'.join(f'{d}上涨{u}、下跌{v}，上涨占比{p:.2%}' for d,u,v,p in broad),'两日同源A股截面对比，非连续五日均值；缺指数背离与持续收缩确认，不沿用旧窗口。')
 setrow('获利资金与回调承接',lack,flowtext,'分档订单流不是机构身份；尚缺每次反弹卖压和买方结构，不能认定踩踏。')
 setrow('价格隐含的增长年限',lack,reverseword,'成熟业务使用利润/资产反推，不编造DCF增长年限；未来利润持续性仍待兑现。')
 setrow('产业进度与远期预期的距离',good,industry[name],'已商业化基本盘与待验证新业务分开，后者未另给期权。')
 setrow('新信息对盈利预测的推动',lack,events[name],'未获得可独立量化且尚未计入的额外盈利，不凭公告标题上修。')
 setrow('同类利好的边际反应',lack,'已取得公告日期及截至9月9日价格。','未完成同类事件剔除市场因素后的反应比较。')
 setrow('财报披露节点',bad if h[4]<prev[4] or profchange<0 else good,'H1公告'+inc['ann_date']+'；'+revtext+f'CFO{h[4]:.2f}亿元。','已披露经营缺口明确；市场是否从情绪转向业绩定价，尚缺直接确认。')
 setrow('订单、收入与利润的一致性',revstatus,revtext,'缺分部订单利润率与交付回款全链条；已确认收入利润背离不能被订单规模抵消。')
 setrow('利润与现金流的一致性',good if h[4]>prev[4] else bad,f'H1归母{h[2]:.2f}亿元，CFO{h[4]:.2f}亿元；同期归母{prev[2]:.2f}、CFO{prev[4]:.2f}亿元。','当期方向已确认，全年现金化与季节性待复核。')
 setrow('真实应用与产品验证',good,industry[name],'仅适用于成熟产品与现有服务，不外推新业务必然成功。')
 setrow('实际业绩与价格隐含预期',lack,f'滚动归母{ttm:.2f}、扣非{ttmd:.2f}亿元；'+reverseword,'期间与正常化路径不同，现金约束尚未解除；不把半年翻倍证明达标。')
 assert all(x[3] and x[4] for x in scan)
 scanmd='### 4.5 估值泡沫32项触发扫描\n\n逐项读取最新框架与参考表执行。证据均为有截止日的事实；五类互斥，数量不作打分。\n\n'
 counts=[]
 for label,part in [('基本面',scan[:9]),('流动性',scan[9:23]),('预期',scan[23:])]:
  scanmd+='**'+label+str(len(part))+'项**\n\n'+table(['触发类型','观察项','状态','证据及时间','传导与缺口'],part);c=Counter(x[2] for x in part);counts.append([label,len(part)]+[c[k] for k in STATES])
 scanmd+=table(['类别','总数','有利','当期恶化','不利信号出现','证据不足','不适用'],counts)
 scanmd+='合计32项。主估值锚约束：'+risks[name]+' 经营或通胀早期信号已出现，但未证实利润下修—杠杆退出—承接消失的完整跨表链条。当前**出清观察**，不能说已经泡沫出清，也不按不利项数量交易。\n\n'
 c4='## 4. 估值结果与交易溢价\n\n### 4.1 价格位置与安全边际\n\n'+table(['指标','结果'],[['公允价值下限/中枢/上限',' / '.join(num(x) for x in values)+'元'],['9月9日收盘',num(price)+'元'],['相对中枢溢价率',pct(price/base-1)],['相对上限偏离率',pct(price/high-1)],['中枢潜在回报',pct(base/price-1)],['保守安全边际：1−P/L',pct(1-price/low)],['相对中枢金额',num(price-base)+'元'],['上沿外偏离金额',num(max(0,price-high))+'元']])
 c4+='### 4.2 三层价格分解\n\n'+f'市场价格=公允价值+可解释估值溢价+交易定价偏离。质量与成熟业务增长已经体现在利润、认可比例或倍数，本次额外计入溢价为0；没有独立新增溢价证据。条件记账桥：**{price:.2f}={base:.2f}+0+({price-base:+.2f})元**。随价值情景变化，残差为{price-high:+.2f}—{price-low:+.2f}元；这是模型差额，不是精确可观察的情绪价值，不倒推无证据溢价。\n\n### 4.3 资金、筹码与交易方画像\n\n'+flowtext+'\n\n'
 c4+=table(['交易日窗口','价格起止','复权收益','大额净额代理（亿元）','融资独立起止','融资变化'],[[x['window'],x['start']+'—'+x['end'],pct(x['return']),num(x['large_flow']),x['rz_start']+'—'+x['rz_end'],pct(x['rz_change'])] for x in windows])
 c4+='户数连续观察：'+holdertext+'。最新较前次'+trend+'；户数变化不是机构增减持证明。行情采用收盘×复权因子计算窗口收益，窗口资金只累计起点后至终点；融资使用截至8日自身窗口，不伪造9日余额。\n\n'
 c4+='窗口判断：'+{'中国中车':'20日价格与大额净额偏强，但5日回落且融资减少，短长窗口分化；不确认一致增量承接。','徐工机械':'价格三窗上涨，大额资金5日和20日为负、10日为正，存在量价资金分歧；回购不能替代市场承接。','华润江中':'价格三窗下跌，短窗大额资金为负、融资略增；短期承接偏弱，尚非已确认去杠杆。','国药股份':'5日修复、10/20日价格偏弱，短窗大额资金正但20日为负，融资增加；修复尚未形成多窗一致确认。'}[name]+'\n\n'
 c4+='股东/回购事件：'+events[name]+' 大宗、回购、增减持接口保存于本次原始目录；空返回仅表示本次查询未返回记录，不证明全市场没有交易。分档大额资金不能标为机构净流入，融资只能识别杠杆余额；ETF、基金全景、龙虎榜及实际交易者身份仍未完整获取。\n\n'
 c4+='### 4.4 估值状态与偏离持续性\n\n**公允价值内，出清观察，置信度中等。** 当前价格位于条件区间，反向要求尚未显示必须依赖极端远期假设；现金压力与交叉验证分歧限制安全边际。资金窗口方向不等于企业价值变化，也不足以确认残差将持续。基本盘经营、反向估值、尾部与交易证据共同判断，不仅按价格百分比分级。\n\n'+scanmd
 c5='## 5. 仓位测算与网格交易\n\n### 5.1 凯利情景与概率敏感性\n\n'+f'输入：L={low:.6f}、P={price:.2f}、H={high:.6f}元；估值及价格日期均2026-09-09。上涨幅度u={kelly[0]["gain"]:.4%}，下跌幅度d={kelly[0]["loss"]:.4%}，盈亏平衡概率p₀={kelly[0]["breakEvenProbability"]:.4%}。\n\n'
 c5+='f*=p/d−(1−p)/u；全凯利=min(1,max(0,f*))，半凯利=全凯利/2。p为同一期末终值等于H的概率，不是盘中先触及上沿的概率。p₀是两终值假设下期望收益为零的门槛，**不是真实上涨概率，也不是保证不亏的概率**。\n\n'+table(['假设期末上行情景概率','理论凯利','仅做多不加杠杆全凯利','半凯利'],[[f'{x["probability"]:.0%}',f'{x["raw"]:.2%}',f'{x["full"]:.2%}',f'{x["half"]:.2%}'] for x in kelly])
 c5+='真实概率、投资期限及完整终值分布未获取；50%—90%仅敏感性。假设静态重新定价、现金收益/税费/分红暂为0，不能当年度总回报。下限并非最大亏损；区间以下尾部、组合相关性与流动性会使计算过于乐观。出现100%只表示公式截断，不能据此满仓，更不是网格胜率或资金预算。\n\n### 5.2 网格适用性与参数\n\n当前仅保留条件方案：有基本盘和双向波动不等于适合网格。估值区间不能直接作为交易区间；用户未提供预算、持仓、成本与允许回撤，不能计算可执行订单。\n\n'
 c5+=table(['参数','本次结果'],[['交易上下边界及依据','待确认；须以交易周期、复权波动和承接验证，不能套估值上下限'],['等差/等比、格数/间距','待确认'],['每格金额或股数','待确认'],['最大仓位、备用现金','待确认；不采用凯利截断值自动设预算'],['交易费用与税费','待核验账户费率和当日适用规则'],['最小交易单位、涨跌幅与交易限制','参数充分准备执行时按沪/深对应市场和证券状态核验'],['回测','未做，不宣称网格提升收益']])
 c5+='### 5.3 执行约束与停止条件\n\n向下突破交易下边界时暂停加仓并复核估值，不无限补仓；单边上涨、库存耗尽时停止卖出，不借券追补。现金不足或达到最大仓位时停止买入。发生财报、回款、融资或资产处置使估值失效时，先重估再决定是否重建网格。除权除息须统一成本、参考价及订单口径。所有订单须在参数齐备后另行计算；本次未下单。\n\n'
 sources='\n'.join(x for x in s.splitlines() if x.startswith('- S'))
 links=sorted(set(re.findall(r'\[\[(sources/[^]|]+)(?:\|([^]]+))?\]\]',s)))
 sourcemd='\n'.join('- [['+p+'|'+(t or Path(p).name)+']]。' for p,t in links if 'valuation-model' not in p and '估值计算快照' not in p and 'previous-report' not in p)
 c6='## 6. 风险与结论\n\n### 6.1 失效条件与重估节点\n\n'+risks[name]+'\n\n'+events[name]+'\n\n### 6.2 新增资金与已有持仓\n\n'+f'本次{low:.2f}—{high:.2f}元、中枢{base:.2f}元；公允价值内。新增资金 **{action}**：当前高于保守价值，现金及交叉验证仍有约束；已有持仓 **review**：核验成本、集中度、现金需求及尾部承受力，未提供持仓时不能计算卖出数量。基本面方向见六项，未来持续性另行跟踪。\n\n### 6.3 来源、证据缺口与复算记录\n\n'
 c6+=f'- 技能4.5.0及估值判断框架、四项references，读取2026-09-09；六项基本面、32项扫描、五档凯利、网格边界已逐项落位。\n- [[{(RAW/name/"model.json").relative_to(ROOT).as_posix()}|本次全精度计算、选取数据与32项状态]]；[[workbench/targets/2026-09-09-四股估值复算.py|复算脚本]]；[[{(RAW/"retrieval.json").relative_to(ROOT).as_posix()}|原始采集清单及错误]]。\n- [[{(RAW/name/"previous-report.md").relative_to(ROOT).as_posix()}|本次更新前报告副本]]；旧结论只作为假设沿革，当前价格和计算以本次为准。\n- [[{(RAW/"共同市场"/(name+"公告目录.txt")).relative_to(ROOT).as_posix()}|本次公告目录核验]]；{macroref}。\n'
 c6+='- 缺口：长债接口权限不足；9月9日融资尚未返回；行业ETF、基金仓位、交易者全景、独立产业筛选（前三家）、分部现金流及真实上涨概率不完整。未知处保留待验证，不用旧数据冒充当日；网格缺预算与参数。\n\n'+sources+'\n\n'+sourcemd+'\n\n以上正常化盈利、PE、PB、现金化与概率均为条件假设，报告不构成收益保证。\n'
 ktext=f'上涨{kelly[0]["gain"]:.2%}、下跌{kelly[0]["loss"]:.2%}；盈亏平衡概率{kelly[0]["breakEvenProbability"]:.2%}<br>假设p50%—90%的全/半凯利：'+'；'.join(f'{x["probability"]:.0%}→{x["full"]:.0%}/{x["half"]:.0%}' for x in kelly)+'<br>真实概率待验证，尾部未纳入；见5.1'
 c1='## 1. 估值摘要\n\n### 1.1 每日跟踪字段\n\n'+table(['项目','结论'],[['基本面状态',fundamental],['公允价值范围',f'{low:.2f}—{high:.2f}元；中枢{base:.2f}元；估值基准2026-09-09'],['凯利测算',ktext],['交易定价偏离',f'现价{price:.2f}元；相对中枢{pct(price/base-1)}、相对上限{pct(price/high-1)}；{price:.2f}={base:.2f}+0+({price-base:+.2f})；公允价值内，置信度中等'],['资金与筹码',flowtext+'<br>户数最新较前次'+trend+'；交易方完整身份待验证'],['每日跟踪时间',STAMP+'（Asia/Shanghai；9月9日收盘后，融资9月8日，财报2026H1）']])
 c1+='### 1.2 本次结论\n\n'+f'**{method}：{low:.2f}/{base:.2f}/{high:.2f}元（保守/基准/乐观）。** '+crossdesc+f' 新增资金{action}，已有持仓review；第三章直接展示计算结果，第五章独立列仓位与网格。\n\n'
 created=re.search(r'^created: (.+)$',s,re.M).group(1)
 header=f'---\nartifact_type: equity_research\nsecurity_code: "{code}"\ncreated: {created}\nupdated: 2026-09-09\nas_of: "{STAMP} Asia/Shanghai"\nvaluation_model_version: "4.5.0"\nframework_refs:\n  - "wiki/concepts/冰冰小美-framework-估值判断.md；读取2026-09-09"\n  - "bbxm-equity-research@4.5.0及四项references"\n---\n\n# {name}机构级决策研报\n\n> 更新{STAMP}；人民币/股，其他金额亿元。行情截至2026-09-09收盘，融资截至2026-09-08；财务2026H1，流量比较2025H1、余额比较2025年末。框架：[[wiki/concepts/冰冰小美-framework-估值判断|估值判断]]。\n\n'
 report=header+c1+c2+c3+c4+c5+c6
 assert '\ufffd' not in report
 write(new,report)
 model={'name':name,'code':code,'skill':'4.5.0','as_of':STAMP,'price_date':'20260909','financing_date':'20260908','price':price,'shares_100m':shares,'equity_100m':eq,'method':method,'profits_100m':profits,'pe':pes,'values':values,'cross_values':cross,'reverse':reverse,'history':hist,'financial_selection':{a:pick(name,a,'20260630') for a in ['income','balancesheet','cashflow','fina_indicator']},'windows':windows,'kelly':kelly,'scan':scan,'counts':counts,'assumption_review':risks[name],'action_new':action,'action_existing':'review'}
 write(RAW/name/'model.json',json.dumps(model,ensure_ascii=False,indent=2))
 manifest.append({'name':name,'old_md':old.relative_to(ROOT).as_posix(),'md':new.relative_to(ROOT).as_posix(),'old_html':oldhtml.relative_to(ROOT).as_posix(),'html':html.relative_to(ROOT).as_posix(),'price':price,'values':values})
 print(name,price,values,Counter(x[2] for x in scan),flush=True)
write(RAW/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
