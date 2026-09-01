const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_SECTIONS = [
  '估值摘要',
  '估值基础',
  '估值方法与假设',
  '估值结果与交易溢价',
  '风险与结论',
];

function loadMarked() {
  try {
    return require('marked').marked;
  } catch (firstError) {
    const bundled = path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'marked');
    try {
      return require(bundled).marked;
    } catch {
      throw new Error(`未找到 marked。请安装 marked 或使用 Codex 工作区 Node 运行时。原始错误：${firstError.message}`);
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value) throw new Error('参数格式错误。');
    args[key.slice(2)] = value;
  }
  for (const required of ['input', 'output', 'vault-root']) {
    if (!args[required]) throw new Error(`缺少 --${required} 参数。`);
  }
  return args;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

function extractMetadata(markdown) {
  const fields = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^>\s*([^：:]+)[：:]\s*(.*?)\s{0,2}$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  return fields;
}

function cleanInline(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '').replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function extractSecurityCode(source, markdown, metadata, title) {
  const candidates = [
    metadata['证券代码'],
    source.match(/^security_code:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1],
    source.match(/^stock_code:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1],
    title.match(/（([^）]+)）/)?.[1],
    markdown.match(/证券代码\s*[|：:]\s*([^|\r\n]+)/)?.[1],
    markdown.match(/\b(?:SH|SZ)?\d{6}(?:\.(?:SH|SZ))?\b/i)?.[0],
  ];
  return candidates.map(cleanInline).find(Boolean) || 'SECURITY';
}

function extractDecisionRows(markdown) {
  const section = markdown.match(/^## 1\. 估值摘要\s*$([\s\S]*?)(?=^## 2\.|\Z)/m)?.[1] ?? '';
  const rows = {};
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 2 && cells[0] && !/^[-:]+$/.test(cells[0]) && cells[0] !== '项目') {
      rows[cells[0]] = cells[1];
    }
  }
  return rows;
}

function renderTrackingCard(key, label, value, badPattern) {
  const isBad = badPattern?.test(value);
  return `<div class="tracking-card" data-tracking-key="${key}"><p class="tracking-label">${label}</p><p class="tracking-value${isBad ? ' bad' : ''}">${escapeHtml(value)}</p></div>`;
}

const PRICING_LEVELS = [
  ['估值溢价', 'premium'],
  ['普通高估', 'overvalued'],
  ['估值泡沫', 'bubble'],
  ['严重估值泡沫', 'severe'],
];

function pricingDeviationStatus(value) {
  const text = cleanInline(value);
  const mappings = [
    ['严重估值泡沫', '严重估值泡沫'],
    ['估值泡沫', '估值泡沫'],
    ['价格脱锚', '估值泡沫'],
    ['普通高估', '普通高估'],
    ['高溢价', '普通高估'],
    ['可解释估值溢价', '估值溢价'],
    ['合理溢价', '估值溢价'],
    ['估值溢价', '估值溢价'],
    ['公允价值内', '公允价值内'],
    ['折价', '折价'],
    ['证据不足', '证据不足'],
  ];
  return mappings.find(([needle]) => text.includes(needle))?.[1] || '证据不足';
}

function renderPricingDeviationCard(value) {
  const cleanValue = cleanInline(value) || '当前判断：证据不足。需要当前价格、公允价值和反向估值证据。';
  const status = pricingDeviationStatus(cleanValue);
  const detail = /^当前判断[：:]/.test(cleanValue) ? cleanValue : `当前判断：${status}。${cleanValue}`;
  const levels = PRICING_LEVELS.map(([label, tone]) => {
    const active = status === label;
    return `<span class="pricing-level pricing-level-${tone}${active ? ' active' : ''}"${active ? ' aria-current="true"' : ''}>${label}</span>`;
  }).join('');
  return `<div class="tracking-card" data-tracking-key="pricing-deviation"><p class="tracking-label">交易定价偏离</p><div class="pricing-levels">${levels}</div><p class="tracking-detail">${escapeHtml(detail)}</p></div>`;
}

function renderDailyTracking(decisions, metadata) {
  const fundamental = cleanInline(decisions['基本面状态']) || '待确认；当前证据不足以判断基本面状态。';
  const fairValue = cleanInline(decisions['公允价值范围'] || decisions['公允价值区间']) || '未获取到；需要完成估值计算。';
  const pricingDeviation = cleanInline(decisions['交易定价偏离'] || decisions['交易定价偏离判断'] || decisions['交易溢价'] || decisions['交易溢价判断'] || decisions['估值泡沫判断']) || '当前判断：证据不足。需要当前价格、公允价值和反向估值证据。';
  const capital = cleanInline(decisions['资金与筹码'] || decisions['资金状态']) || '证据不足；资金、股东人数或交易方画像未获取到。';
  const updatedAt = cleanInline(decisions['每日跟踪时间'] || metadata['研究截止时间']) || '未获取到';

  const cards = [
    renderTrackingCard('fundamental-status', '基本面状态', fundamental, /走弱|恶化|不利/),
    renderTrackingCard('fair-value-range', '公允价值范围', fairValue),
    renderPricingDeviationCard(pricingDeviation),
    renderTrackingCard('capital-and-holders', '资金与筹码', capital, /流出|转弱|分散|拥挤|减持/),
  ].join('\n    ');

  return `<!-- DAILY_TRACKING_START -->
<section class="daily-tracking" id="daily-tracking" data-updated-at="${escapeHtml(updatedAt)}">
  <div class="daily-tracking-head">
    <div><p class="daily-tracking-kicker">Daily valuation tracker</p><h2>每日跟踪面板</h2></div>
    <p class="daily-tracking-time">更新：${escapeHtml(updatedAt)}<br>下次：收盘后 / 财报或重大公告后</p>
  </div>
  <div class="tracking-grid">
    ${cards}
  </div>
</section>
<!-- DAILY_TRACKING_END -->`;
}

function normalizeObsidianLinks(markdown, outputPath, vaultRoot) {
  return markdown.replace(/!?(\[\[)([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (full, _open, target, anchor, label) => {
    if (full.startsWith('!')) return escapeHtml(label || target);
    const normalizedTarget = target.trim().replace(/\\/g, '/');
    const sourcePath = path.resolve(vaultRoot, normalizedTarget.endsWith('.md') ? normalizedTarget : `${normalizedTarget}.md`);
    const htmlTarget = sourcePath.replace(/\.md$/i, '.html');
    const linkTarget = fs.existsSync(htmlTarget) ? htmlTarget : sourcePath;
    let relative = path.relative(path.dirname(outputPath), linkTarget).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    if (anchor) relative += `#${encodeURIComponent(anchor.trim())}`;
    return `<a href="${escapeHtml(relative)}">${escapeHtml((label || path.basename(normalizedTarget)).trim())}</a>`;
  });
}

function sectionize(markdown) {
  const sections = [];
  const converted = markdown.replace(/^##\s+(\d+)\.\s+(.+)$/gm, (_full, number, title) => {
    const cleanTitle = title.trim();
    const id = `section-${number}`;
    sections.push({ id, title: cleanTitle, label: `${number}. ${cleanTitle}` });
    return `<h2 id="${id}">${escapeHtml(number)}. ${escapeHtml(cleanTitle)}</h2>`;
  });
  return { markdown: converted, sections };
}

function validateSections(sections) {
  const actual = sections.map(({ title }) => title);
  const valid = actual.length === EXPECTED_SECTIONS.length
    && actual.every((title, index) => title === EXPECTED_SECTIONS[index]);
  if (!valid) {
    throw new Error(`报告必须按顺序包含5个编号模块：${EXPECTED_SECTIONS.join('、')}。当前为：${actual.join('、') || '无'}。`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const vaultRoot = path.resolve(args['vault-root']);
  const cssPath = path.resolve(__dirname, '..', 'assets', 'report.css');
  const source = fs.readFileSync(inputPath, 'utf8');
  if (source.includes('\uFFFD')) throw new Error('输入 Markdown 含替换字符 �，停止导出。');

  let markdown = stripFrontmatter(source);
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(inputPath, '.md');
  const metadata = extractMetadata(markdown);
  const decisions = extractDecisionRows(markdown);
  markdown = markdown.replace(/^#\s+.+\r?\n/, '');
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  const sectioned = sectionize(markdown);
  validateSections(sectioned.sections);

  const marked = loadMarked();
  const body = marked.parse(sectioned.markdown, { gfm: true, breaks: false });
  const css = fs.readFileSync(cssPath, 'utf8');
  const code = extractSecurityCode(source, markdown, metadata, title);
  const market = cleanInline(metadata['交易所 / 币种']) || '市场与币种未获取';
  const cutoff = cleanInline(metadata['研究截止时间']) || '研究截止时间未获取';
  const generated = cleanInline(metadata['报告生成时间']) || '报告生成时间未获取';
  const toc = sectioned.sections.map(({ id, label }) => `<a class="toc-link" href="#${id}">${escapeHtml(label)}</a>`).join('\n');
  const tracking = renderDailyTracking(decisions, metadata);
  const bodyWithTracking = body.includes('</blockquote>') ? body.replace('</blockquote>', `</blockquote>\n${tracking}`) : `${tracking}\n${body}`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <main class="report-shell">
    <header class="hero">
      <p class="eyebrow">BBXM EQUITY VALUATION · ${escapeHtml(code)}</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="hero-meta"><span>${escapeHtml(cutoff)}</span><span>${escapeHtml(generated)}</span><span>${escapeHtml(market)}</span></div>
    </header>
    <div class="layout">
      <aside class="toc"><div class="toc-inner"><p class="toc-title">Report contents</p>${toc}</div></aside>
      <article class="content">${bodyWithTracking}</article>
    </div>
  </main>
</body>
</html>\n`;

  if (/\[\[|\uFFFD|12\?24|\?\?/.test(html)) throw new Error('HTML 编码或双链转换检查失败。');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generated ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
