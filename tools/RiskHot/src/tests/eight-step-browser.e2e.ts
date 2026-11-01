import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import Fastify from 'fastify';
import {registerWeb} from '../runtime/web.js';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('独立测试浏览器路径必填');
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('PLAYWRIGHT_MODULE必填');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const profile=await mkdtemp(join(tmpdir(),'riskhot-eight-ui-')),output=resolve('docs/verification/f02-eight-step-ui');await mkdir(output,{recursive:true});
const id='00000000-0000-4000-8000-000000000001',hash='a'.repeat(64),posts:any[]=[],errors:string[]=[];
let forbidden=false,association=false,attempts=0,browser:any;const app=Fastify();registerWeb(app,{schemaVersion:5});
app.get('/api/v1/session',async()=>({permissions:['event_review','event_retry']}));
app.get('/api/v1/f02/candidates/:id',async(_request,reply)=>forbidden?reply.code(403).send({error:{code:'FORBIDDEN'}}):({candidate:{id,material_id:id,payload:{title:'美国国债发行安排'},status:'review'},saved_event_id:association?id:null,nodes:[{node_key:'map_event',state:'succeeded',result:{title:'国债发行',object:'七年期国债'}},{node_key:'recognize_targets',state:'succeeded',result:{status:'ready',output:{candidates:[{raw_name:'美国国债',gaps:['发行批次待确认']}]}}},{node_key:'resolve_event',state:'review',input_digest:hash,review_digest:hash,result:{decision:'NEW',reason:'主体、行动与范围已经核对'}},{node_key:'classify_usage',state:'waiting',reason_code:'CLASSIFICATION_RULE_UNPUBLISHED'},...(association?[{node_key:'associate_events',state:'recoverable',reason_code:'FORBIDDEN'}]:[])]}));
app.post('/api/v1/f02/candidates/:id/reviews',async(request,reply)=>{posts.push({headers:request.headers,body:request.body});if(attempts++===0)return reply.code(503).send({error:{code:'UNAVAILABLE'}});return reply.code(202).send({accepted:true});});
app.post('/api/v1/f02/candidates/:id/resume',async()=>({accepted:true}));
try{
 await app.listen({host:'127.0.0.1',port:0});const origin=app.listeningOrigin;
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1050},reducedMotion:'reduce'});const page=await browser.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.route('**/*',async(route:any)=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
 await page.goto(`${origin}/events/tasks/${id}`);await page.getByRole('heading',{name:'美国国债发行安排'}).waitFor();assert.equal(await page.getByText('规则未发布，等待规则确认后继续。').count(),1);assert.equal(await page.locator('[data-eight-review]').count(),1);
 await page.getByLabel('复核说明').fill('核对原文后确认新事件');await page.getByRole('button',{name:'确认本步骤并继续'}).click();await page.getByRole('button',{name:'重试本次原操作'}).waitFor();await page.getByRole('button',{name:'重试本次原操作'}).click();await page.getByText('操作已受理，正在更新任务状态。').waitFor();assert.equal(posts.length,2);assert.equal(posts[0].headers['idempotency-key'],posts[1].headers['idempotency-key']);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(posts[0].body.proposal_digest,hash);
 association=true;await page.getByRole('button',{name:'刷新状态'}).click();await page.getByText('事件已保存',{exact:true}).waitFor();await page.getByText(/关联补充失败/).waitFor();await page.screenshot({path:join(output,'desktop.png'),fullPage:true});
 const desktop=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(desktop.scroll<=desktop.width);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'mobile.png'),fullPage:true});const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(mobile.scroll<=mobile.width);
 forbidden=true;await page.getByRole('button',{name:'刷新状态'}).click();await page.getByText('当前无法读取此任务。请核对登录状态及全部来源的访问权限。').waitFor();assert.equal(await page.locator('[data-eight-review]').count(),0);assert.deepEqual(errors,[]);
 await writeFile(join(output,'results.json'),JSON.stringify({checks:['只读加载无自动批准','规则未发布可见','复核POST绑定提案摘要','未知结果原幂等键原内容重试','保存与关联失败独立显示','桌面与手机无横向溢出','撤权清除任务内容和操作'],desktop,mobile,errors,browser:'独立Chrome for Testing，专用临时数据目录',data:'受控接口夹具，非正式业务验收'},null,2)+'\n','utf8');console.log('八步界面7项浏览器检查通过');
}finally{await browser?.close();await app.close();await rm(profile,{recursive:true,force:true});}
