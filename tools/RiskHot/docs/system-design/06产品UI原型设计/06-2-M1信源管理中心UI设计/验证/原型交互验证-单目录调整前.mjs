import { chromium, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const directory=dirname(fileURLToPath(import.meta.url));
const url=pathToFileURL(resolve(directory,'../M1信源管理中心交互原型.html')).href;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'});
page.setDefaultTimeout(8000);
const errors=[],external=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
async function fresh(){await page.setViewportSize({width:1440,height:1000});await page.goto(url);}
async function check(name,fn){try{await fresh();await fn();results.push({name,result:'通过'});console.log('通过 '+name);}catch(e){results.push({name,result:'失败',detail:e.message});console.log('失败 '+name);}}
async function settings(){if(!await page.locator('#preview-controls').isVisible())await page.locator('#preview-toggle').click();}
async function role(value){await settings();await page.locator('#role').selectOption(value);}
async function pane(value){await page.locator(`[data-pane=${value}]`).click();}
async function search(value){await page.locator('#search').fill(value);await page.locator('#search-form button[type=submit]').click();}
async function selectName(value){await search(value);await page.locator('.source-row').first().click();}
async function fillNew(code='DEMO_MANUAL_NEW'){
 const f=page.locator('#editor');
 for(const [key,value] of Object.entries({name:'人工来源演示',code,publisher:'演示手工发布主体',locator:'DEMO-ARCHIVE-009',scope:'宏观原始资料核验',basis:'可核验演示材料，发布主体与范围已核对',basisRef:'DEMO-EVIDENCE-009',reason:'新增可核验的手工资料来源'}))await f.locator(`#field-${key}`).fill(value);
 await f.locator('#field-category').selectOption('官方发布（演示）');await f.locator('#field-channel').selectOption('人工材料（演示）');await f.locator('#field-material').selectOption('人工材料（演示）');await f.locator('#field-mode').selectOption('manual');await f.locator('#field-tier').selectOption('T1');
}
async function status(target,reason='核对演示资料，执行启停操作'){await page.locator(`#detail [data-action=status][data-target=${target}]`).click();await page.locator('#operation-reason').fill(reason);await page.locator('#operation-confirm').click();}
await check('M1-UI-01 入口、40条参考清单与六段详情',async()=>{
 await expect(page.locator('#result-count')).toContainText('40 个');await selectName('国家统计局');await expect(page.locator('#detail section')).toHaveCount(6);await expect(page.locator('#detail')).toContainText('分类为演示建议');await page.screenshot({path:resolve(directory,'参考清单-桌面.png'),fullPage:true});
});
await check('M1-UI-02 发布主体、映射编码搜索与无结果恢复',async()=>{
 await search('DEMO_NBS_MACRO');await expect(page.locator('.source-row')).toHaveCount(1);await search('没有这个来源');await expect(page.locator('#list')).toContainText('暂无符合条件');await page.locator('#clear').click();await expect(page.locator('#result-count')).toContainText('40 个');
});
await check('M1-UI-03 多维任一/交集筛选与条件移除',async()=>{
 await page.locator('#filters details').nth(1).locator('summary').click();await page.locator('[data-filter=dims][value=FLOW]').check();await expect(page.locator('#result-count')).toContainText('3 个');await page.locator('#filters details').nth(2).locator('summary').click();await page.locator('[data-filter=levels][value=MACRO]').check();await expect(page.locator('#result-count')).toContainText('2 个');await page.locator('#filters details').nth(2).locator('[data-action=close-filter]').click();await page.locator('[data-remove-filter=levels]').click();await expect(page.locator('#result-count')).toContainText('3 个');
});
await check('M1-UI-04 三视图、专题选择、重复分组去重',async()=>{
 await page.locator('[data-view=monitor]').click();await expect(page.locator('#view-rule')).toContainText('关注优先级');await page.locator('[data-view=research]').click();await expect(page.locator('#list')).toContainText('先选择金融属性');await page.locator('[data-action=choose-theme]').click();await page.locator('[data-filter=dims][value=QUANTITY]').check();await page.locator('[data-filter=dims][value=PRICE]').check();await expect(page.locator('#result-count')).toContainText('6 个');await page.locator('[data-action=close-filter]:visible').click();await expect(page.locator('[data-group="dims:QUANTITY"]')).toBeVisible();await expect(page.locator('[data-group="dims:PRICE"]')).toBeVisible();
});
await check('M1-UI-05 全部收起展开与FRED回源',async()=>{
 await page.locator('[data-action=collapse-all]').click();await expect(page.locator('.source-row:visible')).toHaveCount(0);await page.locator('[data-action=expand-all]').click();await expect(page.locator('.source-row:visible')).not.toHaveCount(0);await search('FRED');await page.locator('[data-select=wiki-source-040]').click();await expect(page.locator('#detail')).toContainText('平台不统一认定为 T1');await page.locator('[data-action=register]').click();await expect(page.locator('#field-tier')).toHaveValue('');
});
await check('M1-UI-06 正式双状态、技术刷新与跨模块说明',async()=>{
 await pane('registered');await selectName('国家统计局');await expect(page.locator('[data-availability]')).toContainText('业务已启用，自动接入尚未就绪');await page.locator('[data-tab=tech]').click();await page.locator('[data-action=refresh-tech]').click();await expect(page.locator('#tech-feedback')).toContainText('未执行真实连接检测');await page.locator('[data-target="L0 检测记录"]').click();await expect(page.locator('#toast')).toContainText('未接入');
});
await check('M1-UI-07 手工登记、默认停用与直接启用',async()=>{
 await pane('registered');await page.locator('#create').click();await fillNew();await page.locator('#save').click();await expect(page.locator('#editor')).not.toBeVisible();await expect(page.locator('#detail')).toContainText('人工来源演示');await expect(page.locator('#detail .status-card').first()).toContainText('停用');await status('ACTIVE');await expect(page.locator('#detail .status-card').first()).toContainText('启用');await expect(page.locator('[data-availability]')).toContainText('可按授权范围人工录入');
});
await check('M1-UI-08 缺项保留与启用门槛',async()=>{
 await pane('registered');await page.locator('#create').click();await page.locator('#save').click();await expect(page.locator('#field-name')).toHaveAttribute('aria-invalid','true');await fillNew('DEMO_MISSING');await page.locator('#field-tier').selectOption('');await page.locator('#field-basis').fill('');await page.locator('#save').click();await page.locator('[data-action=status][data-target=ACTIVE]').click();await page.locator('#operation-reason').fill('核对');await page.locator('#operation-confirm').click();await expect(page.locator('#operation-error')).toContainText('未补齐');await expect(page.locator('#detail .status-card').first()).toContainText('停用');
});
await check('M1-UI-09 预填登记须人工确认',async()=>{
 await selectName('财政部政务微信');await page.locator('[data-action=register]').click();await expect(page.locator('#field-name')).toHaveValue('财政部政务微信');await page.locator('#field-code').fill('DEMO_MOF_SOCIAL');await page.locator('#field-locator').fill('DEMO-MOF-WECHAT-MATERIAL');await page.locator('#field-scope').fill('政策研究');await page.locator('#field-material').selectOption('公告／统计资料（演示）');await page.locator('#field-reason').fill('登记认证渠道');await page.locator('#save').click();await expect(page.locator('#form-error')).toContainText('请确认');await page.locator('#confirm-suggestions').check();await page.locator('#save').click();await expect(page.locator('#detail .status-card').first()).toContainText('停用');
});
await check('M1-UI-10 同代码冲突、查重对照与复用',async()=>{
 await pane('registered');await page.locator('#create').click();await fillNew('DEMO_NBS_MACRO');await page.locator('#save').click();await expect(page.locator('#duplicate')).toContainText('编码冲突');await expect(page.locator('#editor')).toBeVisible();await page.screenshot({path:resolve(directory,'登记查重-桌面.png'),fullPage:true});await page.locator('[data-action=reuse]').click();await page.locator('[data-action=confirm-reuse]').click();await expect(page.locator('#detail')).toContainText('国家统计局');await expect(page.locator('#result-count')).toContainText('4 个');
});
await check('M1-UI-11 相似主体不同渠道需说明后可登记',async()=>{
 await pane('registered');await page.locator('#create').click();await fillNew('DEMO_PBC_SOCIAL_NEW');await page.locator('#field-publisher').fill('中国人民银行');await page.locator('#field-channel').selectOption('认证账号（演示）');await page.locator('#save').click();await expect(page.locator('#form-error')).toContainText('不同渠道');await page.locator('#difference-reason').fill('与官网不同，登记官方认证账号材料');await page.locator('#save').click();await expect(page.locator('#editor')).not.toBeVisible();await expect(page.locator('#result-count')).toContainText('5 个');
});
await check('M1-UI-12 暂停、理由、恢复不补采与停用',async()=>{
 await pane('registered');await selectName('国家统计局');await page.locator('[data-target=PAUSED]').click();await page.locator('#operation-confirm').click();await expect(page.locator('#operation-error')).toContainText('理由');await page.locator('#operation-reason').fill('口径待核对，暂缓自动分析');await page.screenshot({path:resolve(directory,'暂停确认-桌面.png'),fullPage:true});await page.locator('#operation-confirm').click();await expect(page.locator('#detail .status-card').first()).toContainText('暂停');await page.locator('[data-target=ACTIVE]').click();await expect(page.locator('#operation-body')).toContainText('恢复不自动补采');await page.locator('#operation-reason').fill('复核资料已完整');await page.locator('#operation-confirm').click();await status('DISABLED');await expect(page.locator('#detail .status-card').first()).toContainText('停用');
});
await check('M1-UI-13 角色分别控制编辑与启停',async()=>{
 await role('researcher');await pane('registered');await selectName('国家统计局');await expect(page.locator('#create')).toBeHidden();await expect(page.locator('[data-action=edit]')).toHaveCount(0);await expect(page.locator('[data-action=status]')).toHaveCount(0);await role('admin');await expect(page.locator('[data-action=edit]')).toBeVisible();await expect(page.locator('[data-action=status]')).toHaveCount(0);await role('operator');await expect(page.locator('[data-action=edit]')).toHaveCount(0);await expect(page.locator('[data-target=PAUSED]')).toBeVisible();
});
await check('M1-UI-14 普通编辑留版本，历史保留旧值',async()=>{
 await pane('registered');await selectName('国家统计局');await page.locator('[data-action=edit]').click();await page.locator('#field-description').fill('修订后的内容说明');await page.locator('#field-reason').fill('补充展示说明，不改变身份范围');await page.locator('#save').click();await expect(page.locator('#detail .status-card').first()).toContainText('启用');await page.locator('[data-tab=history]').click();await expect(page.locator('#detail')).toContainText('v2 → v3');await page.locator('[data-action=view-history][data-side=before]').first().click();await expect(page.locator('#history-title')).toContainText('v2');await expect(page.locator('#history-body')).not.toContainText('修订后的内容说明');await page.locator('[data-action=close-history]').first().click();
});
await check('M1-UI-15 身份范围变更降级、定位变更技术复检',async()=>{
 await pane('registered');await selectName('中国货币网市场行情');await expect(page.locator('[data-availability]')).toContainText('具备自动接入条件');await page.locator('[data-action=edit]').click();await page.locator('#field-locator').fill('DEMO-NEW-LOCATION');await page.locator('#field-reason').fill('修订资料定位');await expect(page.locator('#edit-impact')).toContainText('待重新检测');await page.locator('#save').click();await expect(page.locator('#detail .status-card').first()).toContainText('启用');await expect(page.locator('#detail .status-card').nth(1)).toContainText('待重新检测');await page.locator('[data-action=edit]').click();await page.locator('#field-scope').fill('新的允许范围');await page.locator('#field-reason').fill('调整允许范围');await expect(page.locator('#edit-impact')).toContainText('退回停用');await page.locator('#save').click();await expect(page.locator('#detail .status-card').first()).toContainText('停用');
});
await check('M1-UI-16 使用关系、空引用与查询失败不混同',async()=>{
 await pane('registered');await selectName('国家统计局');await page.locator('[data-tab=relations]').click();await expect(page.locator('#detail')).toContainText('指标允许来源');await expect(page.locator('#detail')).toContainText('实际引用');await page.locator('[data-action=relation-error]').click();await expect(page.locator('#relation-feedback')).toContainText('暂不可查询');await page.locator('[data-action=refresh-relations]').click();await expect(page.locator('#relation-feedback')).toBeEmpty();await selectName('中国人民银行');await page.locator('[data-tab=relations]').click();await expect(page.locator('#detail')).toContainText('暂无引用');
});
await check('M1-UI-17 写入失败与版本冲突保留输入',async()=>{
 await settings();await page.locator('#write-mode').selectOption('error');await pane('registered');await selectName('国家统计局');await page.locator('[data-action=edit]').click();await page.locator('#field-description').fill('需要保留的修订内容');await page.locator('#field-reason').fill('补充');await page.locator('#save').click();await expect(page.locator('#form-error')).toContainText('保存失败');await expect(page.locator('#field-description')).toHaveValue('需要保留的修订内容');await page.locator('#write-mode').selectOption('conflict',{force:true});await page.locator('#save').click();await expect(page.locator('#form-error')).toContainText('版本冲突');await page.locator('[data-action=reload-version]').click();await page.locator('[data-action=accept-version]').click();await page.locator('#save').click();await expect(page.locator('#editor')).not.toBeVisible();
});
await check('M1-UI-18 保存结果未知查询确认且不重复创建',async()=>{
 await settings();await page.locator('#write-mode').selectOption('unknown');await pane('registered');await page.locator('#create').click();await fillNew('DEMO_UNKNOWN');await page.locator('#save').click();await expect(page.locator('#form-error')).toContainText('尚不能确认');await expect(page.locator('#save')).toBeDisabled();await expect(page.locator('#field-name')).toBeDisabled();await expect(page.locator('#check-duplicate')).toBeDisabled();await page.locator('[data-action=query-result]').click();await expect(page.locator('#editor')).not.toBeVisible();await expect(page.locator('#result-count')).toContainText('5 个');await expect(page.locator('#detail .status-card').first()).toContainText('停用');
});
await check('M1-UI-19 启停响应未知不假成功',async()=>{
 await settings();await page.locator('#write-mode').selectOption('unknown');await pane('registered');await selectName('国家统计局');await page.locator('[data-target=PAUSED]').click();await page.locator('#operation-reason').fill('演示未知响应');await page.locator('#operation-confirm').click();await expect(page.locator('#operation-title')).toContainText('暂未确认');await expect(page.locator('#operation-body')).toContainText('不要重复提交');await page.locator('#operation-confirm').click();await expect(page.locator('#operation')).not.toBeVisible();await expect(page.locator('#detail .status-card').first()).toContainText('暂停');
});
await check('M1-UI-20 读取异常、离线与无权限场景',async()=>{
 await settings();await page.locator('#scene').selectOption('error');await expect(page.locator('#list')).toContainText('暂时无法读取');await page.locator('[data-action=retry]').click();await page.locator('#scene').selectOption('loading');await expect(page.locator('#list')).toContainText('正在读取');await page.locator('#scene').selectOption('empty');await expect(page.locator('#list')).toContainText('暂无条目');await page.locator('#scene').selectOption('denied');await expect(page.locator('.source-row')).toHaveCount(0);await page.locator('#scene').selectOption('offline');await pane('registered');await selectName('国家统计局');await expect(page.locator('[data-target=PAUSED]')).toBeDisabled();
});
await check('M1-UI-21 未保存关闭、Esc与键盘页签',async()=>{
 await pane('registered');await selectName('国家统计局');await page.locator('[data-tab=archive]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-tab=tech]')).toHaveAttribute('aria-selected','true');await page.locator('[data-action=edit]').click();await page.locator('#field-description').fill('未保存');await page.keyboard.press('Escape');await expect(page.locator('#dirty-panel')).toBeVisible();await page.locator('[data-action=keep-editing]').click();await expect(page.locator('#field-description')).toHaveValue('未保存');await page.locator('[data-action=close-editor]').first().click();await page.locator('[data-action=discard-editing]').click();await expect(page.locator('#editor')).not.toBeVisible();
});
await check('M1-UI-22 用户输入安全展示与编码稳定',async()=>{
 await pane('registered');await page.locator('#create').click();await fillNew('DEMO_SAFE');await page.locator('#field-name').fill('<img src=x onerror=alert(1)>');await page.locator('#save').click();await expect(page.locator('#detail h2')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('#detail img')).toHaveCount(0);await page.locator('[data-action=edit]').click();await expect(page.locator('#field-code')).toHaveAttribute('readonly','');
});
await check('M1-UI-23 手机检索、详情、暂停和历史',async()=>{
 await page.setViewportSize({width:390,height:844});await pane('registered');await selectName('国家统计局');await expect(page.locator('#detail-modal')).toBeVisible();await expect(page.locator('[data-availability]')).toContainText('尚未就绪');await page.screenshot({path:resolve(directory,'正式信源-手机.png'),fullPage:false});await status('PAUSED');await expect(page.locator('#detail-modal')).toBeVisible();await expect(page.locator('#detail .status-card').first()).toContainText('暂停');await page.locator('[data-tab=history]').click();await page.locator('[data-action=view-history][data-side=before]').first().click();await expect(page.locator('#history')).toBeVisible();await page.locator('[data-action=close-history]').first().click();await expect(page.locator('#detail-modal')).toBeVisible();await page.locator('[data-action=close-detail]').click();await expect(page.locator('#detail-modal')).not.toBeVisible();const width=await page.evaluate(()=>({vw:innerWidth,doc:document.documentElement.scrollWidth}));expect(width.doc).toBeLessThanOrEqual(width.vw);await page.screenshot({path:resolve(directory,'正式列表-手机.png'),fullPage:true});
});
await check('M1-UI-24 手机登记与横向溢出',async()=>{
 await page.setViewportSize({width:390,height:844});await pane('registered');await page.locator('#create').click();await fillNew('DEMO_MOBILE');await page.locator('#save').click();await expect(page.locator('#editor')).not.toBeVisible();const width=await page.evaluate(()=>({vw:innerWidth,doc:document.documentElement.scrollWidth}));expect(width.doc).toBeLessThanOrEqual(width.vw);
});
await fresh();await pane('registered');await selectName('国家统计局');await page.screenshot({path:resolve(directory,'正式信源-桌面.png'),fullPage:true});
const report={date:'2026-10-13',browser:browser.version(),scope:'本地内存交互原型，未执行服务端/数据库/真实采集验收',passed:results.filter(x=>x.result==='通过').length,total:results.length,errors,externalRequests:external,results};
await writeFile(resolve(directory,'原型验证结果.json'),JSON.stringify(report,null,2)+'\n','utf8');await browser.close();console.log(JSON.stringify(report,null,2));if(report.passed!==report.total||errors.length||external.length)process.exitCode=1;
