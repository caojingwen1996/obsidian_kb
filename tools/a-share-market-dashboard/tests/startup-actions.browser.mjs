import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Use Playwright's bundled Chromium or an explicitly supplied isolated testing browser.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
try {
  const [template, styles, source] = await Promise.all(['src/index.html', 'src/styles.css', 'src/startup-checks.mjs'].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  const errors = [];
  const createPage = async (reducedMotion = 'no-preference') => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(template.replace('<!-- DASHBOARD_STYLES -->', `<style>${styles}</style>`));
    await page.addScriptTag({ content: `${source.replace(/export /g, '')};globalThis.gate=createStartupScreen();` });
    return page;
  };
  const page = await createPage();
  await page.evaluate(() => {
    globalThis.pending = gate.run([{ id: 'check', label: '成交额数据', run: () => new Promise(resolve => { globalThis.finish = resolve; }) }]);
  });
  await page.waitForFunction(() => globalThis.finish);
  assert.equal(await page.locator('#startup-screen').evaluate(node => node.classList.contains('is-complete')), false);
  assert.equal(await page.locator('#startup-retry').isVisible(), false);
  assert.equal(await page.locator('#startup-enter').isDisabled(), true);
  await page.evaluate(() => gate.enter());
  assert.equal(await page.locator('#dashboard-shell').isVisible(), false, 'entry cannot bypass pending checks');
  const originalWidth = await page.locator('#startup-enter').evaluate(node => node.getBoundingClientRect().width);
  await page.evaluate(async () => { finish({ status: 'warning', detail: '7 / 12 项最新数据；5 项未取得最新数据\n美元指数：读取失败；/api/us-dollar-index\n本地服务未读取到 Tushare Token\n预测市盈率：未配置数据源，未发起接口请求。' }); await pending; });
  await page.waitForTimeout(400);
  const buttons = await page.locator('.startup-actions button').evaluateAll(nodes => nodes.map(node => ({
    width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
    glow: getComputedStyle(node, '::after').animationName, cycles: getComputedStyle(node, '::after').animationIterationCount,
  })));
  assert.equal(await page.locator('#startup-retry').isVisible(), true);
  assert.ok(buttons[1].width > originalWidth);
  assert.equal(await page.locator('#startup-enter').isEnabled(), true);
  assert.equal(await page.locator('#startup-enter').innerText(), '查看已取得的数据');
  assert.match(await page.locator('#startup-summary').innerText(), /组检查存在异常/);
  assert.ok(Math.abs(buttons[0].width - buttons[1].width) < 1);
  assert.ok(buttons.every(button => button.height >= 52 && button.glow === 'startup-action-glow' && button.cycles === '3'), JSON.stringify(buttons));
  await page.screenshot({ path: '/tmp/dashboard-startup-actions-desktop.png' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('#startup-screen').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    const widths = await page.locator('.startup-actions button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    assert.ok(widths.every(value => value > 100));
    assert.ok(Math.abs(widths[0] - widths[1]) < 1);
    if (width === 390) await page.screenshot({ path: '/tmp/dashboard-startup-actions-mobile.png' });
  }
  await page.locator('#startup-enter').focus();
  await page.keyboard.press('Enter');
  await page.locator('#startup-screen').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#dashboard-shell').isVisible(), true);

  const success = await createPage();
  await success.evaluate(() => gate.run([{ id: 'ok', label: '数据检查', run: () => ({ status: 'passed', detail: '读取完成' }) }]));
  assert.equal(await success.locator('#startup-retry').isVisible(), true);
  assert.match(await success.locator('#startup-summary').innerText(), /3 秒后/);
  await success.waitForTimeout(1000);
  assert.equal(await success.locator('#startup-screen').isVisible(), true, 'completion feedback must remain visible before auto-entry');
  await success.locator('#startup-screen').waitFor({ state: 'hidden', timeout: 4000 });

  for (const interaction of ['hover', 'focus']) {
    const held = await createPage(interaction === 'focus' ? 'reduce' : 'no-preference');
    await held.evaluate(() => gate.run([{ id: 'ok', label: '数据检查', run: () => ({ status: 'passed', detail: '读取完成' }) }]));
    if (interaction === 'hover') await held.locator('#startup-enter').hover();
    else {
      assert.equal(await held.locator('#startup-screen').evaluate(node => node.getAnimations({ subtree: true }).length), 0);
      await held.locator('#startup-retry').focus();
    }
    await held.waitForTimeout(3200);
    assert.equal(await held.locator('#startup-screen').isVisible(), true, `${interaction} must cancel automatic entry`);
    assert.match(await held.locator('#startup-summary').innerText(), /请选择/);
    await held.locator('#startup-enter').click();
    await held.locator('#startup-screen').waitFor({ state: 'hidden' });
  }
  assert.deepEqual(errors, []);
  console.log('Startup action browser checks passed: completion-only expansion, equal widths, glow, mobile, keyboard entry, delayed automatic entry, interaction cancellation, reduced motion, no script errors.');
} finally {
  await browser.close();
}
