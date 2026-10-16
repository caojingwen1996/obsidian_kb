import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=process.env.RISKHOT_PROJECT_ROOT||path.resolve(dir,'../../../../..');
const output=process.env.RISKHOT_TEST_OUTPUT||path.join(dir,'全任务输入输出截图');
const checks=[],errors=[],network=[],sources=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>{if(route.request().url().startsWith('file:'))return route.continue();network.push(route.request().url());return route.abort();});
const load=()=>page.goto(pathToFileURL(path.join(dir,'../M3策略管理中心交互原型.html')).href);
const shot=async(name,selector)=>{await page.locator(selector).first().evaluate(el=>{el.scrollIntoView({block:'start'});const panel=el.closest('.node-detail');if(panel)panel.scrollTop=0;});await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});};
try{
 await mkdir(output,{recursive:true});await load();
 const tasks=await page.evaluate(()=>tasks);
 check('16项任务均有独立输入输出和可解析Schema',tasks.length===16&&tasks.every(task=>task.contract&&JSON.parse(task.schema))&&new Set(tasks.map(task=>task.schema)).size===16);
 const sourceDir=path.join(root,'docs/system-design/02-业务架构与领域设计');
 const original=new Map();
 for(const name of (await readdir(sourceDir)).filter(name=>/^RiskHot_L[0-3]_.*\.md$/.test(name))){
  const content=await readFile(path.join(sourceDir,name),'utf8');
  sources.push({file:name,sha256:createHash('sha256').update(content).digest('hex')});
  for(const match of content.matchAll(/^#### (6\.1\.\d+) (AI-[\w-]+) (.+?) 定义\s*$/gm)){
   const section=content.slice(match.index+match[0].length).split(/\n#{3,4} /,1)[0];
   const rows=(start,end)=>section.split('**'+start+'**')[1].split('**'+end+'**')[0].split('\n').filter(line=>line.startsWith('| ')&&!line.startsWith('| 字段')&&!line.startsWith('| ---')).map(line=>line.trim().replace(/^\||\|$/g,'').split('|').map(value=>value.trim()));
   original.set(match[2],{inputs:rows('输入字段','分析职责与步骤'),outputs:rows('输出字段','交付边界'),boundary:section.match(/\*\*交付边界\*\*：(.+)/)[1],heading:match[1]});
  }
 }
 for(const task of tasks){
  const source=original.get(task.id),c=task.contract,schema=JSON.parse(task.schema);
  check(`${task.id}输入输出逐行与文档一致`,JSON.stringify(c.inputs)===JSON.stringify(source.inputs)&&JSON.stringify(c.outputs)===JSON.stringify(source.outputs));
  check(`${task.id}来源与交付边界正确`,c.source.includes('§'+source.heading)&&c.boundary===source.boundary&&schema['x-delivery-boundary']===source.boundary);
  check(`${task.id}顶层包装和必填未虚构`,!schema.type&&!schema.required&&!schema.properties&&schema['x-pending'].length>0&&Object.values(schema.$defs).every(def=>!def.required&&!def.properties.analysis));
  check(`${task.id}未知业务项明确保留而非伪造字段`,schema['x-business-items'].every(item=>c.outputs.some(row=>row[0]===item.label)&&item.status.includes('待定')));
 }
 const byId=Object.fromEntries(tasks.map(task=>[task.id,JSON.parse(task.schema)]));
 check('AI-01无程序生成身份且证据结构待定',!byId['AI-01'].$defs.Event.properties.event_id&&byId['AI-01'].$defs.Event.properties.evidence_locator['x-pending']&&byId['AI-01']['x-business-items'].some(item=>item.label==='初步观测主体'));
 check('AI-02不发明matching_event_id字段',Object.keys(byId['AI-02'].$defs['事件归组引用'].properties).join('|')==='information_id|evidence_locator'&&byId['AI-02']['x-business-items'].some(item=>item.label==='匹配的event_id'));
 const risk=byId['AI-L1-01'].$defs.RiskIdentificationResult.properties;
 check('L1关键变量严格五字段且候选观测方案不混入',Object.keys(risk.key_variables.items.properties).join('|')==='risk_source_code|variable_id|candidate_variable_name|variable_role|variable_impact_on_risk'&&risk.key_variables['x-cross-field-rule'].includes('不能同时缺失'));
 check('L1损害对象为字符串集合、证据嵌套不补造',risk.damage_targets.type==='array'&&risk.damage_targets.items.type==='string'&&risk.evidence_refs.items.type==='object'&&!risk.evidence_refs.items.properties);
 check('金融意义可空且分值范围沿用文档',byId['AI-05'].$defs.EventRating.properties.financial_significance_m.type.includes('null')&&byId['AI-05'].$defs.EventRating.properties.financial_significance_m.maximum===100);
 check('L2作用和阶段候选值没有锁为正式枚举',!byId['AI-L2-01'].$defs.risk_snapshot_variable_analysis.properties.risk_effect.enum&&byId['AI-L2-01'].$defs.risk_snapshot_variable_analysis.properties.risk_effect['x-candidate-values'].includes('undetermined')&&!byId['AI-L2-05'].$defs.RiskSnapshot.properties.risk_stage.enum);
 check('L2当前状态只含五字段且文本范围沿用定义',Object.keys(byId['AI-L2-05'].$defs.RiskSnapshot.properties).join('|')==='risk_level|risk_stage|affected_scope|persistence_outlook|status_summary'&&byId['AI-L2-05'].$defs.RiskSnapshot.properties.affected_scope.type==='string');
 check('L2变化说明保留已有字段不扩为子结构',byId['AI-L2-06'].$defs.RiskAnalysisResult.properties.comparison_snapshot_id.type.includes('null')&&byId['AI-L2-07'].$defs.RiskAnalysisResult.properties.change_reason.type==='string'&&!byId['AI-L2-07'].$defs.RiskAnalysisResult.properties.change_reason.properties&&!byId['AI-L2-08'].$defs.RiskAnalysisResult.properties.weakening_node_status.enum);
 check('L3栏目组合未定且不推定可空规则',byId['AI-L3-01']['x-business-items'].some(item=>item.label==='sections')&&!byId['AI-L3-01'].$defs.RiskReport.properties.sections&&!byId['AI-L3-01'].$defs.ReportRiskItem.properties.comparisonSnapshotId.type);
 if(process.env.RISKHOT_BASELINE){
  const before=await browser.newPage();await before.goto(pathToFileURL(path.join(process.env.RISKHOT_BASELINE,'M3策略管理中心交互原型.html')).href);
  const snapshot=target=>target.evaluate(()=>JSON.stringify({identities:tasks.map(({id,name,layer,version,promptPurpose,promptSource,promptReference})=>({id,name,layer,version,promptPurpose,promptSource,promptReference})),strategies,flows:DOMAIN_FLOWS}));
  check('任务身份、用途、引用、策略及流水线未改变',await snapshot(page)===await snapshot(before));await before.close();
 }
 const samples=new Set(['AI-01','AI-L1-01','AI-L2-05','AI-L3-01']);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1050});await page.locator('[data-view=ai]').click();
  for(const task of tasks){
   await page.locator(`[data-task="${task.id}"]`).click();await page.locator('[data-task-tab=schema]').click();
   for(const [side,rows] of [['input',task.contract.inputs],['output',task.contract.outputs]]){
    const actual=await page.locator(`[data-contract-fields=${side}] tbody tr`).evaluateAll(rows=>rows.map(row=>[row.querySelector('th').textContent,row.querySelectorAll('td')[0].textContent,row.querySelectorAll('td')[1].querySelector('div').textContent]));
    check(`${width}/${task.id}/${side}字段、要求和来源完整`,JSON.stringify(actual)===JSON.stringify(rows));
   }
   check(`${width}/${task.id}五标签、待定及Schema草案可访问`,await page.locator('[data-task-tab]').count()===5&&(await page.locator('.contract-pending').innerText()).includes('待定')&&await page.locator('.contract-schema').getAttribute('open')===null);
   check(`${width}/${task.id}页面及字段表无横向溢出`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.contract-table')].every(el=>el.scrollWidth<=el.clientWidth+1)));
   check(`${width}/${task.id}可访问表格说明不占用竖向版面`,await page.locator('.contract-table caption').evaluateAll(captions=>captions.every(el=>el.getBoundingClientRect().height<=1&&getComputedStyle(el).clipPath==='inset(50%)')));
   if(samples.has(task.id)&&width!==320){
    await shot(`${task.id}-input-${width}`,'.task-contract');
    if(task.id==='AI-L1-01')await shot(`${task.id}-output-${width}`,'[data-contract-fields=output]');
   }
  }
  await page.locator('.contract-schema summary').click();
  check(`${width}展开可读取任务专属Schema`,await page.locator('.contract-schema pre').isVisible()&&JSON.parse(await page.locator('.contract-schema pre').textContent()).title.includes('AI-L3-01'));
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1050});await page.locator('[data-view=panorama]').click();
  for(const header of await page.locator('.module-card:not([open])>summary').all())await header.click();
  for(const strategy of ['STR-L0-01','STR-L0-02','STR-L1-01','STR-L2-01','STR-L2-02','STR-L3-01']){
   const prefix = {'STR-L0-01':'EV','STR-L0-02':'RATE','STR-L1-01':'RISK','STR-L2-01':'STATE','STR-L2-02':'CHANGE','STR-L3-01':'REPORT'}[strategy];
   const nodes=await page.locator('.node.AI').evaluateAll((nodes,prefix)=>nodes.filter(node=>node.dataset.node.startsWith(prefix+'-')).map(node=>node.dataset.node),prefix);
   for(const node of nodes){
    await page.locator(`[data-node="${node}"]`).click();await page.locator('[data-node-task-tab=schema]').click();
    const id=await page.evaluate(()=>referencedTask(flowRecord().flow.find(node=>node.id===state.node)).id),task=tasks.find(task=>task.id===id);
    check(`${width}/${strategy}/${id}共用固定字段定义且只读`,await page.locator('[data-contract-fields=input] tbody tr').count()===task.contract.inputs.length&&await page.locator('[data-contract-fields=output] tbody tr').count()===task.contract.outputs.length&&await page.locator('.contract-schema pre').textContent()===task.schema&&await page.locator('.embedded-task input,.embedded-task textarea').count()===0);
    check(`${width}/${strategy}/${id}面板无溢出且节点配置仍折叠`,await page.evaluate(()=>document.querySelector('.node-detail').scrollWidth<=document.querySelector('.node-detail').clientWidth)&&await page.locator('.node-routing').getAttribute('open')===null);
   }
  }
  await shot(`AI-L3-01-embedded-${width}`,'.node-detail');
 }
 await page.setViewportSize({width:1440,height:1050});await page.locator('[data-view=ai]').click();await page.locator('[data-task="AI-L1-01"]').click();
 await page.locator('[data-action=edit-task]').click();const fixed=tasks.find(task=>task.id==='AI-L1-01').schema;
 check('修订表单带入任务专属Schema',await page.locator('[name=schema]').inputValue()===fixed);
 await page.locator('[name=schema]').fill('[]');await page.locator('[name=reason]').fill('验证Schema草案隔离');await page.locator('button[form=task-form][type=submit]').click();
 check('非JSON对象保留表单并显示错误',(await page.locator('#form-error').innerText()).includes('JSON 对象'));
 const draft=JSON.stringify({...JSON.parse(fixed),$comment:'本轮测试草稿'});await page.locator('[name=schema]').fill(draft);await page.locator('button[form=task-form][type=submit]').click();
 check('草稿未覆盖固定Schema及字段表',await page.locator('.contract-schema pre').textContent()===fixed&&await page.locator('[data-contract-fields=output] tbody tr').count()===tasks.find(task=>task.id==='AI-L1-01').contract.outputs.length);
 await page.locator('[data-action=edit-task]').click();check('再次编辑仍可取回草稿',await page.locator('[name=schema]').inputValue()===draft);await page.keyboard.press('Escape');
 await page.locator('#role').selectOption('授权阅读者');check('阅读者可浏览字段但不能修订',await page.locator('[data-action=edit-task]').isDisabled()&&await page.locator('.task-contract').isVisible());
 await page.evaluate(()=>{const t=tasks.find(task=>task.id===state.task);delete t.contract;render();});
 check('缺失定义明确提示且不回退通用Schema',(await page.locator('#content').innerText()).includes('缺少输入输出定义')&&await page.locator('.contract-table').count()===0);
 check('无脚本错误或外网请求',errors.length===0&&network.length===0);
 const result={date:'2026-10-16',passed:checks.length,inputRows:tasks.reduce((sum,task)=>sum+task.contract.inputs.length,0),outputRows:tasks.reduce((sum,task)=>sum+task.contract.outputs.length,0),checks,sources,errors,network};
 await writeFile(path.join(output,'验证结果.json'),JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({passed:checks.length,inputRows:result.inputRows,outputRows:result.outputRows,output,errors,network}));
}finally{await browser.close();}
