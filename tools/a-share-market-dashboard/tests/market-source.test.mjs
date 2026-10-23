import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderMarketSourceDetails } from '../src/app.mjs';

test('market sources use the returned provider, trading date and turnover scope', () => {
  const html = renderMarketSourceDetails({
    nasdaq100: { status: 'latest', proxySource: 'westock-data / 腾讯自选股', data: { marketDate: '2026-10-21', sourceUrl: 'https://gu.qq.com/usNDX', valuationNote: '估值暂无数据' } },
    marketTurnover: { status: 'latest', data: { source: 'Tushare daily_info', sourceUrl: 'https://tushare.pro/document/2?doc_id=215', points: [{ date: '2026-10-20' }, { date: '2026-10-21' }], incompleteDays: 2 } },
    dividendSignal: { sourceNote: 'AKShare 股息率2；bond_zh_us_rate', indexDate: '2026-10-20', bondDate: '2026-10-21' },
  });
  assert.match(html, /westock-data \/ 腾讯自选股；数据日期：2026-10-21；读取成功/);
  assert.doesNotMatch(html, /Yahoo/);
  assert.match(html, /Tushare daily_info；数据日期：2026-10-21/);
  assert.match(html, /沪深股票，含A\/B股，单位亿元/);
  assert.match(html, /已排除 2 日/);
  assert.match(html, /股息率 2026-10-20 \/ 国债 2026-10-21/);
  assert.match(html, /估值暂无数据/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('market sources disclose loading, failure, retained results, cache and example independently', () => {
  const html = renderMarketSourceDetails({
    youzhiyouxingTemperature: { status: 'loading' },
    nasdaq100: { status: 'missing', error: 'HTTP 500' },
    marketTurnover: { status: 'missing', error: 'HTTP 502', data: { source: 'Tushare', points: [{ date: '2026-10-20' }] } },
  }, {
    margin: { status: 'snapshot', source: '本地缓存', data: [{ date: '2026-10-19' }] },
    usTreasury10y: { status: 'example', source: '内置示例' },
    usDollarIndex: { status: 'expired', source: 'Tushare' },
    usdJpy: { status: 'missing', errors: ['上游为空'] },
  });
  for (const text of ['正在读取', '读取失败：HTTP 500', '读取失败，保留上次结果：HTTP 502', '本地快照', '示例数据', '缓存已过期', '读取失败：上游为空', '暂空不代表低风险']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /1970|undefined|NaN/);
});

test('missing market sources do not invent successful reads or dates', () => {
  const html = renderMarketSourceDetails();
  assert.match(html, /来源待确认；数据日期：待确认；尚未读取/);
  assert.match(html, /暂无信号记录/);
  assert.doesNotMatch(html, /读取成功|1970|undefined/);
});

test('market source metadata is escaped and unsafe source links are omitted', () => {
  const html = renderMarketSourceDetails({ nasdaq100: { status: 'missing', proxySource: '<script>', error: '<img onerror="bad">', sourceUrl: 'javascript:alert(1)' } });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img onerror=&quot;bad&quot;&gt;/);
  assert.doesNotMatch(html, /<script>|<img|javascript:/);
});

test('market disclosure uses a persistent native details wrapper inside the overview', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const overview = html.slice(html.indexOf('id="market-summary"'), html.indexOf('id="market-source-disclosure"') + 300);
  assert.match(overview, /<details class="dividend-source-disclosure market-source-disclosure" id="market-source-disclosure">/);
  assert.match(overview, /<summary>数据来源与验证边界<\/summary>/);
  assert.match(overview, /id="market-source-content"/);
  assert.equal(html.match(/id="market-source-disclosure"/g).length, 1);
});
