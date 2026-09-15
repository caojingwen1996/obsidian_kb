"""Render the full report with the skill stylesheet and validate its contract."""
import hashlib, json, re
from pathlib import Path
from urllib.parse import unquote, urlparse
import markdown
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'sources/automations/支柱产业/高端制造'
MD=P/'2026-09-15-1806-徐工机械资金面分析.md'
HTML=MD.with_suffix('.html')
OLD=P/'2026-09-15-徐工机械资金面分析.html'
old_hash=hashlib.sha256(OLD.read_bytes()).hexdigest()
text=MD.read_text(encoding='utf-8')
template=(ROOT/'.agents/skills/fund-flow-analysis/template.md').read_text(encoding='utf-8')
expected=re.findall(r'^## .+$',template,re.M)
assert re.findall(r'^## .+$',text,re.M)==expected
expected_sub=re.findall(r'^### .+$',template,re.M)
assert re.findall(r'^### .+$',text,re.M)==expected_sub
assert not re.search('[\ufffd\ue000-\uf8ff]',text)
fragment=BeautifulSoup(markdown.markdown(text,extensions=['tables','sane_lists']), 'html.parser')
doc=BeautifulSoup('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>徐工机械资金面分析 · 量能确认新版</title></head><body><main class="report-shell"></main></body></html>','html.parser')
style=doc.new_tag('style')
style.string=(ROOT/'.agents/skills/fund-flow-analysis/assets/report-style.css').read_text(encoding='utf-8')+'\n.report-section,.report-header{min-width:0}.table-wrap{max-width:100%}blockquote{margin:12px 0}td{overflow-wrap:anywhere}.volume-table td:nth-child(2){text-align:right;font-variant-numeric:tabular-nums;font-weight:650;white-space:normal}.volume-table th:nth-child(2){text-align:right}.volume-table{table-layout:fixed}.volume-table th:first-child{width:27%}.volume-table th:nth-child(2){width:29%}.volume-table th:nth-child(3){width:44%}.source-note{overflow-wrap:anywhere}@media print{body{background:white}.report-shell{max-width:none;padding:0}.report-section{box-shadow:none;break-inside:auto}.table-wrap{overflow:visible}table{min-width:0!important;font-size:10px}h2,h3{break-after:avoid}}'
doc.head.append(style)
header=doc.new_tag('header',attrs={'class':'report-header'});doc.main.append(header); current=header
for node in list(fragment.contents):
    if getattr(node,'name',None)=='h2':
        current=doc.new_tag('section',attrs={'class':'report-section'});doc.main.append(current)
    current.append(node.extract())
grid=BeautifulSoup('<div class="decision-grid"><div class="decision-card"><small>资金状态</small><span class="tag tag-danger">结构性流出</span></div><div class="decision-card"><small>新增资金</small><strong>observe · 0%</strong></div><div class="decision-card"><small>已有持仓</small><strong>review · 先复核原计划</strong></div></div>','html.parser')
header.append(grid)
for table in doc.find_all('table'):
    wrap=doc.new_tag('div',attrs={'class':'table-wrap','tabindex':'0','role':'region','aria-label':'可横向滚动的数据表'});table.wrap(wrap)
    heading=table.find_previous(['h2','h3'])
    label=heading.get_text() if heading else ''
    if label=='成交量与趋势确认':table['class']='volume-table'
    if label in ['核心资金与筹码表','关键价位']:
        col=1 if label=='核心资金与筹码表' else 0
        for tr in table.find_all('tr'):
            cells=tr.find_all(['td','th'],recursive=False);cells[col]['class']='numeric'
    if label=='关键价位':
        for tr in table.tbody.find_all('tr'):
            cell=tr.find_all('td')[1];content=cell.get_text();cell.clear()
            kind='danger' if '失守' in content else 'warn' if '压力' in content else 'neutral'
            span=doc.new_tag('span',attrs={'class':'tag tag-'+kind});span.string=content;cell.append(span)
for quote in doc.find_all('blockquote'):
    quote['class']='callout callout-danger' if '结构矛盾' in quote.get_text() else 'callout callout-info'
for p in doc.find_all('p'):
    if p.get_text().startswith('口径与缺口：'):p['class']='source-note'
assert len(doc.find_all('h2'))==11
assert all(t.parent.get('class')==['table-wrap'] for t in doc.find_all('table'))
volume=doc.find('table',class_='volume-table')
assert len(volume.tbody.find_all('tr'))==10
for t in doc.find_all('table'):
    width=len(t.thead.find_all('th'))
    assert all(len(r.find_all('td'))==width for r in t.tbody.find_all('tr'))
broken=[]
for link in doc.find_all('a',href=True):
    url=link['href']
    if not urlparse(url).scheme and not url.startswith('#'):
        if not (P/unquote(url.split('#')[0])).resolve().exists():broken.append(url)
assert not broken,broken
HTML.write_text(str(doc),encoding='utf-8')
assert hashlib.sha256(OLD.read_bytes()).hexdigest()==old_hash
evidence=ROOT/'sources/assets/徐工机械/2026-09-15-1800'
calc=json.loads((evidence/'calculation.json').read_text(encoding='utf-8'))
assert all(abs(r['identity_error'])<1 for r in calc['margin'].values())
assert calc['conservation_max_wanyuan']<0.021
daily=json.loads((evidence/'daily.json').read_text(encoding='utf-8'))['payload']['rows']
assert len({r['trade_date'] for r in daily})==len(daily)
assert all(r['vol']>0 for r in daily[:21])
assert abs(calc['volume']['5']['ratio']-1.4543946707663569)<1e-9
assert abs(calc['volume']['20']['ratio']-1.0201832394666948)<1e-9
assert calc['wave']['down_vol']<calc['wave']['up_vol'] and calc['latest']['close']<7.93
validation=dict(status='passed',h2_count=11,h3_count=len(expected_sub),volume_rows=10,all_tables_wrapped=True,local_links_ok=True,utf8_ok=True,margin_balance_identity=True,flow_conservation=True,volume_baseline_excludes_today=True,old_report_sha256=old_hash,old_report_unchanged=True,html=str(HTML),visual_status='structure and responsive CSS checked; screenshot not verified because browser URL policy blocked local file navigation; no workaround attempted')
(evidence/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(validation,ensure_ascii=False,indent=2))
