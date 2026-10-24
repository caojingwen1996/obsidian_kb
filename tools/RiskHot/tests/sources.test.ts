import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalog } from '../src/m1/catalog.js';
import { connectorFor, type SourceConnector } from '../src/m1/connectors.js';
import { assertSourceUrl, discoverSource, parseSource, fetchSource } from '../src/l0/sources.js';

const article: SourceConnector = {
  key: 'controlled-source', id: 'controlled-article-v1', readiness: 'ready', kind: 'article',
  entryUrl: 'https://www.safe.gov.cn/list.html', scope: '受控测试栏目',
  allowed: [{ origin: 'https://www.safe.gov.cn', path: '^/(?:list|article-[0-9]+)\\.html$' }],
  discovery: { format: 'html', selector: '.news a[href]' },
  html: { body: '#article', title: 'h1', date: 'time' },
};
const url = 'https://www.safe.gov.cn/article-1.html';

test('every supplied source has a usable connector or an explicit unmet requirement', async () => {
  const rows = await readCatalog('src/data/source-catalog.js');
  for (const row of rows) {
    const connector = connectorFor(row.id);
    assert.equal(connector.key, row.id);
    if (connector.readiness === 'ready') {
      assert.ok(connector.entryUrl && connector.allowed.length, row.name);
      assertSourceUrl(connector, connector.entryUrl);
    } else assert.ok(connector.reason, row.name);
  }
  assert.equal(connectorFor('wiki-source-017').readiness, 'missing_url');
  assert.equal(connectorFor('wiki-source-028').readiness, 'missing_url');
  assert.throws(() => connectorFor('wiki-source-999'), /SOURCE_UNKNOWN/);
});

test('discovery ignores navigation, external links and duplicates and preserves finite coverage', () => {
  const raw = Buffer.from(`<nav><a href="${url}">导航</a></nav><div class="news"><a href="/article-1.html">正文</a><a href="/article-1.html">重复</a><a href="https://evil.test/article-1.html">外链</a><a href="/article-2.html">另一篇</a></div>`);
  assert.deepEqual(discoverSource(article, raw, article.entryUrl!, 1), [{ url, title: '正文' }]);
  assert.throws(() => discoverSource(article, Buffer.from('<a>无正文链接</a>'), article.entryUrl!, 1), /SOURCE_ITEMS_MISSING/);
  assert.throws(() => discoverSource(article, raw, article.entryUrl!, 6), /BATCH_LIMIT/);
});

test('RSS discovers original detail URLs and never treats the summary as full text', () => {
  const profile = { ...article, discovery: { format: 'rss' as const, selector: 'item' } };
  const raw = Buffer.from(`<rss><channel><item><title>公告</title><link>${url}</link><description>只有摘要</description></item></channel></rss>`);
  assert.deepEqual(discoverSource(profile, raw, article.entryUrl!, 1), [{ url, title: '公告' }]);
  assert.throws(() => parseSource(article, raw, url), /BODY_MISSING/);
});

test('HTML uses the configured body and preserves zeroes, Unicode and merged-header meaning', () => {
  const raw = Buffer.from('<h1>受控公告</h1><time>2026-10-24</time><nav>导航不入正文</nav><div id="article"><p>余额为0😀。</p><table><tr><th colspan="2">金额（亿元）</th></tr><tr><td>余额</td><td>0</td></tr></table></div>');
  const material = parseSource(article, raw, url);
  assert.equal(material.title, '受控公告');
  assert.equal(material.publishedAtText, '2026-10-24');
  assert.equal(material.segments[0]?.text, '余额为0😀。');
  assert.match(material.segments[1]!.text, /金额（亿元）.*colspan=2/u);
  assert.match(material.segments[1]!.text, /余额 \| 0/u);
  assert.ok(material.segments.every(x => !x.text.includes('导航')));
  assert.match(material.segments[0]!.rawLocator, /^#article/u);
  assert.deepEqual(parseSource(article, raw, url).segments, material.segments);
  const gbk = Buffer.from([0x3c,0x64,0x69,0x76,0x20,0x69,0x64,0x3d,0x22,0x61,0x72,0x74,0x69,0x63,0x6c,0x65,0x22,0x3e,0xd6,0xd0,0xce,0xc4,0x3c,0x2f,0x64,0x69,0x76,0x3e]);
  assert.equal(parseSource({ ...article, html: { body: '#article', encoding: 'gb18030' } }, gbk, url).segments[0]?.text, '中文');
});

test('login gates, absent bodies, oversized text and undated snapshots cannot become usable material', () => {
  assert.throws(() => parseSource(article, Buffer.from('<h1>登录</h1><div id="article"><form><input type="password"></form></div>'), url), /SOURCE_AUTH_REQUIRED/);
  assert.throws(() => parseSource(article, Buffer.from('<div id="article">请完成安全验证</div>'), url), /SOURCE_ACCESS_BLOCKED/);
  assert.throws(() => parseSource(article, Buffer.from('<main>只有网站首页</main>'), url), /BODY_MISSING/);
  assert.throws(() => parseSource(article, Buffer.from(`<div id="article">${'字'.repeat(20_001)}</div>`), url), /TEXT_TOO_LARGE/);
  assert.throws(() => parseSource({ ...article, kind: 'html-snapshot' }, Buffer.from('<div id="article">利率 0</div>'), url), /SOURCE_DATE_MISSING/);
});

test('JSON observations preserve null versus zero and use the actual observation date for identity', () => {
  const profile: SourceConnector = { ...article, kind: 'json-snapshot', json: { records: 'refRates', dateField: 'effectiveDate', fields: [{ path: 'effectiveDate', label: '观测日' }, { path: 'percentRate', label: '利率（%）' }, { path: 'volume', label: '成交量' }] } };
  const material = parseSource(profile, Buffer.from('{"refRates":[{"effectiveDate":"2026-10-23","percentRate":0,"volume":null}]}'), url);
  assert.equal(material.observedAtText, '2026-10-23');
  assert.equal(material.publishedAtText, null);
  assert.match(material.sourceIdentity!, /2026-10-23/);
  assert.match(material.segments[0]!.text, /利率（%）: 0/u);
  assert.match(material.segments[0]!.text, /成交量: null/u);
  assert.match(material.segments[0]!.rawLocator, /refRates\/0/u);
  assert.throws(() => parseSource(profile, Buffer.from('{"refRates":[]}'), url), /SOURCE_DATA_EMPTY/);
  assert.throws(() => parseSource(profile, Buffer.from('{"refRates":[{"percentRate":0,"volume":null}]}'), url), /SOURCE_DATE_MISSING|SOURCE_SCHEMA_INVALID/);
  assert.throws(() => parseSource(profile, Buffer.from('{"error":"access denied"}'), url), /SOURCE_SCHEMA_INVALID/);
});

test('URL and redirect policy rejects unregistered origins, paths, credentials and query parameters before fetch', async () => {
  for (const value of ['http://www.safe.gov.cn/article-1.html', 'https://www.safe.gov.cn.evil.test/article-1.html', 'https://user:secret@www.safe.gov.cn/article-1.html', `${url}?redirect=http://127.0.0.1`, 'https://127.0.0.1/article-1.html', 'https://www.safe.gov.cn/admin']) {
    assert.throws(() => assertSourceUrl(article, value), /SOURCE_URL_NOT_ALLOWED/);
  }
  assert.equal(assertSourceUrl(article, 'https://WWW.SAFE.GOV.CN:443/article-1.html').href, url);
  let calls = 0;
  await assert.rejects(() => fetchSource(article, url, async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://evil.test/article-1.html' } }); }), /SOURCE_URL_NOT_ALLOWED/);
  assert.equal(calls, 1, 'No request to the redirected destination');
  assert.equal((await fetchSource(article, url, async () => new Response('正文', { headers: { 'content-type': 'text/html; charset=utf-8' } }))).toString(), '正文');
});

test('dynamic JSON discovery freezes the observed date and script discovery reads only literal links', () => {
  const dated: SourceConnector = { ...article, kind: 'json-snapshot', discovery: { format: 'json-date', selector: '', datePath: 'data.date', template: 'https://www.safe.gov.cn/article-{date}.html' }, allowed: [{ origin: 'https://www.safe.gov.cn', path: '^/(?:list|article-[0-9-]+)\\.html$' }] };
  assert.deepEqual(discoverSource(dated, Buffer.from('{"data":{"date":"2026-10-23"}}'), article.entryUrl!, 1), [{ url: 'https://www.safe.gov.cn/article-2026-10-23.html', title: dated.scope }]);
  const scripted: SourceConnector = { ...article, discovery: { format: 'script-links', selector: 'li' } };
  assert.deepEqual(discoverSource(scripted, Buffer.from('<li><script>var curHref = "/article-1.html";\nvar curTitle = "原公告";</script></li>'), article.entryUrl!, 1), [{ url, title: '原公告' }]);
  assert.throws(() => discoverSource(scripted, Buffer.from('<li><script>var curHref=evil();</script></li>'), article.entryUrl!, 1), /SOURCE_ITEMS_MISSING/);
});

test('JSON article encoding is independent of embedded HTML charset declarations', () => {
  const profile: SourceConnector = { ...article, jsonArticle: { title: 'data.title', body: 'data.body', date: 'data.date' } };
  const raw = Buffer.from(JSON.stringify({ data: { title: '监管公告', body: '<meta charset="gb2312"><p>保额为0亿元。</p>', date: '2026-10-23' } }));
  const material = parseSource(profile, raw, url);
  assert.equal(material.title, '监管公告');
  assert.equal(material.segments[0]?.text, '保额为0亿元。');
  assert.match(material.segments[0]!.rawLocator, /^json:\/data\/body/u);
});

test('script comments cannot replace the actual discovered resource and daily-browser binaries are refused', async () => {
  const scripted: SourceConnector = { ...article, discovery: { format:'script-links', selector:'li' } };
  const raw = Buffer.from('<li><script>// var curHref="/article-2.html";\nvar curHref="/article-1.html";\nvar curTitle="实际公告";</script></li>');
  assert.deepEqual(discoverSource(scripted,raw,article.entryUrl!,1),[{url,title:'实际公告'}]);
  const { fetchRenderedSource } = await import('../src/l0/source-browser.js');
  await assert.rejects(() => fetchRenderedSource({ ...article, browser:{waitFor:'#article'} },url,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), /SOURCE_BROWSER_ISOLATION_REQUIRED/);
});

test('the disclosure index adapter selects its declared announcement table rather than unrelated homepage panels', () => {
  const profile=connectorFor('wiki-source-015');
  const raw=Buffer.from('<table class="jc-table3"><tr><td><a href="/new/disclosure/detail?announcementId=123&amp;announcementTime=2026-10-24">受控公告</a></td></tr></table><table class="jc-table3"><tr><td>无关面板</td></tr></table>');
  const material=parseSource(profile,raw,profile.entryUrl!);
  assert.equal(material.segments.length,1);
  assert.equal(material.observedAtText,'2026-10-24');
  assert.ok(!material.segments[0]!.text.includes('无关面板'));
});

test('official discovery selects the declared data column and excludes leadership and unrelated pinned links', () => {
  const cases=[
    {key:'wiki-source-003',old:'https://zwgls.mof.gov.cn/gzdt/202511/t20251101_3975501.htm',url:'https://zwgls.mof.gov.cn/gzdt/202610/t20261009_4002433.htm',title:'最新债务政策',wrap:true},
    {key:'wiki-source-004',old:'https://www.safe.gov.cn/safe/2023/1208/23600.html',url:'https://www.safe.gov.cn/safe/2026/1006/27959.html',title:'外汇储备数据',wrap:false},
    {key:'wiki-source-009',old:'https://www.chinabond.com.cn/xxwsy/sy_zdgz_ath/202610/t20261022_855470049.html',url:'https://www.chinabond.com.cn/xxwsy/sy_zdgz_ath/202610/t20261023_855472795.html',title:'中债收益率曲线和指数日评',wrap:false},
  ];
  for(const item of cases){const p=connectorFor(item.key);const link=`<a href="${item.url}">${item.title}</a>`;const raw=Buffer.from(`<a href="${item.old}">领导或非目标置顶</a>${item.wrap?`<div class="gzdtlist">${link}</div>`:link}`);assert.equal(discoverSource(p,raw,p.entryUrl!,1)[0]?.url,item.url);}
});
