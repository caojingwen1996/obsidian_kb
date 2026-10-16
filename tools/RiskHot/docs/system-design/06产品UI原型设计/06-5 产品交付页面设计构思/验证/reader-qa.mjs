import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(folder, 'RiskHot_产品层交互原型.html')).href;

// 浏览器输入完成阅读路径；evaluate 仅用于读取布局与环境，不替代用户动作。
export async function runQA(browser) {
  const checks = [], errors = [], requests = [];
  const desktop = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const mobile = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page = await desktop.newPage(), phone = await mobile.newPage();
  for (const p of [page,phone]) {
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => {if (/^https?:/.test(r.url())) requests.push(r.url());});
  }
  const test = async (name, action) => {
    try {await action(); checks.push({name,pass:true});}
    catch (e) {checks.push({name,pass:false,error:e.message});}
  };
  const settle = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const shot = async (p,name,fullPage=false) => {
    if(fullPage) await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
    await settle(p);
    await p.screenshot({path:path.join(folder,name),fullPage,scale:'css'});
  };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '页面存在横向溢出');
  const openDetails = async (p,text) => {const s=p.locator('summary').filter({hasText:text});await s.click(); await settle(page); await settle(phone);assert.equal(await s.evaluate(el=>el.parentElement.open),true);};
  const nav = p => p.getByRole('navigation',{name:'主导航'});
  await page.goto(target);
  await test('一级导航仅有风险速览与观察报告', async () => assert.equal((await nav(page).getByRole('link').allTextContents()).join('|'),'风险速览|观察报告'));
  await test('首屏直接交付重要风险及其解释', async () => {
    assert.equal(await page.locator('h1').innerText(),'风险速览');
    const r=await page.locator('.lead-story').boundingBox();
    assert.ok(r.y >= 0 && r.y+r.height <= 1000);
    assert.ok(await page.getByRole('link',{name:'读懂这项风险'}).isVisible());
  });
  await test('首页无收藏、配置、订阅或输入任务', async () => {
    assert.doesNotMatch(await page.locator('body').innerText(),/我的关注|加入关注|收藏|订阅|设置偏好|配置中心/);
    assert.equal(await page.locator('input,select,form').count(),0);
  });
  await test('首页保留高位稳定、首次待判断与待评估', async () => {
    const text=await page.locator('main').innerText();
    assert.match(text,/当前程度仍为高/); assert.match(text,/首次观察缺少可比历史/); assert.match(text,/尚未完成首轮评估/);
  });
  await test('桌面首页无横向溢出',()=>noOverflow(page));
  await shot(page,'RiskHot_首页首屏.png');
  await shot(page,'RiskHot_首页预览.png',true);

  await page.getByRole('link',{name:'读懂这项风险',exact:true}).click(); await settle(page); await settle(phone);
  await settle(page);
  await test('风险解读为六段连续阅读内容',async()=> {
    assert.match(await page.locator('h1').innerText(),/美元融资压力/);
    for(const id of ['now','change','why','impact','watch','basis']) assert.equal(await page.locator('#'+id).count(),1);
    assert.equal(await page.getByRole('tab').count(),0);
  });
  await test('风险程度与历史方向独立呈现',async()=>{
    const text=await page.locator('.article-meta').innerText();assert.match(text,/压力增加/);assert.match(text,/当前程度：高/);
  });
  await shot(page,'RiskHot_风险详情首屏.png');
  await test('专业术语可按需展开与收起',async()=>{
    await page.getByText('融资溢价是什么？',{exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.inline-term').innerText(),/0.01/);
    assert.equal(await page.locator('.inline-term').evaluate(el=>el.open),true);
    await page.getByText('融资溢价是什么？',{exact:true}).click(); await settle(page); await settle(phone);
    assert.equal(await page.locator('.inline-term').evaluate(el=>el.open),false);
  });
  await test('本轮证据按截止展示并保留反向信号和缺口',async()=>{
    await openDetails(page,'查看本轮依据与数据');
    const text=await page.locator('.evidence').first().innerText();
    assert.match(text,/31/);assert.match(text,/还有哪些不同信号/);assert.match(text,/目前还缺什么/);assert.match(text,/虚构/);
  });
  await test('历史判断可展开',()=>openDetails(page,'回看判断如何变化'));
  await test('风险引用信息可展开',()=>openDetails(page,'查看来源与时间信息'));
  await shot(page,'RiskHot_风险详情预览.png',true);
  await page.locator('#basis').scrollIntoViewIfNeeded();
  await shot(page,'RiskHot_依据展开预览.png');
  await test('阅读目录跳转不改变页面路由',async()=>{
    const before=page.url();await page.locator('.reader-aside').getByRole('link',{name:'当前影响到哪里',exact:true}).click(); await settle(page); await settle(phone);
    assert.equal(page.url(),before);
  });
  await page.getByRole('link',{name:'返回风险速览',exact:true}).first().click(); await settle(page); await settle(phone);
  await test('高位稳定风险可正常阅读',async()=>{
    await page.getByRole('link',{name:'理解持续的压力',exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('h1').innerText(),/没有新变化也需留意/);
    await openDetails(page,'查看本轮依据与数据');
    const text=await page.locator('.data-table-wrap').first().innerText();
    assert.doesNotMatch(text,/03\.14|4\.48|\b31\b/);
  });
  await page.getByRole('link',{name:'返回风险速览',exact:true}).first().click(); await settle(page); await settle(phone);
  await test('首次观察不伪装为稳定',async()=>{
    await page.getByRole('link',{name:'看看还缺哪些依据',exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.article-meta').innerText(),/暂难判断/);
    assert.match(await page.locator('#change').innerText(),/没有可比历史/);
  });
  await page.getByRole('link',{name:'返回风险速览',exact:true}).first().click(); await settle(page); await settle(phone);
  await test('无评估对象不显示虚构等级和影响',async()=>{
    await page.getByRole('link',{name:'了解评估进度',exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('main').innerText(),/没有可以展示的严重程度/);
    assert.equal(await page.locator('.data-table').count(),0);
  });
  await shot(page,'RiskHot_待评估预览.png');

  await nav(page).getByRole('link',{name:'观察报告',exact:true}).click(); await settle(page); await settle(phone);
  await test('报告默认直接呈现周观察',async()=>{
    assert.match(await page.locator('.report-paper').innerText(),/2025\.03\.08 — 03\.14/);
    assert.equal(await page.getByRole('navigation',{name:'报告周期'}).getByRole('link').count(),3);
  });
  await shot(page,'RiskHot_观察报告首屏.png');
  await shot(page,'RiskHot_观察报告预览.png',true);
  await test('报告链接打开固定当期解读并能返回',async()=>{
    await page.getByRole('link',{name:'阅读当期解读',exact:true}).first().click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.history-banner').first().innerText(),/按报告时点阅读/);
    await page.getByRole('link',{name:'返回周观察',exact:true}).first().click(); await settle(page); await settle(phone);
    assert.match(page.url(),/#reports\/week$/);
  });
  await test('日观察有独立周期与内容',async()=>{
    await page.getByRole('navigation',{name:'报告周期'}).getByRole('link',{name:'日观察',exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.report-paper').innerText(),/日观察 · 2025\.03\.14/);
    assert.match(await page.locator('.report-paper').innerText(),/跨境资金有新信号/);
  });
  await test('月观察使用完整历史月份',async()=>{
    await page.getByRole('navigation',{name:'报告周期'}).getByRole('link',{name:'月观察',exact:true}).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.report-metadata').innerText(),/2025\.02\.01 — 02\.28/);
    assert.doesNotMatch(await page.locator('.report-paper').innerText(),/2025\.03\.14/);
  });
  await shot(page,'RiskHot_历史月报预览.png');
  await test('历史月报解读不混入三月观测',async()=>{
    await page.getByRole('link',{name:'阅读当期解读',exact:true}).first().click(); await settle(page); await settle(phone);
    assert.match(await page.locator('.history-banner').first().innerText(),/2025\.02\.25/);
    await openDetails(page,'查看本轮依据与数据');
    assert.equal(await page.locator('.data-table').count(),0);
    assert.doesNotMatch(await page.locator('main').innerText(),/2025\.03/);
    assert.match(await page.locator('main').innerText(),/已暂停观察/);
  });
  await shot(page,'RiskHot_报告当期解读预览.png',true);
  await test('已结束对象的历史适用范围明确',async()=>{
    await page.getByRole('link',{name:'返回月观察',exact:true}).first().click(); await settle(page); await settle(phone);
    await page.getByRole('link',{name:'阅读当期解读',exact:true}).nth(1).click(); await settle(page); await settle(phone);
    assert.match(await page.locator('main').innerText(),/已结束观察/);
    assert.match(await page.locator('main').innerText(),/2 月 12 日/);
  });
  await test('未知链接显示可恢复的阅读入口',async()=>{
    await page.goto(target+'#risk/unknown');
    assert.match(await page.locator('h1').innerText(),/暂时找不到/);
    await page.getByRole('link',{name:'返回风险速览',exact:true}).click(); await settle(page); await settle(phone);
    assert.equal(await page.locator('h1').innerText(),'风险速览');
  });
  await test('刷新与深链接可直达报告',async()=>{
    await nav(page).getByRole('link',{name:'观察报告',exact:true}).click(); await settle(page); await settle(phone);await page.reload();
    assert.match(await page.locator('h1').innerText(),/观察报告/);
  });
  await test('浏览器返回保持阅读上下文',async()=>{
    await page.getByRole('link',{name:'阅读当期解读',exact:true}).first().click(); await settle(page); await settle(phone);await page.goBack();
    assert.match(page.url(),/#reports\/week$/);assert.match(await page.locator('h1').innerText(),/观察报告/);
  });
  await test('返回首页恢复原来的阅读位置',async()=>{
    await nav(page).getByRole('link',{name:'风险速览',exact:true}).click(); await settle(page); await settle(phone);
    await page.getByRole('link',{name:'看看还缺哪些依据',exact:true}).scrollIntoViewIfNeeded();
    await settle(page);const before=await page.evaluate(()=>scrollY);
    await page.getByRole('link',{name:'看看还缺哪些依据',exact:true}).click(); await settle(page); await settle(phone);
    await page.getByRole('link',{name:'返回风险速览',exact:true}).first().click(); await settle(page); await settle(phone);await settle(page);
    assert.ok(Math.abs((await page.evaluate(()=>scrollY))-before)<5);
  });
  await phone.goto(target);
  await test('手机两入口无需菜单或配置即可使用',async()=>{
    assert.equal((await nav(phone).getByRole('link').allTextContents()).join('|'),'风险速览|观察报告');
    assert.ok(await nav(phone).isVisible());
  });
  await test('手机390px首页无横向溢出',()=>noOverflow(phone));
  await shot(phone,'RiskHot_移动端首屏.png');
  await shot(phone,'RiskHot_移动端预览.png',true);
  await test('手机风险解读与证据展开可用',async()=>{
    await phone.getByRole('link',{name:'读懂这项风险',exact:true}).tap(); await settle(page); await settle(phone);
    await openDetails(phone,'查看本轮依据与数据');await noOverflow(phone);
    assert.match(await phone.locator('.evidence').first().innerText(),/目前还缺什么/);
  });
  await phone.getByRole('link',{name:'返回风险速览',exact:true}).first().tap(); await settle(page); await settle(phone);
  await phone.getByRole('link',{name:'读懂这项风险',exact:true}).tap(); await settle(page); await settle(phone);
  await shot(phone,'RiskHot_移动端解读.png');
  await test('手机报告周期切换与当期返回可用',async()=>{
    await nav(phone).getByRole('link',{name:'观察报告',exact:true}).tap(); await settle(page); await settle(phone);
    await phone.getByRole('navigation',{name:'报告周期'}).getByRole('link',{name:'月观察',exact:true}).tap(); await settle(page); await settle(phone);
    await phone.getByRole('link',{name:'阅读当期解读',exact:true}).first().tap(); await settle(page); await settle(phone);
    await phone.getByRole('link',{name:'返回月观察',exact:true}).first().tap(); await settle(page); await settle(phone);
    assert.match(phone.url(),/#reports\/month$/);await noOverflow(phone);
  });
  await phone.getByRole('navigation',{name:'报告周期'}).getByRole('link',{name:'周观察',exact:true}).tap(); await settle(page); await settle(phone);
  await shot(phone,'RiskHot_移动端报告.png');
  await test('320px最小宽度的速览、详情和报告无横向溢出',async()=>{
    await phone.setViewportSize({width:320,height:740});
    await nav(phone).getByRole('link',{name:'风险速览',exact:true}).click(); await settle(page); await settle(phone);await noOverflow(phone);
    await phone.getByRole('link',{name:'读懂这项风险',exact:true}).click(); await settle(page); await settle(phone);await noOverflow(phone);
    await nav(phone).getByRole('link',{name:'观察报告',exact:true}).click(); await settle(page); await settle(phone);await noOverflow(phone);
  });
  await test('键盘可进入正文与展开证据',async()=>{
    await page.goto(target+'#risk/r1');
    const summary=page.locator('summary').filter({hasText:'查看本轮依据与数据'});
    await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
    await page.keyboard.press('Enter');assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
    await page.goto(target);await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(el=>el===document.activeElement),true);
  });
  await test('减少动效偏好得到尊重',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  });
  await test('原型无浏览器脚本错误',async()=>assert.deepEqual(errors,[]));
  await test('独立HTML无外网资源请求',async()=>assert.deepEqual(requests,[]));
  await test('无个人状态存储和网络调用实现',async()=>{
    const source=await readFile(path.join(folder,'原型资源/reader.js'),'utf8');
    assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket/);
  });
  const result={date:'2026-10-16',scope:'独立静态原型；不包含后台、真实模型与市场结论验证',viewports:['1440×1000','390×844','320×740'],checks,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,errors,externalRequests:requests};
  await writeFile(path.join(folder,'验证/reader-qa-results.json'),JSON.stringify(result,null,2)+'\n','utf8');
  await desktop.close();await mobile.close();
  return result;
}

if (typeof process !== 'undefined' && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const result=await runQA(browser);
    console.log(JSON.stringify({passed:result.passed,failed:result.failed,failures:result.checks.filter(x=>!x.pass)},null,2));
    if(result.failed) process.exitCode=1;
  } finally {await browser.close();}
}
