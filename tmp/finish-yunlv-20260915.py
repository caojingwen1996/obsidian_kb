"""Produce the scoped, evidence-backed v1.5 monitoring update; retain morning history."""
import copy
import hashlib
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'tools/a-share-market-dashboard/data'
EVID = ROOT / 'sources/automations/持仓每日监控/2026-09-15/云铝股份-1730'
sys.path.insert(0, str(ROOT / '.agents/skills/portfolio-daily-monitoring/scripts'))
from generate_run_reports import target_report
from information_records import validate_information, information_gaps, information_summary
from render_report_html import build_html

def read(p):
    return p.read_text(encoding='utf-8-sig')

def js(p):
    return json.loads(read(p))

def save(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def rows(name):
    return js(EVID / (name + '.json'))['rows']

now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')
old = js(EVID / 'previous-monitor-run-2026-09-15.json')
item = copy.deepcopy(next(x for x in old['items'] if x['code'] == '000807'))
daily = sorted(rows('daily'), key=lambda x: x['trade_date'], reverse=True)
basic = sorted(rows('daily_basic'), key=lambda x: x['trade_date'], reverse=True)
margin = sorted(rows('margin_detail'), key=lambda x: x['trade_date'], reverse=True)
flow = sorted(rows('moneyflow'), key=lambda x: x['trade_date'], reverse=True)
d, b = daily[0], basic[0]
assert d['trade_date'] == b['trade_date'] == '20260915'
assert margin[0]['trade_date'] == '20260914'
five = (math.prod(1 + x['pct_chg']/100 for x in daily[:5])-1)*100
week = (math.prod(1 + x['pct_chg']/100 for x in daily if x['trade_date'] >= '20260914')-1)*100
avg_amount = sum(x['amount'] for x in daily[:20])/20/100000
avg_turn = sum(x['turnover_rate'] for x in basic[:20])/20
big = lambda x: (x['buy_lg_amount'] + x['buy_elg_amount'] - x['sell_lg_amount'] - x['sell_elg_amount'])/10000
big5 = sum(big(x) for x in flow[:5])
reason = '收盘后复核：铝锭去库与铝棒累库并存；公司实现价差及可比估值缺少最新同口径输入，不能可靠量化重估幅度，转人工复核；未确认基本面恶化'
missing = '持仓成本与权重未提供；申万铝指数850551.SI已映射但sw_daily无访问权限；9月15日两融未返回；公司实际铝价、氧化铝/电力单位成本及可比组持续估值未获取到'
item.update(close=d['close'], daily_pct=d['pct_chg'], week_pct=week, five_pct=five,
    raw_five_pct=five, amount=d['amount']/100000, amount_ratio=d['amount']/100000/avg_amount,
    turnover=b['turnover_rate'], turnover_ratio=b['turnover_rate']/avg_turn, pe=b['pe_ttm'], pb=b['pb'],
    trade_date='2026-09-15', data_as_of='2026-09-15', reviewed_at=now,
    revalue='MANUAL_REVIEW', judgment='信息不足', needs_review=True, review_priority='P2',
    update_report=False, triggers=[], reason=reason, missing=missing,
    quick_conclusion='需要继续阅读：价格与成交额可检查项未触发默认异常阈值，但行业相对强弱无法核验。三条事件路径已按五层归纳；风险方向均为证据不足，估值列人工复核，旧21.80—30.97元仅供参考。',
    confirmed_reason='09/15收盘27.06元、+0.148%，近5日-1.56%；价格事实已确认，未确认单一股价原因',
    unconfirmed='铝锭去库是否来自终端需求、铝棒累库能否消化、公司实现价差和现金转化、同业相对走势；09/22股东会表决及随后分红实施安排待跟踪',
    new_input='股本34.67957405亿股与基线一致；未有新的公司财务披露返回。库存信号分歧，无法换算正常化利润变化；可比组最新中位估值缺失',
    input_change='股本0%；其余无新同口径公司值，不将未披露记为零变化', input_date='2026-09-15',
    input_source='09/08权威研报、巨潮公告与本轮Tushare/SMM原始快照',
    support='可验证的日涨跌、5日涨跌、成交额、换手及估值区间边界未触发异常；8月28日公告仍是本轮索引最新披露',
    counter='铝棒累库与铝锭去库方向不一；公司实现价差、现金转化与行业相对表现缺证，不能用库存或价格单项证明风险减弱',
    impact_path='库存/供需→实现售价与成本价差→正常化利润及现金流；量价/杠杆→承接与定价；派息方案→股东现金回报与留存现金',
    duration='库存按周、交易按日；公司财务在正式披露后验证，股东会为9月22日', confidence='低（经营传导尚未证实；行情和公告事实可核验）',
    review_task='补同口径售价、氧化铝和电力成本及可比组估值；核验铝棒库存与订单/回款；9月22日复核股东会决议并另查分红登记、除息和支付日',
    next_step='先补齐输入并判断是否达到阈值；未达到则回到NO_REVALUE，达到后再按受影响方法执行重算',
    update_section='暂不改权威研报；待复核正常化利润和估值倍数后决定是否更新',
    sector_news='SMM同口径09/14铝锭77.6万吨，较09/07减少2.6；铝棒15.75万吨，较09/07增加0.70。需求与公司利润传导待验证。')

divurl = 'https://static.cninfo.com.cn/finalpage/2026-08-28/1225522158.PDF'
meeturl = 'https://static.cninfo.com.cn/finalpage/2026-08-28/1225522156.PDF'
smmurl = 'https://hq.smm.cn/h5/alu-stock'
basehref = '../../../sources/automations/持仓每日监控/2026-09-15/云铝股份-1730/'
local = lambda n, label: f'[{label}]({basehref}{n})'
stocksource = local('daily.json','Tushare行情快照') + '；' + local('moneyflow.json','成交分组快照') + '；' + local('margin_detail.json','两融快照')
item['announcements'] = [
    dict(date='08/28披露；09/15登记；09/22召开',title='2026年第一次临时股东会通知（旧公告节点跟踪）',fact='今日为股东会股权登记日，会议09/22 14:00；不是中期分红股权登记日',impact='股东会参与资格与后续表决',hypothesis='H2、H3',source=f'[巨潮正式通知]({meeturl})'),
    dict(date='08/27董事会审议；08/28披露',title='2026年中期利润分配预案（既有方案）',fact='拟每10股派8.87元含税，约30.7608亿元；尚须股东会审议，未取得分红实施日期',impact='现金回报与留存现金；不把0.887元再加到估值',hypothesis='H2、H3',source=f'[巨潮正式预案]({divurl})')]
item['information_review'] = dict(framework_path='wiki/concepts/冰冰小美-framework-金融信息归纳框架.md', framework_read_at='2026-09-15T17:30:48+08:00',checked_scope='仅000807云铝股份：09/08权威研报、09/15上午监控、08/28—09/15巨潮索引及两份公告正文、收盘量价、成交分组、两融、SMM库存；未执行全组合扫描',checked_at=now,history_source=local('previous-000807-云铝股份-每日监控-2026-09-15.md','今日上午历史报告')+'；'+local('previous-monitor-run-2026-09-15.json','历史运行'),note='首次建立结构化五层记录；回查上午文字判断而非伪造历史事件编号。原始公告发生/发布与今日复核分别记录；缺口影响结论，归纳完成不等于风险已证实。')
item['prior_information_events'] = item.get('prior_information_events', [])

def ev(eid, pid, title, update, event, impact, behavior, reaction, tracking):
    return dict(event_id=eid,path_id=pid,title=title,update=update,reviewed_at=now,event=event,impact=impact,behavior=behavior,reaction=reaction,tracking=tracking)

item['information_events'] = [ev('AL-20260914-INVENTORY','YL-P1','库存分化能否传入云铝利润与现金流','修订判断',
    dict(fact='事实：SMM铝锭库存09/07为80.2、09/10为79.6、09/14为77.6万吨；铝棒同期15.05、15.30、15.75万吨。终端需求改善是待验证推测。',occurred_at='统计日2026-09-07、09-10、09-14',published_at='网页标注2026-09-14数据，具体首次发布时间未获取',transition='铝锭周降2.6万吨，铝棒周增0.70万吨；不能统一概括为铝需求全面增强',source=f'[SMM库存原始页面]({smmurl})；'+local('smm-inventory.html','本地网页快照')),
    dict(risk_source='通胀与供给／产业供需及库存变化',variables='铝锭与铝棒库存、出入库、成交与订单、公司实现售价、氧化铝和电力单位成本',path='库存及供需变化→产品价格与销售量→售价减成本的单位价差→正常化利润→回款与经营现金流〔基本面〕',exposure='云铝铝产品销售与氧化铝/电力成本暴露；外部库存不能代替公司库存或实现售价',hypotheses='H1价差支持正常化利润；H2成本优势兑现现金流；H3应收和资本开支约束',conditions='去库需来自真实出货，售价改善不被成本抵消，回款兑现；产业周度信号到财报有时滞',evidence='行业库存已观测；公司当期价差、销量、订单和回款增量未取得'),
    dict(expected='若终端需求增强，下游采购/提货增加、铝棒库存也应逐步消化；仅为行为假设',observed='只观测到两类库存相反变化，未直接取得客户订单或提货量',evidence='SMM同一机构、同一产品分别比较；尚无云铝客户行为数据'),
    dict(direction='证据不足',level='待验证',current_window='2026-09-14库存截面',comparison_window='2026-09-07及09-10同口径库存',indicators='铝锭77.6对80.2万吨，-3.24%；铝棒15.75对15.05万吨，+4.65%。来源SMM；公司价差和CFO最新期缺失',support='铝棒累库可能提示部分下游消化偏弱，是需求路径风险线索',counter='铝锭去库是相反信号；发运、到货、供应及统计范围变化也可影响库存，未证明需求或利润方向'),
    dict(previous='2026-09-15上午报告列76.8→74.9万吨但未明确库存口径，投资逻辑无实质影响；当时没有独立的事件风险方向判断',revision_reason='本次改用可追溯的SMM同口径序列，不将上午另一未明确口径序列拼接；新增铝棒对照，经营传导仍缺证',status='跟踪中',indicator_source='SMM库存/现货；公司经营公告、财报售价成本及回款；可比公司同口径估值',confirm='若铝棒继续累库、真实出货转弱且公司价差或回款恶化，可支持基本面风险增强',invalidate='若下游出货增加、库存消化且公司价差/回款稳定，则削弱该风险路径',next_check='下次执行扫描时复查；重点2026-09-17附近下一次SMM库存更新（以实际发布日期为准），财报发布后检验公司传导',closure_reason='不适用：路径未关闭，公司传导尚待验证')),
 ev('YL-20260909-PRICE','YL-P2','上涨后回撤是否伴随杠杆和承接恶化','持续跟踪',
    dict(fact=f'事实：09/09收29.03元，09/15收27.06元，较09/09回落{(27.06/29.03-1)*100:.2f}%；09/15涨0.148%，近5个交易日{five:.2f}%。',occurred_at='2026-09-09至09-15交易日；两融最新09-14',published_at='行情截至09/15收盘；API采集09/15 17:33；两融最新数据09/14',transition='阶段上涨后回撤，今日小幅回升；没有取得足以识别卖方身份或强平的证据',source=stocksource),
    dict(risk_source='市场结构与资金／杠杆及交易承接变化',variables='成交额、价格、换手、融资余额与买入偿还、成交分组',path='若资金撤出或被动偿还→承接减弱→价格承压〔流动性〕→估值溢价压缩〔估值〕；当前为候选路径',exposure='持有云铝的投资者承担价格波动；成本和权重未知，不能计算账户损失或仓位建议',hypotheses='估值倍数及安全边际的市场暴露；价格变化本身不直接证伪经营H1—H3',conditions='需资金/融资与价格跨日同向证据，并排查行业波动及正常获利回吐；未取得行业指数行情',evidence='量价已取得；融资09/14较09/07下降但较09/11回升，未证明持续强平'),
    dict(expected='假如去杠杆主导回撤，融资余额下降、偿还压力与成交价格应互相印证；不得由回撤倒推强平',observed=f'09/15成交额11.9531亿元，为20日均值{item["amount_ratio"]:.2f}倍；大单加特大单净额{big(flow[0]):.4f}亿元，近5日{big5:.4f}亿元；09/14融资余额21.2713亿元，09/07为23.3409、09/11为20.8912亿元',evidence='Tushare daily/moneyflow/margin_detail；成交分组不代表机构身份。provider net_mf_amount为-0.2766亿元，与大单组为不同字段，不能混称全市场净流入'),
    dict(direction='证据不足',level='待验证',current_window='量价及成交分组2026-09-09—09-15；两融截止09-14',comparison_window='近5日收益以09/08为起点；成交额20日含当日均值；两融对09/07、09/11',indicators=f'近5日{five:.2f}%，当日成交额/20日{item["amount_ratio"]:.2f}倍，换手1.2772%；融资余额21.2713亿元；行业相对收益缺失',support='阶段回撤和周度融资余额下降提供资金压力线索',counter='当日缩量小涨、大单分组近5日为正、融资余额较前一日回升，不支持持续一致卖出；也可能是行业波动或获利回吐'),
    dict(previous='2026-09-15上午用09/14收盘27.02元，未触发量价阈值；无实质影响、NO_REVALUE；未作强平或投资者身份判断',revision_reason='用09/15收盘和更新的成交分组继续核验旧波动；不把新行情等同新的经营风险证据',status='跟踪中',indicator_source='Tushare daily/moneyflow/margin_detail；申万铝指数或其他经核验的同行基准',confirm='若相对行业持续落后，同时融资余额及承接继续恶化，并出现赎回/保证金等直接证据，支持流动性路径',invalidate='若行业同步变化、承接恢复、融资稳定且无被动出售证据，削弱去杠杆解释',next_check='2026-09-16收盘后的下一次扫描；优先补09/15两融和行业基准',closure_reason='不适用：缺行业基准和直接行为证据，继续跟踪')),
 ev('YL-20260828-DIVIDEND','YL-P3','中期派息方案从表决资格走向实施','持续跟踪',
    dict(fact='事实：董事会08/27审议中期方案，08/28公告拟每10股派8.87元含税、合计30.7608亿元，需股东会审议；09/15是09/22股东会股权登记日，分红登记、除息、支付日期未取得。',occurred_at='董事会2026-08-27；股东会登记2026-09-15；股东会拟2026-09-22',published_at='2026-08-28公告；今日为节点复核而非新公告',transition='已公告方案→股东会登记节点；尚不能写已通过或已支付',source=f'[利润分配预案]({divurl})；[股东会通知]({meeturl})；'+local('dividend.json','分红API快照')),
    dict(risk_source='微观企业／利润分配与资本配置事件',variables='派息金额、表决结果、支付时点、留存现金、后续资本开支和融资',path='派息若获批并实施→股东收到现金、公司留存现金减少→现金回报与再投资/偿债余量变化〔基本面〕；除息还影响名义价格比较〔估值〕',exposure='云铝股东现金回报与企业现金缓冲；登记资格必须区分会议与分红',hypotheses='H2现金回报兑现；H3资本开支、回款和派息不削弱现金缓冲',conditions='股东会通过、实施公告明确并实际支付后才能确认；账上现金至支付日仍会变化',evidence='两份正式公告及分红API支持预案状态；本轮未取得实施公告，不做净现金实时扣减'),
    dict(expected='股东按正式程序表决；若方案实施按公告日期支付，不假设持有人会抢权或抢跑',observed='已确认会议资格安排；本轮未取得投票结果或支付记录，未观测到可归因于派息的投资者行为',evidence='巨潮索引本轮08/28—09/15返回10条，最新08/28；索引可能延迟，不能视为无其他事项保证'),
    dict(direction='证据不足',level='待验证',current_window='2026-09-15节点及公告检索',comparison_window='08/28方案与09/08已纳入的估值基线',indicators='0.887元/股、34.67957405亿股、拟派30.7608亿元；div_proc=预案；record_date/ex_date/pay_date为空。来源正式公告及Tushare',support='大额现金分配会降低留存现金，需要与再投资、偿债共同看',counter='方案是已有基线信息；现金回报并非自动损害，且尚未实施，没有证据证明新增融资压力'),
    dict(previous='09/08研报已有中期方案；09/15上午等待经营和正式公告节点，尚无结构化派息跟踪记录',revision_reason='补记今日是会议登记日，避免误当分红登记日；没有将旧方案重复算作新增价值',status='跟踪中',indicator_source='09/22股东会决议、后续权益分派实施公告、下一期现金流和资本开支',confirm='若支付后现金缓冲明显收缩、回款不足且融资或资本开支压力增加，支持现金风险路径',invalidate='若回款和经营现金流覆盖派息及再投资、债务压力稳定，则削弱该路径',next_check='2026-09-22股东会后或决议发布后的下一次扫描；实施公告出现时复核登记/除息/支付日',closure_reason='不适用：表决和现金支付均尚待验证'))]
validate_information(item)
assert not information_gaps(item)
run = dict(date='2026-09-15',trade_date='2026-09-15',run_time=now,monitor_state='单标的收盘后扫描已完成；经营传导与估值输入存在缺口，待人工复核',week_note='09/14—09/15两个已完成交易日，以09/11收盘为起点',news_source_note='只检查云铝；巨潮公告索引与两份正文、SMM库存、行情和资金快照；证据失败及数据日期另列',skill_version='1.5.0',scope=['000807'],items=[item])
md = target_report(run,item)
md = md.replace('1（成本、仓位与行业指数映射未提供 / 未获取到）','1（本标的存在成本、仓位、行业行情、价差和可比估值等缺口）')
md = md.replace('行业指数涨跌幅：未获取到可审计的一致映射','行业指数涨跌幅：已映射申万铝850551.SI；sw_daily返回无访问权限，涨跌幅未获取')
md = md.replace('异常程度：无','异常程度：可检查项未触发；行业相对强弱项未完成')
md = md.replace('未触发价格和成交量异常规则','价格/成交额等可检查项未触发；行业单日相差3个百分点及连续3日跑输未能检查')
md = md.replace('动态估值区间：','历史估值参考区间：')
md = md.replace('仍然有效的旧估值区间及日期：','待复核的旧估值参考区间及日期：')
md = md.replace('建议补充数据：成本、仓位、行业指数映射；','建议补充数据：')
md = md.replace('交易所、巨潮、公司官网、公开公告索引与库内最新资料；截至','巨潮索引及公告正文、新浪公告镜像、SMM与库内最新资料；截至')
md = md.replace('> 本次监控未发现足以单独改变核心判断的新增产业变化。行业指数与产业新闻的可审计映射未完整取得，不据此强行解释股价。', f'''{item['sector_news']}

[SMM库存原页]({smmurl})及{local('smm-inventory.html','本地快照')}支持上述数据。上午报告采用的76.8→74.9万吨未明确统计范围，本次不能与之拼接；改用SMM连续同口径值，也不与“三地库存”混用。去库可能来自供需、发运和到货变化，尚未取得公司销量、实现售价及成本增量。''')
start = md.index('| 指标 | 最新值 |',md.index('#### 5.'))
end = md.index('#### 6.',start)
md = md[:start] + f'''| 监测指标 | 当前值与日期 | 比较值与日期 | 判断与适用边界 | 关联假设/路径 | 来源 |
|---|---|---|---|---|---|
| 收盘价与近5日收益 | 09/15：27.06元；{five:.2f}% | 昨收27.02元；5日基期09/08 | 单日+0.148%；5日未达10%异常线；不代表盈利改善 | P2，安全边际 | Tushare daily |
| 成交额、换手 | 09/15：11.9531亿元；1.2772% | 20日含当日：{avg_amount:.4f}亿元；{avg_turn:.4f}% | 成交额{item['amount_ratio']:.2f}倍，未放量；不推断交易者身份 | P2 | daily、daily_basic |
| 大单及特大单净额 | 09/15：{big(flow[0]):+.4f}亿元 | 09/09—15合计{big5:+.4f}亿元 | 与阶段回撤分歧；净额不等于机构净买入 | P2 | moneyflow |
| 融资余额 | 09/14：21.2713亿元 | 09/07：23.3409；09/11：20.8912亿元 | 周降但最近一期回升，不能确认持续强平；09/15缺失 | P2 | margin_detail |
| PE TTM、PB | 09/15：8.554倍、2.4591倍 | 09/14：8.5414倍、2.4555倍 | TTM利润处于周期中，低PE不自动证明便宜；非可比组估值 | P2，估值倍数 | daily_basic |
| 铝锭社会库存 | 09/14：77.6万吨 | 09/07：80.2；09/10：79.6万吨 | 周降3.24%，需核对出货及公司实现价差 | H1/H2、P1 | SMM |
| 铝棒库存 | 09/14：15.75万吨 | 09/07：15.05；09/10：15.30万吨 | 周增4.65%，是铝锭去库解释的反向证据 | H1/H2、P1 | SMM |
| 售价减氧化铝/电力成本价差 | 新同口径公司值未获取 | 09/08正常化利润假设依赖价差持续 | 不以外部铝价直接计算EPS上修或下修 | H1、P1 | 待公司经营披露 |
| CFO、资本开支、应收 | 已有2026H1：83.77、2.06、13.03亿元 | CFO/资本开支上年同期37.23/4.02；应收年初3.44亿元 | 本轮无更新期；现金流改善与应收上升同时保留，不混同比与环比 | H2/H3、P1/P3 | 09/08权威研报及H1原始资料 |
| 分红及实施日期 | 预案0.887元/股；拟30.7608亿元 | 08/28方案已披露 | 09/15仅会议登记；分红登记、除息、支付尚待实施公告 | H2/H3、P3 | 巨潮、dividend |

''' + md[end:]
start = md.index('| 估值输入 |',md.index('#### 6.'))
end = md.index('- 价格变化是否',start)
md = md[:start] + '''| 估值输入/事件 | 原基线 | 本次核验 | 变化/阈值与处置 | 受影响方法 |
|---|---|---|---|---|
| 盈利预测 / EPS | 09/08正常化归母90/105/120亿元 | 最新同口径公司价差和预测未取得 | 变化率不可算；EPS5%、利润10%阈值待人工，不将半年利润乘2 | 正常化盈利×PE |
| 毛利率 | 2026H1 31.84%，上年同期14.07% | 本轮无新增期间披露，沿用旧统计期 | 1/2个百分点阈值不能用同一份H1重复触发 | 盈利持续性 |
| 经营现金流 / 再投资 | H1 CFO83.77亿；现金资本开支2.06亿 | 沿用H1；缺后续回款、资本开支新值 | CFO偏离15%待新披露；81.71亿差额只是FCF代理，非FCFE | 现金验证 |
| 订单 / 合同 | 最近年度收入及订单以权威研报为基线 | 索引未返回新的重大合同金额 | 无待比较新合同，不凭空计算收入占比；5%/10%规则保留 | 收入可见度 |
| 净现金 / 净负债 | H1现金等价物124.6909亿、融资义务20.9943亿，严格净现金103.6966亿 | 本轮无新资产负债表；中期派息未确认实施 | 派息方案已知，不再重复加现金或直接减成今日净现金；股权价值5%阈值待新输入 | 现金安全性；PE主锚无重复加现金 |
| 总股本 | 34.67957405亿股 | 09/15 daily_basic为34.67957405亿股 | 0%，未触发3%/5%摊薄规则；方案不转增 | 每股价值 |
| 可比组估值 | 主模型PE假设8.4/8.75/8.95倍 | 未获取一致可比组最新与比较期中位数 | 无法验证持续15%变化，MANUAL_REVIEW | 估值倍数 |
| WACC关键输入 | 原主模型未用DCF，缺多年再投资输入 | 不适用当前PE主锚；不能虚构WACC变化 | 50bp重跑DCF规则仅在采用DCF时适用；利率仍可能影响PE要求 | 暂不执行DCF |
| 商业逻辑 / 核心风险 | H1价差、H2现金兑现、H3应收及资本开支约束 | 库存分歧，尚未确认公司经营或生存条件实质变化 | 不是已证实的FULL_REVALUE；先核验传导 | 正常化利润与现金验证 |
| 定期报告 / 有效期 | 2026H1已纳入09/08完整估值，模型4.4.2 | 09/15距基线7天；索引未返回新增定期报告 | 未触发90天规则；同份H1不重复触发重估 | 全模型 |
| 价格 / 安全边际 | 09/08参考21.80/26.49/30.97元 | 09/15收27.06元，区间位置57.36% | 未越界；相对中枢溢价2.15%，只是价格比较 | 安全边际 |

''' + md[end:]
md = md.replace('- 需要局部重算的方法：'+item['method'], '- 待复核的方法：'+item['method']+'；尚未执行重算')
md += f'''
## 八、本次证据与执行边界

- 本次使用 portfolio-daily-monitoring v1.5.0，单独扫描云铝股份；跟踪清单标为持有，但实际持仓成本及权重为空。
- 五层归纳已完成三条路径的事实整理与历史回查；三条风险方向均为“证据不足”、水平“待验证”。这与“MANUAL_REVIEW”分别表示风险判断和估值处置，不能互相反推。
- 重算队列已完成输入核验，结果为待输入：公司实际价差和可比组估值未齐；未计算新价值区间、未更新权威研报。人工复核是数据与判断事项，不是买卖指令。
- 原始数据：{local('daily.json','行情')}、{local('daily_basic.json','估值与股本')}、{local('moneyflow.json','成交分组')}、{local('margin_detail.json','两融')}、{local('industry_member.json','行业归属')}、{local('cninfo-index.json','巨潮公告索引')}、{local('dividend.json','分红状态')}。
- 来源失败：sw_daily明确返回无接口访问权限，无法完成相对行业异常检验；09/15两融尚未返回。requests直接下载巨潮PDF返回403，但网页阅读工具成功读取公告正文，并以{local('meeting.html','会议公告镜像')}和{local('dividend-announcement.html','分红公告镜像')}交叉核对。没有把下载失败文件冒充已归档PDF。
- {local('previous-000807-云铝股份-每日监控-2026-09-15.md','上午报告已保留')}；下一次执行技能时沿用本次事件与路径编号复核。文中下一复核日期是跟踪安排，不表示已创建定时任务。
'''
report = DATA / '000807-云铝股份-每日监控-2026-09-15.md'
report.write_text(md,encoding='utf-8')
report.with_suffix('.html').write_text(build_html(md),encoding='utf-8')
save(EVID / 'monitor-run-000807-2026-09-15-1730.json', run)
save(EVID / 'queue-result.json',dict(code='000807',status='MANUAL_REVIEW',execution='INPUT_REVIEW_COMPLETED_AWAITING_DATA',missing=missing,model_recalculated=False,authority_unchanged=True,new_value_range=None,reviewed_at=now))

# Merge only this item; other concurrent per-stock updates stay intact.
fullpath = DATA / 'monitor-run-2026-09-15.json'
full = js(fullpath)
other_before = [x for x in full['items'] if x['code']!='000807']
full['items'] = [item if x['code']=='000807' else x for x in full['items']]
full.setdefault('target_updates',{})['000807'] = dict(trade_date='2026-09-15',reviewed_at=now,run_path=str((EVID/'monitor-run-000807-2026-09-15-1730.json').relative_to(ROOT)).replace('\\','/'),note='单标的收盘后补扫；顶层原始批次时间不代表本条，其他标的维持各自时点')
save(fullpath,full)
assert [x for x in js(fullpath)['items'] if x['code']!='000807'] == other_before

# Update the existing daily navigation surgically, preserving the other 15 stocks.
summarypath = DATA / '持仓今日监控汇总-2026-09-15.md'
summary = read(summarypath)
notice = f'> 云铝股份收盘后补扫：{now}，行情截至09/15收盘；本轮只更新云铝，其他15只保持各自报告时点。云铝按v1.5五层归纳完成，MANUAL_REVIEW仅表示输入待复核。\n\n'
if '> 云铝股份收盘后补扫：' not in summary:
    summary = summary.replace('## 一、监控概览\n\n','## 一、监控概览\n\n'+notice)
summary = summary.replace('- 待人工复盘数量：5','- 待人工复盘数量：6').replace('- NO_REVALUE数量：15','- NO_REVALUE数量：14').replace('- MANUAL_REVIEW数量：1','- MANUAL_REVIEW数量：2')
summary = summary.replace('1 个进入人工判断；其中 15 个为 NO_REVALUE','2 个进入人工判断；其中 14 个为 NO_REVALUE')
summary = summary.replace('其余15项为NO_REVALUE','云铝收盘后新增人工复核1项（价差与可比估值缺口）；其余14项为NO_REVALUE')
summary = summary.replace('队列1项已执行输入核验：','原批次队列1项已执行输入核验：')
summary = summary.replace('| 云铝股份 | 000807 | 持有 | NO_REVALUE | 未确认新估值输入达到阈值，沿用已核验的权威研报基线 | 无实质影响 |',f'| 云铝股份 | 000807 | 持有 | MANUAL_REVIEW | {reason} | 信息不足 |')
summary = summary.replace('| 云铝股份 | 成本、仓位、行业指数映射 | 未提供 / 未获取到 | portfolio.json、库内资料、Tushare | 不影响价格异常判断；影响持仓盈亏与行业相对表现 |',f'| 云铝股份 | 成本/权重、行业行情、公司价差与可比估值 | 部分缺失；行业已映射但接口无权限 | 本轮Tushare、SMM、巨潮与基线 | {missing} |')
focus = f'| 云铝股份 | {reason} | 信息不足 | MANUAL_REVIEW | 是 | 是 |\n'
summary = summary.replace('### 快速阅读结论',focus+'\n### 快速阅读结论',1)
reviewrow=f'| P2 | 云铝股份 | 公司实现价差与可比估值缺口，库存信号分歧 | H1—H3 | {item["review_task"]} | [打开报告](000807-云铝股份-每日监控-2026-09-15.html) |\n'
summary = summary.replace('## 五、估值重算队列',reviewrow+'\n## 五、估值重算队列',1)
queuerow=f'| P2 | 云铝股份 | MANUAL_REVIEW | 库存分化尚未量化公司利润影响，最新可比估值缺失 | 正常化利润×PE | 2026-09-08 | 公司实现价差、订单/回款和可比组估值 | 已完成输入核验，待数据；未重算或更新权威研报 |\n'
summary = summary.replace('## 六、研报更新建议',queuerow+'\n## 六、研报更新建议',1)
summary = summary.replace('> 来源口径：行情与 PE/PB 来自本地 Tushare 数据工具，日期为 2026-09-14；','> 原批次来源口径（云铝现已更新至09/15，其余按各报告时点）：行情与 PE/PB 来自本地 Tushare 数据工具，日期为 2026-09-14；')
summary = summary.replace('> 验证结果：16份','> 原批次验证记录（非本次重跑结果）：16份')
summary += '\n## 八、云铝股份五层归纳补扫\n\n'+information_summary([item],'2026-09-15')+'\n本轮三条路径已结构化保存，其余15只没有在本次重新执行五层归纳。\n'
summarypath.write_text(summary,encoding='utf-8')
summarypath.with_suffix('.html').write_text(build_html(summary),encoding='utf-8')
baseline = js(EVID/'baseline-hash.json')
assert hashlib.sha256(Path(baseline['path']).read_bytes()).hexdigest() == baseline['sha256']
for p in [report,summarypath]:
    assert p.with_suffix('.html').read_text(encoding='utf-8') == build_html(read(p))
    assert '\ufffd' not in read(p)
assert len(re.findall(r'^#### [1-8]\. ',md,re.M)) == 8
assert len(full['items']) == 16
save(EVID/'validation.json',dict(authority_unchanged=True,other_15_run_items_unchanged=True,records_valid=True,event_count=3,report_eight_sections=True,md_html_same_source=True,checked_at=now))
print(json.dumps(dict(report=str(report),html=str(report.with_suffix('.html')),events=3,status=item['revalue'],judgment=item['judgment'],close=item['close'],five_pct=five,cutoff=now),ensure_ascii=False))
