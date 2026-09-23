import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderNasdaqGridStrategy } from '../src/app.mjs';

test('build tolerates absent Nasdaq snapshots but rejects corrupt data', async t => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dashboard-missing-data-'));
  t.after(async () => {
    assert.ok(resolve(temporaryRoot).startsWith(resolve(tmpdir()) + sep));
    await rm(temporaryRoot, { recursive: true, force: true });
  });
  const dashboard = join(temporaryRoot, 'tools', 'a-share-market-dashboard');
  const data = join(dashboard, 'data', '市场总览');
  const statistics = join(temporaryRoot, 'sources', 'assets', '2026-09-11-index-day-distribution');
  await mkdir(data, { recursive: true });
  const events = [{ date: '2026-09-23', type: '复核', title: '测试事件' }];
  await writeFile(join(data, 'event-calendar.json'), JSON.stringify(events));
  await mkdir(statistics, { recursive: true });
  for (const industry of ['战略资源', '新兴产业', '支柱产业']) {
    await mkdir(join(temporaryRoot, 'sources', 'automations', industry), { recursive: true });
  }
  await cp(new URL('../src/', import.meta.url), join(dashboard, 'src'), { recursive: true });
  await cp(new URL('../scripts/', import.meta.url), join(dashboard, 'scripts'), { recursive: true });
  const csv = await readFile(new URL('../../../sources/assets/2026-09-11-index-day-distribution/yearly.csv', import.meta.url), 'utf8');
  await writeFile(join(statistics, 'yearly.csv'), csv);
  const build = () => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dashboard, encoding: 'utf8' });

  const missing = build();
  assert.equal(missing.status, 0, missing.stderr);
  assert.match(missing.stderr, /nasdaq-etf-anchor\.json/);
  assert.match(missing.stderr, /nasdaq-day-statistics\.csv/);
  let html = await readFile(join(dashboard, 'a-share-market-dashboard.html'), 'utf8');
  assert.match(html, /纳斯达克100（NDX）.*逐年涨跌震荡天数/);
  assert.match(html, /年度统计数据缺失，待验证/);
  const runtime = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(runtime));
  assert.deepEqual(new Function(`${runtime}\nreturn EVENT_CALENDAR;`)(), events);
  const anchor = new Function(`${runtime}\nreturn NASDAQ_ETF_ANCHOR;`)();
  const grid = renderNasdaqGridStrategy({ status: 'missing', data: anchor }, 10000);
  assert.match(grid.rowsHtml, /待验证/);
  assert.doesNotMatch(grid.rowsHtml, /is-triggered|is-next/);

  await writeFile(join(data, 'nasdaq-etf-anchor.json'), JSON.stringify({ highPrice: 3, highDate: '2026-01-01' }));
  await writeFile(join(data, 'nasdaq-day-statistics.csv'), csv);
  const present = build();
  assert.equal(present.status, 0, present.stderr);
  html = await readFile(join(dashboard, 'a-share-market-dashboard.html'), 'utf8');
  assert.match(html, /"highPrice":3/);
  assert.match(html, /年均 102.8 天/);
  assert.doesNotMatch(html, /年度统计数据缺失，待验证/);

  await writeFile(join(data, 'nasdaq-etf-anchor.json'), '{broken');
  assert.notEqual(build().status, 0, 'malformed JSON must not be treated as a missing snapshot');
  await writeFile(join(data, 'nasdaq-etf-anchor.json'), '{}');
  await writeFile(join(data, 'nasdaq-day-statistics.csv'), 'broken');
  assert.notEqual(build().status, 0, 'malformed CSV must not be treated as a missing snapshot');
});
