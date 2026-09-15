import sys, json, hashlib, shutil
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

ROOT=Path('E:/caojingwen/obsidian/llmwiki')
OUT=ROOT/'sources/automations/持仓每日监控/2026-09-15/云铝股份-1730'
OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient, frame_to_rows

def save(name,obj):
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,default=str),encoding='utf-8')

report=ROOT/'workbench/targets/2026-07-23-1421-云铝股份-机构级决策研报.md'
save('baseline-hash.json',{'path':str(report),'sha256':hashlib.sha256(report.read_bytes()).hexdigest()})
for name in ['000807-云铝股份-每日监控-2026-09-15.md','000807-云铝股份-每日监控-2026-09-15.html','持仓今日监控汇总-2026-09-15.md','持仓今日监控汇总-2026-09-15.html','monitor-run-2026-09-15.json']:
    dest=OUT/('previous-'+name)
    if not dest.exists(): shutil.copy2(ROOT/'tools/a-share-market-dashboard/data'/name,dest)

def fetch_api(name,method,params):
    start=datetime.now().astimezone().isoformat()
    try:
        client=TushareClient(retries=0)
        rows=frame_to_rows(getattr(client.pro(),method)(**params))
        result={'provider':'Tushare','method':method,'params':params,'fetched_at':start,'rows':rows}
        save(name+'.json',result)
        return {'name':name,'count':len(rows),'latest':rows[:1]}
    except Exception as exc:
        result={'name':name,'error_type':type(exc).__name__,'error':str(exc),'fetched_at':start}
        save(name+'.json',result)
        return {'name':name,'error_type':type(exc).__name__}

jobs=[('daily','daily',dict(ts_code='000807.SZ',start_date='20260801',end_date='20260915')),
      ('daily_basic','daily_basic',dict(ts_code='000807.SZ',start_date='20260801',end_date='20260915')),
      ('moneyflow','moneyflow',dict(ts_code='000807.SZ',start_date='20260901',end_date='20260915')),
      ('margin_detail','margin_detail',dict(ts_code='000807.SZ',start_date='20260901',end_date='20260915')),
      ('stock_basic','stock_basic',dict(ts_code='000807.SZ')),
      ('trade_cal','trade_cal',dict(exchange='SSE',start_date='20260914',end_date='20260915')),
      ('industry_member','index_member_all',dict(ts_code='000807.SZ',is_new='Y')),
      ('dividend','dividend',dict(ts_code='000807.SZ'))]
with ThreadPoolExecutor(max_workers=4) as pool:
    futures=[pool.submit(fetch_api,*job) for job in jobs]
    for future in as_completed(futures): print(json.dumps(future.result(),ensure_ascii=False),flush=True)

urls={
 'announcement-index':'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/000807.phtml',
 'meeting':'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12563356&stockid=000807',
 'dividend-announcement':'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12563354&stockid=000807',
 'smm-inventory':'https://hq.smm.cn/h5/alu-stock',
 'mysteel-spot':'https://news.mysteel.com/',
}
for name,url in urls.items():
    try:
        response=requests.get(url,timeout=25,headers={'User-Agent':'Mozilla/5.0'})
        response.raise_for_status()
        (OUT/(name+'.html')).write_bytes(response.content)
        save(name+'-metadata.json',{'url':url,'status':response.status_code,'fetched_at':datetime.now().astimezone().isoformat()})
        print(name,response.status_code,len(response.content),flush=True)
    except Exception as exc: save(name+'-metadata.json',{'url':url,'error':str(exc)})

try:
    url='https://www.cninfo.com.cn/new/hisAnnouncement/query'
    response=requests.post(url,data={'pageNum':1,'pageSize':30,'column':'szse','tabName':'fulltext','stock':'000807,gssz0000807','seDate':'2026-08-28~2026-09-15','sortName':'time','sortType':'desc','isHLtitle':'true'},headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.cninfo.com.cn/'},timeout=25)
    response.raise_for_status()
    save('cninfo-index.json',response.json())
    print('cninfo',len(response.json().get('announcements') or []),flush=True)
except Exception as exc: save('cninfo-index.json',{'error':str(exc),'query_period':'2026-08-28~2026-09-15'})
