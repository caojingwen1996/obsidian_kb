import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDividendIndexSource, renderDividendManagementSource, loadDividendBacktestData } from '../src/app.mjs';

const metadata = {source:'中证指数官网 index-perf(000922)', cutoffDate:'2026-10-19', fetchedAt:'2026-10-20T06:03:11Z', lastAttemptAt:'2026-10-20T06:05:00Z', status:'updated'};

test('index source lists actual source, cutoff, Shanghai update time and outcome', () => {
  const html = renderDividendIndexSource(metadata);
  for (const text of ['指数日线', '中证指数官网 index-perf(000922)', '价格指数', '截止日期：2026-10-19', '最近更新时间', '14:03:11', '更新成功', '最近尝试', '14:05:00', '每次回测前自动更新']) assert.ok(html.includes(text),text);
});

test('cached, failed and unknown outcomes never imply update success', () => {
  for (const status of ['cached','failed','missing','saved','unknown']) {
    const html = renderDividendIndexSource({...metadata,status});
    assert.doesNotMatch(html,/更新成功/);
  }
  assert.match(renderDividendIndexSource({...metadata,status:'cached'}),/使用本地价格/);
  assert.match(renderDividendIndexSource({...metadata,status:'failed'}),/回测停止/);
});

test('metadata is available even without a signal and remains inside the disclosure', () => {
  const html = renderDividendManagementSource(null, metadata);
  assert.match(html,/<details[^>]*data-dividend-disclosure="sources"/);
  assert.match(html,/data-dividend-index-source/);
  assert.match(html,/2026-10-19/);
});

test('source values are escaped and missing timestamps are not fabricated', () => {
  const html = renderDividendIndexSource({source:'<script>alert(1)</script>',fetchedAt:'bad-date'});
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/最近更新时间：待确认/);
});

test('failed backtest responses preserve updated source status for the page', async () => {
  await assert.rejects(loadDividendBacktestData(async () => ({ok:false,status:422,json:async()=>({error:'price missing',indexHistoryMeta:{...metadata,status:'failed'}})}), {protocol:'http:',hostname:'127.0.0.1'}), error => error.message==='price missing' && error.indexHistoryMeta.status==='failed');
});
