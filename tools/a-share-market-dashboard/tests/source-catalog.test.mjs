import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceCatalogRows, filterSourceCatalog, renderSourceCatalog, sourceCatalogGroups} from '../src/source-catalog.mjs';
import {liquiditySourceCatalog} from '../src/liquidity-dashboard.mjs';

test('inventory covers every funding source and keeps pending sources explicitly unconnected', () => {
  const rows = sourceCatalogRows();
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const row of rows) {
    assert.ok(sourceCatalogGroups.some(([id]) => id === row.group));
    for (const field of ['name', 'source', 'mode', 'note']) assert.ok(row[field], `${row.id}.${field}`);
  }
  assert.deepEqual(rows.filter(row => row.group === 'liquidity').map(row => row.source), liquiditySourceCatalog.map(row => row[2]));
  const pending = rows.filter(row => row.group === 'pending');
  assert.equal(pending.length, 32);
  assert.equal(pending.filter(row => row.mode !== '待接入').length, 3);
  assert.ok(pending.filter(row => row.mode === '待接入').every(row => row.mode === '待接入' && row.source.startsWith('拟接入：') && row.note.includes('虚构')));
});

test('search distinguishes same indicator across providers and combines column filtering', () => {
  assert.deepEqual(filterSourceCatalog('美元 TUSHARE').map(row => row.id), ['dollar', 'usdjpy']);
  assert.ok(filterSourceCatalog('美元 Yahoo', 'liquidity').some(row => row.id === 'liquidity-usd'));
  assert.equal(filterSourceCatalog('不存在的指标').length, 0);
  assert.equal(filterSourceCatalog('ETF', 'pending').length, 1);
});

test('ETF uses a share-change estimate while Wind stays disabled; RRP remains unscored', () => {
  const etf = filterSourceCatalog('ETF', 'liquidity')[0];
  assert.match(etf.note, /09:00/);
  assert.match(etf.note, /停用/);
  assert.match(etf.mode, /Python估算/);
  assert.match(etf.source, /份额变化/);
  assert.ok(sourceCatalogRows().every(row => !row.source.startsWith('Wind')));
  assert.match(filterSourceCatalog('RRP', 'liquidity')[0].note, /留空，不计分/);
  assert.match(filterSourceCatalog('有知有行')[0].note, /不以本地/);
});

test('pending groups collapse by default, open on filtered search, and preserve accessible table labels', () => {
  assert.match(renderSourceCatalog(), /<details class="source-catalog-group"><summary>风险大屏指标/);
  assert.match(renderSourceCatalog('GDP'), /<details class="source-catalog-group" open>/);
  assert.match(renderSourceCatalog('GDP'), /scope="row"/);
  assert.match(renderSourceCatalog('GDP'), /data-label="数据来源"/);
  assert.match(renderSourceCatalog('<script>'), /没有匹配项/);
});

test('catalog is a thermometer navigation destination in source and built artifact', () => {
  for (const name of ['src/index.html', 'a-share-market-dashboard.html']) {
    const html = readFileSync(new URL('../' + name, import.meta.url), 'utf8');
    const menu = html.split('id="tree-thermometer"')[1].split('</div>')[0];
    assert.match(menu, /data-view="source-catalog-view"/);
    assert.match(html, /id="source-catalog-view" data-shell-content="thermometer"/);
    assert.match(html, /id="source-catalog-search"/);
  }
});
