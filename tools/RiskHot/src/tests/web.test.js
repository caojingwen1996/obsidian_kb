import test from 'node:test';
import assert from 'node:assert/strict';

test('schedule period units preserve existing durations and convert decimal hours without exceeding current bounds', async () => {
  const {schedulePeriod,periodSeconds,formatPeriod}=await import('../web/model.js');
  assert.deepEqual(schedulePeriod(3600),{value:1,unit:'hours'});
  assert.deepEqual(schedulePeriod(86400),{value:1,unit:'days'});
  assert.deepEqual(schedulePeriod(5400),{value:90,unit:'minutes'});
  assert.equal(periodSeconds('30','minutes'),1800);
  assert.equal(periodSeconds('1.5','hours'),5400);
  assert.equal(periodSeconds('1','days'),86400);
  assert.equal(periodSeconds(String(schedulePeriod(61).value),'minutes'),61);
  for(const [value,unit]of [['0','minutes'],['2','days'],['24.01','hours'],['abc','hours'],['1','weeks'],['1.0001','minutes']])assert.throws(()=>periodSeconds(value,unit));
  assert.equal(formatPeriod(7200),'2 小时');
  assert.equal(formatPeriod(86400),'1 天');
  assert.equal(formatPeriod(1800),'30 分钟');
});

test('directory identity search does not match unrelated focus or background prose', async () => {
  const {filterSources}=await import('../web/model.js');
  const rows=[{catalog_key:'a',name:'中国人民银行',metadata:{}},{catalog_key:'b',name:'其他来源',metadata:{focus:'观察中国人民银行发布的数据'}}];
  assert.deepEqual(filterSources(rows,{q:'中国人民银行'}).map(x=>x.catalog_key),['a']);
});

test('multi-valued business filters use OR within one dimension and intersection across dimensions', async () => {
  const {filterSources}=await import('../web/model.js');
  const rows=[{catalog_key:'a',metadata:{dims:['流动性'],levels:['国家'],category:'官方'}},{catalog_key:'b',metadata:{dims:['资产价格'],levels:['行业'],category:'研究'}},{catalog_key:'c',metadata:{dims:['增长'],levels:['国家'],category:'官方'}}];
  assert.deepEqual(filterSources(rows,{dims:['流动性','资产价格'],levels:'国家'}).map(x=>x.catalog_key),['a']);
  assert.deepEqual(filterSources(rows,{category:'研究'}).map(x=>x.catalog_key),['b']);
});

test('source search uses persisted metadata and unknown classifications remain empty', async () => {
  const { filterSources, profileOf } = await import('../web/model.js');
  const rows = [{catalog_key:'wiki-source-001',name:'央行',state:'ACTIVE',metadata:{tier:'T1',group:'政策',publisher:'中国人民银行'}},
    {catalog_key:'wiki-source-002',name:'参考来源',state:'DISABLED',metadata:{tier:'T2',group:'市场'}}];
  assert.deepEqual(filterSources(rows,{q:'人民银行',tier:'T1'}).map(x=>x.catalog_key),['wiki-source-001']);
  assert.equal(filterSources(rows,{state:'DISABLED'}).length,1);
  assert.deepEqual(profileOf(rows[1]).dims,[]);
  assert.equal(profileOf(rows[1]).frequency,'');
});

test('saved counts come from fixed material versions and failed extraction is not zero candidates', async () => {
  const { progressOf, countSaved, candidateCount } = await import('../web/model.js');
  assert.equal(countSaved({children:[{version_id:'v1'},{version_id:'v1'},{version_id:null}]}),1);
  assert.equal(candidateCount({extraction_status:'recoverable',candidate_count:null}),'待确认');
  assert.equal(candidateCount({extraction_status:'completed',candidate_count:0}),'0');
  assert.deepEqual(progressOf({stage:'normalized',status:'running'}),{completed:3,current:4});
  assert.deepEqual(progressOf({stage:'extract',status:'waiting_config',version_id:'v1',processing_id:'p1'}),{completed:6,current:0});
});

test('period boundaries use Shanghai dates and reject reversed or non-calendar dates', async () => {
  const { shanghaiDate, validRange } = await import('../web/model.js');
  assert.equal(shanghaiDate(new Date('2026-10-25T17:00:00Z')),'2026-10-26');
  assert.equal(validRange('2026-10-26','2026-10-25'),false);
  assert.equal(validRange('2026-02-30','2026-03-01'),false);
  assert.equal(validRange('2026-10-25','2026-10-26'),true);
});

test('request client preserves idempotency key and payload across unknown outcome recovery', async () => {
  const { createClient } = await import('../web/api.js');
  const calls=[]; let count=0;
  const api=createClient(async(url,options)=>{calls.push({url,options}); if(count++===0)throw new TypeError('offline'); return new Response(JSON.stringify({id:'batch1'}),{status:202});});
  const command=api.command('/api/v1/l0/task-batches','POST',{source_keys:['wiki-source-001'],limit:1});
  await assert.rejects(()=>api.send(command),error=>error.code==='OUTCOME_UNKNOWN'&&error.command===command);
  assert.deepEqual(await api.send(command),{id:'batch1'});
  assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key']);
  assert.equal(calls[0].options.body,calls[1].options.body);
});

test('request client distinguishes expired login, forbidden scope and service failure', async () => {
  const { createClient } = await import('../web/api.js');
  for(const [status,code] of [[401,'UNAUTHENTICATED'],[403,'FORBIDDEN'],[503,'TEMPORARY_UNAVAILABLE']]){
    const api=createClient(async()=>new Response(JSON.stringify({error:{code}}),{status}));
    await assert.rejects(()=>api.get('/api/v1/m1/sources'),error=>error.code===code&&error.status===status);
  }
});

test('source grouping does not duplicate identities within a group and absent dimensions stay explicit', async () => {
  const { groupSources } = await import('../web/model.js');
  const row={catalog_key:'wiki-source-001',metadata:{dims:['政策','政策'],tier:'T1'}};
  assert.deepEqual(groupSources([row],'research').map(x=>[x.name,x.items.length]),[['政策',1]]);
  assert.equal(groupSources([{catalog_key:'wiki-source-002',metadata:{}}],'research')[0].name,'待补充金融属性');
});

test('接入结果保留候选事实读取入口，不再提供候选处理页面入口',async()=>{
 const {renderDelivery}=await import('../web/model.js');
 for(const event_processing of [null,{id:'p',result_status:'review'}]){
  const html=renderDelivery({version_id:'v',status:'received',event_processing,files:{}});
  assert.match(html,/查看候选事实与归属/);
  assert.doesNotMatch(html,/处理为正式事件|查看事件处理|#processing=|#version=/);
 }
});
