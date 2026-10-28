import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-layout-')),output=resolve('.riskhot/m1-layout');await mkdir(output,{recursive:true});
let browser:any;
const measurements:any[]=[],errors:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true});
 const page=await browser.newPage();page.on('pageerror',(error:Error)=>errors.push(error.message));
 for(const [width,height] of [[1920,1080],[2560,1440],[1440,1000],[390,1000],[320,1000]]){
  await page.setViewportSize({width,height});
  const bounds:Record<string,{x:number;width:number}>={};
  for(const [mode,hash,selector]of [['archive','#sources','.collection'],['automatic','#sources?mode=automatic','.plan-workspace']] as const){
   await page.goto(process.env.API_ORIGIN!+'/m1'+hash);
   await page.locator('#connection-state').filter({hasText:'已连接'}).waitFor({state:'attached'});
   await page.locator(selector).waitFor();
   const rect=await page.locator(selector).boundingBox(),toolbar=await page.locator('.catalog-toolbar').boundingBox();
   assert.ok(rect&&toolbar);bounds[mode]={x:rect.x,width:rect.width};
   assert.ok(Math.abs(rect.x-toolbar.x)<=1,`${mode} left edge differs at ${width}: ${rect.x} vs ${toolbar.x}`);
   assert.ok(Math.abs(rect.width-toolbar.width)<=1,`${mode} width differs at ${width}: ${rect.width} vs ${toolbar.width}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${mode} overflow at ${width}`);
   await page.screenshot({path:join(output,`${mode}-${width}.png`)});
  }
  const archive=bounds.archive,automatic=bounds.automatic;assert.ok(archive&&automatic);
  assert.ok(Math.abs(archive.x-automatic.x)<=1,`mode left edges differ at ${width}`);
  assert.ok(Math.abs(archive.width-automatic.width)<=1,`mode widths differ at ${width}`);
  measurements.push({viewport:{width,height},...bounds});
 }
 assert.deepEqual(errors,[]);await writeFile(join(output,'result.json'),JSON.stringify({measurements,errors},null,2));console.log(JSON.stringify({measurements,errors}));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
