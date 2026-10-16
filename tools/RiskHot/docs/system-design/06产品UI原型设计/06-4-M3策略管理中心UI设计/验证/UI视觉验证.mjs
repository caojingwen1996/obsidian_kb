import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const base=path.dirname(dir),shots=path.join(base,'.impeccable/review');
await mkdir(shots,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[],network=[],captures=[],viewports=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{if(route.request().url().startsWith('file:'))return route.continue();network.push(route.request().url());return route.abort();});
const load=()=>page.goto(pathToFileURL(path.join(base,'M3策略管理中心交互原型.html')).href);
const action=key=>page.locator(`[data-action="${key}"]`).first().click();
const workspace=key=>page.locator(`[data-view="${key}"]`).click();
const snap=async(name,modal=false)=>{
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:path.join(shots,name+'.png'),fullPage:!modal,animations:'disabled'});captures.push(name+'.png');
};
const fit=async(name,width)=>{
 const dimensions=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
 viewports.push({name,width,...dimensions});assert.ok(dimensions.content<=dimensions.viewport,`${width}px ${name} overflow`);
};
try{
 await load();await snap('desktop');
 await page.locator('[data-action=open][data-id="STR-L2-01"]').click();
 for(const key of ['basic','dependencies','history']){await page.locator(`[data-detail="${key}"]`).click();await snap('strategy-'+key);}
 await workspace('ai');
 for(const key of ['definition','prompt','schema','constraints','usage']){await page.locator(`[data-task-tab="${key}"]`).click();await snap('ai-'+key);}
 await action('edit-task');await snap('ai-revision-dialog',true);await action('close-modal');
 await workspace('evaluation');
 for(const key of ['compare','datasets','metrics','history']){await page.locator(`[data-eval-tab="${key}"]`).click();await snap('evaluation-'+key);}
 await action('new-eval');await snap('evaluation-request-dialog',true);await action('close-modal');
 await workspace('catalog');await action('new');await snap('strategy-new-dialog',true);await action('close-modal');
 await action('panorama');await snap('system-flow');
 await workspace('catalog');await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await page.locator('[data-node=A1]').click();await snap('scenario-flow');
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1050});await load();await fit('catalog',width);
  await action('panorama');await fit('system-flow',width);
  await workspace('catalog');await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await fit('scenario-flow',width);
  await workspace('ai');await fit('ai',width);
  await workspace('evaluation');await fit('evaluation',width);
 }
 await page.setViewportSize({width:390,height:844});await load();await snap('mobile');
 await workspace('ai');await snap('mobile-ai');
 await workspace('catalog');await action('panorama');await snap('mobile-system-flow');
 await workspace('catalog');await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await page.locator('[data-node=A1]').click();await snap('mobile-scenario-flow');
 assert.equal(errors.length,0);assert.equal(network.length,0);
 const result={date:'2026-10-15',viewports,captures,errors,network,scope:'M3视觉与响应式检查，业务行为另由原91项交互检查覆盖'};
 await writeFile(path.join(dir,'UI视觉验证结果.json'),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify({viewportChecks:viewports.length,captures:captures.length,errors,network}));
}finally{await browser.close();}
