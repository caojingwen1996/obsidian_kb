import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const shots=path.join(dir,'C01布局截图');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[],network=[],checks=[],viewports=[],captures=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():(network.push(r.request().url()),r.abort()));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const load=()=>page.goto(pathToFileURL(path.join(dir,'../M3策略管理中心交互原型.html')).href);
const action=name=>page.locator(`[data-action="${name}"]`).first().click();
const section=name=>page.locator(`[data-detail="${name}"]`).click();
const snap=async(name,fullPage=false)=>{await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.locator('#toast').waitFor({state:'hidden'});const file=name+'.png';await page.screenshot({path:path.join(shots,file),fullPage,animations:'disabled'});captures.push(file);};
const fit=async(name,width)=>{const dim=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));assert.ok(dim.page<=dim.viewport,`${name}/${width}整体溢出`);viewports.push({name,width,...dim});};
try {
 await mkdir(shots,{recursive:true});
 for(const width of [1920,1440,1024,768,390,320]) {
  await page.setViewportSize({width,height:width<650?844:1050});await load();
  const capture=[1440,390].includes(width),suffix=width===1440?'桌面':'手机';
  await fit('策略目录',width);
  if(capture)await snap('策略目录-'+suffix);
  if(width===1440){
   check('流水线作为独立子菜单',await page.locator('.workspace-nav [data-view=panorama]').count()===1&&await page.locator('.architecture-entry').count()===0);
   check('流水线子菜单仅显示名称',await page.locator('[data-view=panorama]').innerText().then(t=>t==='流水线全景'));
   check('新建策略归当前页顶栏操作区',await page.locator('#page-tools [data-action=new]').count()===1&&await page.locator('.workspace-nav [data-action=new]').count()===0);
  }
  await action('panorama');await fit('业务流程全景',width);
  if(capture)await snap('业务流程全景-'+suffix,true);
  if(width===1440){
   check('系统全景明确只读且不提供添加节点',await page.locator('.panorama-state').innerText().then(t=>t.includes('RiskHot 全系统流程 · 只读'))&&await page.locator('[data-action=add-node]').count()===0&&await page.locator('.panorama-empty').count()===1);
   check('架构全景继续分L0至L3及M支撑',await page.locator('.flow-stage[data-stage^=L]').count()===4&&await page.locator('.support-stage[data-stage=M]').count()===1);
  }
  await page.locator('[data-view=catalog]').click();await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await fit('流水线编排',width);
  if(capture)await snap('流水线编排-'+suffix);
  if(width===1440){
   check('四项导航顺序按用户要求',JSON.stringify(await page.locator('.strategy-sections button > span').allTextContents())===JSON.stringify(['策略基本信息与适用范围','流水线编排','规则与 AI Task 引用','版本治理与生效']));
   check('默认打开核心流水线',await page.locator('[data-detail=flow]').getAttribute('aria-pressed')==='true'&&await page.locator('[data-detail=flow] small').innerText()==='核心编辑区域');
   check('编辑工具保留复制保存和所查看版本',await page.locator('#page-tools [data-action=copy]').count()===1&&await page.locator('#page-tools [data-action=save]').count()===1&&await page.locator('#version').inputValue()==='V2.0');
   check('审核生效操作不混入编排工具',await page.locator('[data-action=review],[data-action=activate],[data-action=disable]').count()===0);
   check('编排区保持6比4',await page.locator('.flow-overview').evaluate(el=>{const a=el.querySelector('.flow-area').getBoundingClientRect(),b=el.querySelector('.inspector').getBoundingClientRect();return Math.abs(a.width/b.width-1.5)<.01;}));
   await snap('流水线编排-完整',true);
  }
  if(width<650)check(width+'px四项导航两列且顺序不变',await page.locator('.strategy-sections').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length===2));
  await section('basic');check(width+'px详情分区不恢复重复模块标题',await page.locator('.heading').isHidden());await fit('基本信息与适用范围',width);
  if(capture)await snap('基本信息与适用范围-'+suffix,true);
  if(width===1440){
   const savedScope=await page.locator('#basic-form [name=scope]').inputValue();await page.locator('#basic-form [name=scope]').fill('布局验证适用范围');await page.locator('#basic-form button').click();await section('flow');await section('basic');check('分区切换保留既有保存行为',await page.locator('#basic-form [name=scope]').inputValue()==='布局验证适用范围');await page.locator('#basic-form [name=scope]').fill(savedScope);await page.locator('#basic-form button').click();
  }
  await section('dependencies');await fit('规则与AI引用',width);
  if(capture)await snap('规则与AI引用-'+suffix,true);
  if(width===1440){
   check('领域规则与AI Task分区显示',await page.locator('.rule-list li').count()>0&&await page.locator('.ai-reference .result-list li').count()===5);
   check('历史运行保留在途锁定',await page.locator('.reference-usage').innerText().then(t=>t.includes('锁定 V1.2')));
  }
  await section('history');await fit('版本治理与生效',width);
  if(capture)await snap('版本治理与生效-'+suffix,true);
  if(width===1440){
   check('治理页签审核动作归顶栏且唯一',await page.locator('#page-tools [data-action=review]').count()===1&&await page.locator('[data-action=review]').count()===1);
   check('治理动作先于历史材料',await page.locator('.governance-bar').evaluate(el=>el.getBoundingClientRect().bottom<document.querySelector('.governance-history').getBoundingClientRect().top));
  }
  await action('review');check(width+'px治理确认保留在途说明',await page.locator('#modal').innerText().then(t=>t.includes('继续锁定 V1.2')));
  check(width+'px治理弹窗在视口内',await page.locator('#modal').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  if(capture)await snap('治理确认-'+suffix);
  await page.keyboard.press('Escape');await page.locator('#role').selectOption('授权阅读者');
  check(width+'px阅读者治理操作禁用',await page.locator('[data-action=review]').isDisabled());
  if(capture)await snap('治理只读-'+suffix,true);
 }
 await page.setViewportSize({width:320,height:844});await load();
 await page.evaluate(()=>{strategies[0].name='风险状态分析策略与跨层证据完整性复核的长名称展示验证';render();});
 await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await fit('长名称策略',320);await snap('长名称策略-320');
 await load();await page.locator('#search').fill('不存在的策略');check('无结果保留清空筛选入口',await page.locator('[data-action=clear-filters]').isVisible());await snap('空搜索-320',true);
 await action('clear-filters');check('清空恢复六条策略',await page.locator('[data-strategy]').count()===6);
 check('无脚本异常',errors.length===0);check('无外网请求',network.length===0);
 const result={date:'2026-10-16',checks,viewportChecks:viewports.length,viewports,captures,errors,network,scope:'C01排布与原有交互到达路径；非真实业务系统验收'};
 await writeFile(path.join(dir,'C01排布验证结果.json'),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify({checks:checks.length,viewportChecks:viewports.length,captures:captures.length,errors,network}));
} finally {await browser.close();}
