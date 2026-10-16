import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(dir);
const round=process.argv[2]||'初检',supplementOnly=process.argv.includes('--embedded-only'),shots=path.join(dir,'标题区域截图',round);
const entries={M1:'06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html',M2:'06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html',M3:'06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html'};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({locale:'zh-CN',colorScheme:'light',reducedMotion:'reduce'});
page.setDefaultTimeout(8000);
const records=[],errors=[],network=[],navigationFailures=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():(network.push(route.request().url()),route.abort()));
const click=s=>page.locator(s).first().click();
const act=s=>click(`[data-action="${s}"]`);
const load=module=>page.goto(pathToFileURL(path.join(root,entries[module])).href);
let module,width;
async function audit(name,capture=false){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const result=await page.evaluate(module=>{
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const heads=[...document.querySelectorAll('h1,h2,.flow-heading h3')].filter(visible).map(el=>{
   const c=getComputedStyle(el),b=el.getBoundingClientRect();
   const range=document.createRange();range.selectNodeContents(el);
   const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);
   return {text:el.textContent.trim(),tag:el.tagName,font:parseFloat(c.fontSize),weight:Number(c.fontWeight),line:parseFloat(c.lineHeight),width:b.width,textFits:rects.every(r=>r.left>=b.left-1&&r.right<=b.right+1),horizontalFits:el.scrollWidth<=el.clientWidth+1,dialog:!!el.closest('dialog'),x:b.x,y:b.y};
  });
  const top=document.querySelector(module==='M1'?'.topbar':module==='M2'?'.r-top':'.top');
  const main=document.querySelector(module==='M2'?'.r-main':'main');
  const h1=heads.filter(h=>h.tag==='H1');
  const failures=[];
  if(Math.abs(top.getBoundingClientRect().height-57)>.5)failures.push('顶栏高度不是57px');
  if(h1.length!==1||h1.some(h=>h.font!==14||h.weight!==600||h.line!==21))failures.push('模块h1须唯一且14px/600/21px');
  for(const h of heads){
   if(h.tag!=='H1'&&(h.font!==20||h.weight!==600))failures.push(`标题层级：${h.text} (${h.font}px/${h.weight})`);
   if(!h.textFits||!h.horizontalFits)failures.push(`标题水平裁切：${h.text}`);
  }
  if(document.documentElement.scrollWidth>innerWidth+1)failures.push('页面整体横向溢出');
  if(parseFloat(getComputedStyle(main).paddingTop)!==20)failures.push('正文顶留白不是20px');
  const dialogs=[...document.querySelectorAll('dialog[open]')];
  const controls=[...top.querySelectorAll('button,select')].filter(visible);
  if(controls.some(el=>{const r=el.getBoundingClientRect();return r.top<top.getBoundingClientRect().top-.5||r.bottom>top.getBoundingClientRect().bottom+.5;}))failures.push('顶栏工具垂直越界（横向滚动遵循V1.1）');
  if(dialogs.some(el=>{const b=el.getBoundingClientRect();return b.left<-.5||b.right>innerWidth+.5;}))failures.push('对话框横向越界');
  if(module==='M3'&&document.querySelector('#panorama-strategy')){
   if(!document.querySelector('#node-form [name=name]')?.matches(':disabled'))failures.push('流水线未保持只读');
   if(innerWidth===1440){const left=document.querySelector('.flow-area').getBoundingClientRect(),right=document.querySelector('.inspector').getBoundingClientRect();if(Math.abs(left.width/right.width-1.5)>.01)failures.push('流水线左右比例不是6:4');}
  }
  return {topHeight:top.getBoundingClientRect().height,mainTopPadding:parseFloat(getComputedStyle(main).paddingTop),pageWidth:document.documentElement.scrollWidth,headings:heads,failures};
 },module);
 const record={module,name,width,...result};records.push(record);
 if(capture){
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  record.screenshot=path.relative(dir,path.join(shots,`${module}-${width}-${name.replace(/[^\p{L}\p{N}-]/gu,'_')}.png`));
  await page.screenshot({path:path.join(dir,record.screenshot),fullPage:false,animations:'disabled'});
 }
}
async function m1(){
 await load('M1');
 for(const v of ['all','verify','monitor','research']){await click(`[data-view=${v}]`);await audit('目录-'+v,v==='research');}
 await click('[data-view=all]');
 while(await page.locator('[data-action=load-more]').count())await act('load-more');
 const ids=await page.locator('.source-row').evaluateAll(rows=>[...new Set(rows.map(x=>x.dataset.select))]);
 for(const id of ids){await click(`.source-row[data-select="${id}"]`);await audit('档案-'+id);if(width<=960)await act('close-detail');}
 const source=async()=>{await page.locator('#search').fill('国家统计局');await click('#search-form button[type=submit]');await click('.source-row');};
 await source();
 for(const tab of ['archive','tech','relations','history']){await click(`[data-tab=${tab}]`);await audit('详情-'+tab,tab==='archive');}
 await act('edit');await audit('编辑信源',true);await act('close-editor');
 await act('status');await audit('停用确认',true);await act('close-operation');
 await act('edit');await page.locator('#field-description').fill('标题检查演示');await page.locator('#field-reason').fill('核对历史标题展示');await click('#save');
 await click('[data-tab=history]');await click('[data-action=view-history][data-side=before]');await audit('历史只读弹窗',true);await act('close-history');
 if(width<=960)await act('close-detail');
 await click('#create');await audit('新增信源',true);await click('#save');await audit('新增校验失败');await act('close-editor');
 await click('#preview-toggle');
 for(const scene of ['loading','error','denied','empty','offline']){await page.locator('#scene').selectOption(scene);await audit('状态-'+scene,scene==='error');}
 await page.locator('#scene').selectOption('normal');
 for(const role of ['researcher','admin','operator']){await page.locator('#role').selectOption(role);await audit('角色-'+role);}
 await page.locator('#role').selectOption('both');await source();
 await act('edit');await page.locator('#field-description').fill('检查未保存提示');await page.keyboard.press('Escape');await audit('未保存确认',true);await act('discard-editing');
 await page.locator('#write-mode').selectOption('unknown');await act('status');await click('#operation-confirm');await audit('启停响应未知',true);await click('#operation-confirm');
 await act('status');await audit('启用确认',true);await act('close-operation');
 if(width<=960)await act('close-detail');
 await load('M1');await click('#preview-toggle');await source();
 await act('edit');await page.locator('#field-description').fill('写入状态检查');await page.locator('#field-reason').fill('检查标题及版本对照');
 for(const mode of ['error','conflict','unknown']){await page.locator('#write-mode').selectOption(mode,{force:true});await click('#save');await audit('保存-'+mode,true);}
 await act('query-result');
 if(width<=960)await act('close-detail');
 await click('#create');
 for(const [key,value] of Object.entries({name:'国家统计局',code:'DEMO_NBS_MACRO',publisher:'国家统计局',locator:'DEMO-ARCHIVE-001',scope:'宏观资料核验',reason:'检查查重对照标题'}))await page.locator('#field-'+key).fill(value);
 await page.locator('#field-category').selectOption('官方发布（演示）');await page.locator('#field-material').selectOption('人工材料（演示）');await page.locator('#field-mode').selectOption('manual');await click('#save');await audit('新增查重对照',true);
}
async function m2(){
 await load('M2');
 for(const view of ['sources','variables','types']){
  await click(`[data-view=${view}]`);await audit('目录-'+view,true);
  const ids=await page.locator('[data-id]').evaluateAll(rows=>rows.map(x=>x.dataset.id));
  for(const id of ids){await click(`[data-id="${id}"]`);await audit('定义-'+id);}
  for(const tab of view==='variables'?['definition','observations','history']:['definition','history']){await click(`[data-detail-tab=${tab}]`);await audit(view+'-详情-'+tab);}
  if(await page.locator('[data-action=new]').count()){await act('new');await audit(view+'-新增',true);await act('back');}
  await act('edit');await audit(view+'-修订',true);await act('back');
  await act('feedback');await audit(view+'-反馈',true);await act('back');
 }
 await click('[data-view=variables]');await click('[data-id=DEMO-V001]');await click('[data-detail-tab=observations]');
 const indicators=await page.locator('[data-open-indicator]').evaluateAll(rows=>rows.map(x=>x.dataset.openIndicator));
 for(const id of indicators){await click(`[data-open-indicator=${id}]`);await audit('指标-'+id);await act('close-indicator');}
 await click('[data-open-indicator=DEMO-I001]');
 for(const tab of ['definition','history']){await click(`[data-indicator-tab=${tab}]`);await audit('指标页签-'+tab);}
 await click('[data-indicator-tab=definition]');
 for(const action of ['indicator-definition','indicator-source','indicator-mapping','indicator-feedback']){await act(action);await audit(action,true);await act('indicator-back');}
 await act('close-indicator');await act('link-indicator');await audit('添加观测指标',true);await act('close-indicator');
 await act('governance');await audit('候选目录',true);
 const candidates=await page.locator('[data-review-candidate]').evaluateAll(rows=>rows.map(x=>x.dataset.reviewCandidate));
 for(const id of candidates){await click(`[data-review-candidate=${id}]`);await audit('候选审核-'+id,id==='DEMO-C01');
  for(const choice of ['new','return','defer','reject']){await page.locator('#rh-decision').selectOption(choice);await audit('候选处理-'+id+'-'+choice);}
  if(id==='DEMO-C01'){await page.locator('.r-ai-observations').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await audit('AI观测审核',true);}
  await act('close-governance');
 }
 await click('[data-review-candidate=DEMO-C01]');await page.locator('#rh-decision').selectOption('defer');await page.locator('#rh-reason').fill('标题检查保留候选处理材料');await page.locator('#rh-confirm').check();await click('[form=rh-review]');await audit('候选处理后',true);await act('close-governance');
 await click('#rh-revisions');await audit('修订审核记录',true);
 await load('M2');await page.emulateMedia({colorScheme:'dark'});await audit('暗色目录',true);await page.emulateMedia({colorScheme:'light'});
 for(const name of ['key-catalog','key-governance','key-indicator','key-revision']){await page.goto(pathToFileURL(path.join(root,path.dirname(entries.M2),'mockups',name+'.html')).href);await audit('现行场景入口-'+name,true);}
}
async function m3(){
 await load('M3');await audit('策略目录',true);await act('new');await audit('新建策略',true);await act('close-modal');
 await act('panorama');await audit('系统流水线',true);
 const flows=await page.locator('#panorama-strategy option').evaluateAll(rows=>rows.map(x=>x.value));
 for(const flow of flows){await page.locator('#panorama-strategy').selectOption(flow);await audit('只读流水线-'+flow,flow!=='system');
  await page.locator('.stage-extra').evaluateAll(items=>items.forEach(el=>el.open=true));
  const nodes=await page.locator('[data-node]').evaluateAll(rows=>rows.map(x=>x.dataset.node));
  for(const id of nodes){await page.locator('.stage-extra').evaluateAll(items=>items.forEach(el=>el.open=true));await click(`[data-node="${id}"]`);await audit('节点-'+flow+'-'+id);}
  if(await page.locator('#version').count()){const versions=await page.locator('#version option').evaluateAll(rows=>rows.map(x=>x.value));for(const v of versions){await page.locator('#version').selectOption(v);await audit('只读版本-'+flow+'-'+v);}}
 }
 await click('[data-view=catalog]');const ids=await page.locator('[data-strategy]').evaluateAll(rows=>rows.map(x=>x.dataset.strategy));
 for(const id of ids){await click(`[data-action=open][data-id="${id}"]`);for(const tab of ['basic','flow','dependencies','history']){await click(`[data-detail=${tab}]`);await audit('策略详情-'+id+'-'+tab,id==='STR-L2-01');}await click('[data-view=catalog]');}
 await click('[data-action=open][data-id=STR-L2-01]');await act('copy');await audit('复制策略',true);await act('close-modal');await click('[data-detail=flow]');await act('add-node');await audit('新增节点',true);await act('close-modal');
 await click('[data-detail=history]');await act('review');await audit('提交审核',true);await page.locator('[name=reason]').fill('标题检查确认版本及引用');await page.locator('[name=confirmed]').check();await click('button[form=review-form][type=submit]');await audit('审核中治理');
 await act('return-review');await audit('退回修改',true);await act('close-modal');await act('activate');await audit('审核生效',true);await act('close-modal');
 await page.locator('#version').selectOption('V1.2');await act('disable');await audit('停用版本',true);await act('close-modal');
 await click('[data-view=ai]');const tasks=await page.locator('[data-task]').evaluateAll(rows=>rows.map(x=>x.dataset.task));
 for(const id of tasks){await click(`[data-task="${id}"]`);for(const tab of ['definition','prompt','schema','constraints','usage']){await click(`[data-task-tab=${tab}]`);await audit('AI-'+id+'-'+tab,id===tasks[0]);}}
 await act('edit-task');await audit('AI任务修订',true);await act('close-modal');
 await click('[data-view=evaluation]');
 for(const tab of ['compare','datasets','metrics','history']){await click(`[data-eval-tab=${tab}]`);await audit('策略评估-'+tab,true);}
 await act('new-eval');await audit('新建评估',true);await act('close-modal');
 await click('[data-eval-tab=datasets]');await act('revise-dataset');await audit('评测集修订',true);await act('close-modal');
 const cases=await page.locator('[data-action=dataset-case]').evaluateAll(rows=>rows.map(x=>x.dataset.id));
 for(const id of cases){await click(`[data-action=dataset-case][data-id="${id}"]`);await audit('评测案例-'+id);await act('close-modal');}
 await click('[data-eval-tab=compare]');
 for(const id of cases){await click(`[data-action=case][data-id="${id}"]`);await audit('案例差异-'+id,id===cases[0]);await act('close-modal');}
 await page.locator('#role').selectOption('授权阅读者');await audit('阅读者评估');await act('panorama');await audit('阅读者流水线');
 await embedded();
}
async function embedded(){
 await load('M3');await act('panorama');await page.locator('#panorama-strategy').selectOption('STR-L2-01');await click('[data-node=A1]');
 for(const tab of ['definition','prompt','schema','constraints','usage']){await click(`[data-node-task-tab=${tab}]`);await audit('内嵌AI任务-'+tab,true);}
}
try{
 await mkdir(shots,{recursive:true});
 for(module of supplementOnly?['M3']:['M1','M2','M3'])for(width of [1440,390,320]){
  console.log(`检查 ${module} ${width}px`);await page.setViewportSize({width,height:width===1440?1000:844});
  try{await (supplementOnly?embedded:({M1:m1,M2:m2,M3:m3}[module]))();}catch(e){navigationFailures.push({module,width,message:e.message});console.error(e.message);}
 }
}finally{
 const result={date:'2026-10-16',round,order:['M1','M2','M3'],widths:[1440,390,320],records,errors,network,navigationFailures};
 await writeFile(path.join(dir,'标题区域逐页检查-'+round+'.json'),JSON.stringify(result,null,2),'utf8');await browser.close();
 console.log(JSON.stringify({scenes:records.length,failures:records.filter(x=>x.failures.length).length,navigationFailures,errors,network}));
 if(navigationFailures.length||errors.length||network.length||records.some(x=>x.failures.length))process.exitCode=1;
}
