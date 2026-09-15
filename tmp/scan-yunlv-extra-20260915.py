import sys,json,requests
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path('E:/caojingwen/obsidian/llmwiki')
OUT=ROOT/'sources/automations/持仓每日监控/2026-09-15/云铝股份-1730'
sys.path.insert(0,str(ROOT/'tools/tushare-data/scripts'))
from tushare_client import TushareClient,frame_to_rows

def job(method,code):
    name=method+'-'+code
    try:
        rows=frame_to_rows(getattr(TushareClient(retries=0).pro(),method)(ts_code=code,start_date='20260801',end_date='20260915'))
        (OUT/(name+'.json')).write_text(json.dumps({'method':method,'params':{'ts_code':code,'start_date':'20260801','end_date':'20260915'},'fetched_at':datetime.now().astimezone().isoformat(),'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
        return {'name':name,'count':len(rows),'latest':rows[:1]}
    except Exception as exc:
        (OUT/(name+'.json')).write_text(json.dumps({'error':str(exc)},ensure_ascii=False),encoding='utf-8')
        return {'name':name,'error':type(exc).__name__}
with ThreadPoolExecutor(max_workers=3) as pool:
    for f in as_completed([pool.submit(job,'sw_daily',code) for code in ['850551.SI','801055.SI','801050.SI']]):
        print(json.dumps(f.result(),ensure_ascii=False),flush=True)

import fitz
for name,number in [('meeting-official','1225522156'),('dividend-official','1225522158'),('halfyear-summary','1225522151')]:
    url=f'https://static.cninfo.com.cn/finalpage/2026-08-28/{number}.PDF'
    try:
        response=requests.get(url,timeout=30);response.raise_for_status()
        (OUT/(name+'.pdf')).write_bytes(response.content)
        doc=fitz.open(stream=response.content,filetype='pdf')
        content='\n'.join(p.get_text() for p in doc)
        (OUT/(name+'.txt')).write_text(content,encoding='utf-8')
        print(name,len(doc),content[:50],flush=True)
        (OUT/(name+'-metadata.json')).write_text(json.dumps({'url':url,'fetched_at':datetime.now().astimezone().isoformat()},ensure_ascii=False),encoding='utf-8')
    except Exception as exc:
        (OUT/(name+'-metadata.json')).write_text(json.dumps({'url':url,'error':str(exc)},ensure_ascii=False),encoding='utf-8')
        print(name,type(exc).__name__)
