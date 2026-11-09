import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {database} from '../platform/db.js';
import {requestHeaders} from '../scripts/request-headers.js';
import {values,type Config} from '../financial-objects/contracts.js';

// 显式运行才会写实际库；只通过产品接口处理本次创建的验收记录。
if(!process.argv.includes('--run-live'))throw Error('请显式传入 --run-live；该验收会写入当前运行环境');
const origin=process.env.API_ORIGIN!;
const address=new URL(origin);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname));
assert.equal(process.env.AUTH_MODE??'local','local','浏览器验收仅用于本机免登录工作台');
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/Google Chrome\.app/.test(executable))throw Error('需要独立Chrome for Testing/Chromium');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const headers=await requestHeaders(),db=database('ADMIN_DATABASE_URL');
const output=resolve('docs/verification/m4-live'),profile=await mkdtemp(join(tmpdir(),'riskhot-m4-live-'));
await mkdir(output,{recursive:true});
const runId=new Date().toISOString().replaceAll(':','-'),name='[验收] 美元货币单位 '+runId;
const checks:string[]=[],errors:string[]=[],ids:{directory?:string;config?:string;observation?:string}={};
let browser:any,passed=false,cleanup=false,failure:string|undefined;
const record=(text:string)=>{checks.push(text);console.log(text);};
async function api(path:string,method='GET',body?:unknown,key=randomUUID(),status=200){
 const r=await fetch(origin+path,{method,headers:{...headers,...(method==='GET'?{}:{'idempotency-key':key})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20_000)});
 const data=await r.json() as any;
 assert.equal(r.status,status,`${method} ${path}: ${r.status} ${data?.error?.code??''}`);return data;
}
async function inventory(){
 const out:Record<string,{count:number;digest:string}>={};
 for(const t of ['information.target','information.event','information.fact','information.event_target','information.fact_evidence','m1.sources']){
  const {rows}=await db.query(`SELECT to_jsonb(t) v FROM ${t} t ORDER BY to_jsonb(t)::text`);
  out[t]={count:rows.length,digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }return out;
}
async function remember(){await writeFile(join(output,'live-records.json'),JSON.stringify({runId,ids,name},null,2)+'\n');}
async function revise(id:string,patch:Partial<Config>,reason:string){
 const current=(await api('/api/v1/m4/configs/'+id)).config as Config;
 const input={...values(current),...patch,expected_config_version:current.config_version,same_identity:true,reason};
 const impact=await api('/api/v1/m4/configs/'+id+'/impact','POST',input);
 return {impact,result:await api('/api/v1/m4/configs/'+id,'PUT',{...input,impact_token:impact.impact_token})};
}
async function change(action:string,note?:string){
 const d=await api('/api/v1/m4/observations/'+ids.observation);
 return api('/api/v1/m4/observations/'+ids.observation,'PUT',{action,expected_version:d.observation.version,reason:'M4实际部署验收：'+action,...(action==='restore'?{expected_config_version:d.config.config_version}:{}),...(note===undefined?{}:{note})});
}
const before=await inventory();
try{
 const session=await api('/api/v1/session');assert.equal(session.actor,'riskhot-local-operator');
 const list=await api('/api/v1/m4/configs');
 for(const p of ['financial_config_manage','observation_manage','target_mapping_review'])assert.equal(list.permissions[p],true);
 record('实际服务会话、M4接口及当前操作员三项职责可用');
 browser=await chromium.launchPersistentContext(join(profile,'profile'),{executablePath:executable,headless:true,viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 const page=await browser.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('dialog',async(d:any)=>d.accept());
 await page.route('**/*',async(route:any)=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector<HTMLElement>('#m4-content');return e?.getAttribute('aria-busy')==='false'&&e.dataset.route===location.hash;});
 for(const route of ['/m1','/events','/pipeline']){const r=await page.goto(origin+route);assert.equal(r?.status(),200);assert.equal(await page.locator('a[href="/m4"]').count(),1);}
 record('信源、事件、流水线页面正常，导航包含金融对象配置中心');
 await page.goto(origin+'/m4');await ready();
 await page.getByRole('link',{name:'新增分组节点',exact:true}).click();await ready();
 await page.locator('[name=name]').fill('[验收] M4部署 '+runId);await page.locator('[name=status]').selectOption('active');
 await page.locator('[name=reason]').fill('M4实际部署验收目录，验收完成后停用，保留历史');
 await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.waitForFunction(()=>location.hash.startsWith('#config/'));await ready();
 ids.directory=(await page.evaluate(()=>location.hash.slice(8).split('?')[0])) as string;await remember();
 await page.getByRole('link',{name:'新增金融对象',exact:true}).click();await ready();
 await page.locator('[name=name]').fill(name);await page.locator('[name=parent_id]').selectOption(ids.directory);await page.locator('[name=status]').selectOption('active');
 await page.locator('[name=sort_order]').fill('1');await page.locator('[name=aliases]').fill('M4验收USD');
 await page.locator('[name=primary-category]').selectOption('货币与货币形态');await page.locator('[name=secondary-category]').selectOption('货币单位');
 await page.locator('[name=jurisdiction_mode]').selectOption('specified');await page.locator('[name=jurisdiction]').fill('美国');
 await page.locator('[name=scope_definition]').fill('美元货币单位，不包括美元融资市场和美元资产。本条仅用于M4部署验收，不建立真实事件映射。');
 await page.locator('[name=reason]').fill('M4实际部署验收：真实页面新建，完成后停用');
 await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.waitForFunction(()=>location.hash.startsWith('#config/'));await ready();
 ids.config=(await page.evaluate(()=>location.hash.slice(8).split('?')[0])) as string;await remember();
 let d=await api('/api/v1/m4/configs/'+ids.config);assert.equal(d.config.name,name);assert.equal(d.config.parent_id,ids.directory);assert.equal(d.unavailable_reason,null);assert.equal(d.observation,null);
 assert.deepEqual(await inventory(),before);record('实际页面创建目录和金融对象成功；未自动产生观察、Target或事件');
 await page.getByRole('link',{name:'编辑定义',exact:true}).click();await ready();
 await page.locator('[name=aliases]').fill('M4验收USD\nM4部署核对');await page.locator('[name=reason]').fill('M4实际部署验收：修改别名');
 await page.getByRole('button',{name:'预览并保存修改',exact:true}).click();await page.waitForFunction(()=>location.hash.startsWith('#config/'));await ready();
 d=await api('/api/v1/m4/configs/'+ids.config);assert.equal(d.config.config_version,'2');assert.equal(d.config.identity_version,'1');assert.equal(d.snapshots.length,2);record('真实页面编辑持久化，配置版本推进、身份口径保持并保留历史');
 await page.screenshot({path:join(output,'config-desktop.png'),fullPage:true});
 await page.goto(origin+'/targets');await ready();await page.getByRole('button',{name:'添加观察',exact:true}).click();await page.locator('#selector-search').waitFor();
 await page.locator('#selector-search [name=q]').fill(name);await page.locator('#selector-search button').click();
 await page.locator('.selector-row input[data-select="'+ids.config+'"]').check();await page.getByRole('button',{name:'添加所选观察',exact:true}).click();
 await page.getByRole('heading',{name:'本次添加结果',exact:true}).waitFor();assert.match(await page.locator('.pending-list').innerText(),/已添加/);
 ids.observation=(await api('/api/v1/m4/configs/'+ids.config)).observation.id;await remember();await page.getByRole('button',{name:'完成',exact:true}).click();await ready();
 await page.goto(origin+'/targets#observation/'+ids.observation);await ready();
 let observation=await api('/api/v1/m4/observations/'+ids.observation);assert.equal(observation.observation.state,'active');assert.equal(observation.events,null);assert.equal(observation.dynamics_state,'unmapped');
 await page.reload();await ready();assert.equal((await api('/api/v1/m4/configs/'+ids.config)).observation.id,ids.observation);record('从配置选择建立共享观察，刷新后持久化；无映射时明确显示尚未核定');
 const input={config_id:ids.config,expected_config_version:observation.config.config_version,reason:'M4实际部署验收：重复添加'},key=randomUUID();
 const duplicate=await api('/api/v1/m4/observations','POST',input,key,201);assert.equal(duplicate.observation.id,ids.observation);assert.equal(duplicate.outcome,'exists');assert.deepEqual(await api('/api/v1/m4/observations','POST',input,key,201),duplicate);
 const changed=await api('/api/v1/m4/observations','POST',{...input,reason:'同键改输入必须拒绝'},key,409);assert.equal(changed.error.code,'IDEMPOTENCY_CONFLICT');record('重复添加与原键重试复用共享记录，同键改内容被拒绝');
 await page.getByRole('button',{name:'编辑备注',exact:true}).click();await page.locator('#observation-note').fill('仅用于实际部署验收，完成后结束观察并停用配置。');await page.locator('#action-reason').fill('M4实际部署验收：备注');await page.getByRole('button',{name:'确认编辑观察备注',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await ready();
 assert.match((await api('/api/v1/m4/observations/'+ids.observation)).observation.note,/实际部署验收/);
 await change('pause');assert.equal((await api('/api/v1/m4/observations/'+ids.observation)).observation.state,'paused');await change('restore');assert.equal((await api('/api/v1/m4/observations/'+ids.observation)).observation.state,'active');record('备注、暂停和恢复成功，恢复保持原共享观察ID');
 const disabled=await revise(ids.directory!,{status:'disabled'},'M4实际部署验收：上级停用联动');assert.equal(disabled.impact.observations.length,1);
 observation=await api('/api/v1/m4/observations/'+ids.observation);assert.equal(observation.observation.state_reason,'config_unavailable');assert.equal(observation.observation.state,'paused');
 await revise(ids.directory!,{status:'active'},'M4实际部署验收：上级重新启用');assert.equal((await api('/api/v1/m4/observations/'+ids.observation)).observation.state,'paused');await change('restore');record('上级停用原子暂停观察；重新启用不自动恢复，显式恢复成功');
 observation=await api('/api/v1/m4/observations/'+ids.observation);const adopted=observation.adopted_snapshot.id;
 const revised=await revise(ids.config!,{scope_definition:observation.config.scope_definition+' 口径澄清：继续排除融资市场。'},'M4实际部署验收：同身份范围澄清');assert.equal(revised.impact.observations.length,1);
 observation=await api('/api/v1/m4/observations/'+ids.observation);assert.equal(observation.observation.state_reason,'definition_changed');assert.equal(observation.adopted_snapshot.id,adopted);await change('restore');
 observation=await api('/api/v1/m4/observations/'+ids.observation);assert.notEqual(observation.adopted_snapshot.id,adopted);assert.equal(observation.observation.adopted_identity_version,'2');record('范围修订暂停待确认、旧采用快照保留，恢复后采用新口径');
 const legacy=await api('/api/v1/targets','POST',{target_name:'M4禁止旧写入验收',aliases:[],categories:observation.config.categories,jurisdiction:'美国',scope_definition:'此请求必须拒绝，不得产生Target',is_active:true,reason:'M4切换门禁验收'},randomUUID(),409);assert.equal(legacy.error.code,'M4_MANUAL_TARGET_RETIRED');record('旧Target手工写入口已关闭，事件对象目录保持原值');
 await page.reload();await ready();for(const width of [1440,390,320]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(output,'observation-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);record('实际观察页面桌面、390及320宽度可读，无横向溢出或页面脚本错误');
 assert.deepEqual(await inventory(),before);passed=true;
}catch(e){failure=e instanceof Error?e.message:'LIVE_VERIFY_FAILED';}
finally{
 try{
  if(ids.observation){const d=await api('/api/v1/m4/observations/'+ids.observation);if(d.observation.state!=='ended')await change('end');}
  if(ids.config)await revise(ids.config,{status:'disabled'},'M4实际验收完成，停用测试对象并保留历史');
  if(ids.directory)await revise(ids.directory,{status:'disabled'},'M4实际验收完成，停用测试目录并保留历史');
  if(ids.observation)assert.equal((await api('/api/v1/m4/observations/'+ids.observation)).observation.state,'ended');
  assert.deepEqual(await inventory(),before);cleanup=true;
 }catch(e){failure=(failure?failure+'；':'')+'验收收尾失败：'+(e instanceof Error?e.message:'UNKNOWN');passed=false;}
 await browser?.close();await db.end();await rm(profile,{recursive:true,force:true});
 await writeFile(join(output,'live-results.json'),JSON.stringify({runId,origin,passed,cleanup,ids,name,checks,errors,failure,before,mapping_live:'未验证非空映射：实际事件Target目录为空，未为验收伪造Target或事件',test_records:'仅本次验收记录，观察已结束、配置已停用时cleanup=true；保留历史，不物理删除'},null,2)+'\n');
}
if(!passed)throw Error(failure??'LIVE_VERIFY_FAILED');
console.log(JSON.stringify({passed,cleanup,checks:checks.length,ids}));
