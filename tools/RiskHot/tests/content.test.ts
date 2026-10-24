import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalog } from '../src/m1/catalog.js';
import { discoverPbc, parsePbc } from '../src/l0/pbc.js';
import { validateExtraction } from '../src/l0/extraction.js';

const url = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026102308535522110/index.html';
const html = `<meta name="ArticleTitle" content="测试公告"><meta name="PubDate" content="2026-10-23"><div id="zoom"><p>测试机构宣布操作量为零😀。</p><table><tr><th>期限</th><th>中标量</th></tr><tr><td>7天</td><td>0亿元</td></tr></table><p>同时开展隔夜操作。</p></div>`;

test('reads all supplied source identities without executing browser JavaScript', async () => {
  const catalog = await readCatalog('src/data/source-catalog.js');
  assert.equal(catalog.length, 40);
  assert.equal(catalog.find(x => x.id === 'wiki-source-001')?.url, 'https://www.pbc.gov.cn/');
});

test('discovers unique same-origin announcement links and respects the finite batch limit', () => {
  const list = `<a href="${url}">A</a><a href="${url}">duplicate</a><a href="https://evil.test/125475/2026102308535522110/index.html">external</a><a href="/zhengcehuobisi/125207/125213/125431/125475/2026102200000000000/index.html">B</a>`;
  assert.deepEqual(discoverPbc(list, 'https://www.pbc.gov.cn/', 1).map(x => x.url), [url]);
  assert.equal(discoverPbc(list, 'https://www.pbc.gov.cn/', 5).length, 2);
});

test('normalizes the actual body region while preserving table zeroes and Unicode', () => {
  const material = parsePbc(Buffer.from(html), url);
  assert.equal(material.title, '测试公告');
  assert.equal(material.publishedAtText, '2026-10-23');
  assert.equal(material.segments[0]?.text, '测试机构宣布操作量为零😀。');
  assert.equal(material.segments[1]?.text, '期限 | 中标量\n7天 | 0亿元');
  assert.match(material.segments[1]?.rawLocator ?? '', /zoom/);
  assert.equal(parsePbc(Buffer.from(html), url).segments[0]?.id, material.segments[0]?.id);
});

test('rejects empty body, unsupported merged tables and oversized input', () => {
  assert.throws(() => parsePbc(Buffer.from('<title>login</title>'), url), /BODY_MISSING/);
  assert.throws(() => parsePbc(Buffer.from('<div id="zoom"><table><tr><td colspan="2">x</td></tr></table></div>'), url), /TABLE_UNSUPPORTED/);
  assert.throws(() => parsePbc(Buffer.alloc(1_048_577), url), /RAW_TOO_LARGE/);
  assert.throws(() => parsePbc(Buffer.from(`<div id="zoom"><p>${'字'.repeat(20_001)}</p></div>`), url), /TEXT_TOO_LARGE/);
});

test('accepts a complete empty set, rejects incomplete responses and incomplete coverage', () => {
  const material = parsePbc(Buffer.from(html), url);
  const payload = { covered_segment_ids: material.segments.map(x => x.id), candidates: [], no_event_reason: '仅有背景说明', warnings: [] };
  assert.equal(validateExtraction({ complete: true, data: payload, finishReason: 'stop' }, material).candidates.length, 0);
  assert.throws(() => validateExtraction({ complete: false, data: payload, finishReason: 'length' }, material), /MODEL_INCOMPLETE/);
  assert.throws(() => validateExtraction({ complete: true, data: { ...payload, covered_segment_ids: [] }, finishReason: 'stop' }, material), /COVERAGE/);
});

test('checks codepoint evidence and rejects forged quotes, formal IDs and excess candidates as a whole', () => {
  const material = parsePbc(Buffer.from(html), url);
  const segment = material.segments[0]!;
  const candidate = { title: '测试机构宣布操作', description: '操作量为零', subject_name: '测试机构', action: '宣布操作', stage: '宣布', time: null, uncertainties: [], evidence: [{ segment_id: segment.id, start_cp: 0, end_cp: 13, quote: '测试机构宣布操作量为零😀。' }] };
  const payload = { covered_segment_ids: material.segments.map(x => x.id), candidates: [candidate], no_event_reason: null, warnings: [] };
  assert.equal(validateExtraction({ complete: true, data: payload, finishReason: 'stop' }, material).candidates.length, 1);
  const withoutOffsets = { ...payload, candidates: [{ ...candidate, evidence: [{ ...candidate.evidence[0], start_cp: null, end_cp: null }] }] };
  assert.equal(validateExtraction({ complete: true, data: withoutOffsets, finishReason: 'stop' }, material).candidates[0]?.evidence[0]?.end_cp, 13);
  assert.throws(() => validateExtraction({ complete: true, data: { ...payload, candidates: [{ ...candidate, evidence: [{ ...candidate.evidence[0], quote: '伪造' }] }] }, finishReason: 'stop' }, material), /EVIDENCE/);
  assert.throws(() => validateExtraction({ complete: true, data: { ...payload, candidates: [{ ...candidate, event_id: 'fake' }] }, finishReason: 'stop' }, material), /SCHEMA/);
  assert.throws(() => validateExtraction({ complete: true, data: { ...payload, candidates: Array(51).fill(candidate) }, finishReason: 'stop' }, material), /SCHEMA/);
});
