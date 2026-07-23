const fs = require('node:fs');
const path = require('node:path');

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

function extractDecisionRows(markdown) {
  const section = markdown.match(/^## 1\. 决策摘要\s*$([\s\S]*?)(?=^## 2\.|\Z)/m)?.[1] ?? '';
  const rows = {};
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 2 && cells[0] && !/^[-:]+$/.test(cells[0]) && cells[0] !== '项目') {
      rows[cells[0]] = cells[1];
    }
  }
  return rows;
}

function cleanInline(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '').replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function extractNumbers(value) {
  return (String(value ?? '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
}

function formatPercent(value) {
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function describeDeviation(price, low, high, label = '每日同步价') {
  if (![price, low, high].every(Number.isFinite) || low <= 0 || high <= low) {
    return { value: '未获取到', detail: '价格或动态价值区间无法解析，未计算偏离度。', isBad: false };
  }
  const midpoint = (low + high) / 2;
  const versusLow = (price / low - 1) * 100;
  const versusMid = (price / midpoint - 1) * 100;
  const versusHigh = (price / high - 1) * 100;
  let value = '位于动态价值区间内';
  let isBad = false;
  if (price > high) {
    value = `高于上沿 ${formatPercent(versusHigh)}`;
    isBad = true;
  } else if (price < low) {
    value = `低于下沿 ${formatPercent(Math.abs(versusLow))}`;
  }
  return {
    value,
    detail: `${label} ${price.toFixed(2)} 元；相对区间中枢 ${midpoint.toFixed(2)} 元为 ${formatPercent(versusMid)}，相对下沿为 ${formatPercent(versusLow)}，相对上沿为 ${formatPercent(versusHigh)}。价格不改变价值区间本身。`,
    isBad,
  };
}

function liveQuoteSecid(code) {
  const normalized = String(code ?? '').toUpperCase().replace(/\s/g, '');
  const secids = new Map([
    ['000807', '0.000807'],
    ['000807.SZ', '0.000807'],
    ['SZ000807', '0.000807'],
    ['002270', '0.002270'],
    ['002270.SZ', '0.002270'],
    ['SZ002270', '0.002270'],
    ['600879', '1.600879'],
    ['600879.SH', '1.600879'],
    ['SH600879', '1.600879'],
  ]);
  return secids.get(normalized) ?? '';
}

function safeSiblingHtml(value) {
  const cleaned = cleanInline(value);
  if (!cleaned || path.basename(cleaned) !== cleaned || !/^[^<>:"/\\|?*]+\.html$/i.test(cleaned)) return '';
  return cleaned;
}

function renderDailyTracking(decisions, metadata, code, outputPath) {
  const priceText = cleanInline(decisions['当前价格及时间']) || '未获取到';
  const fairValue = cleanInline(decisions['综合估值区间']) || '未获取到';
  const action = cleanInline(decisions['冰冰小美动作'] || decisions['操作建议']) || '未获取到';
  const valuation = cleanInline(decisions['估值状态']) || '未获取到';
  const confidence = cleanInline(decisions['结论置信度']) || '未获取到';
  const fundamental = cleanInline(decisions['基本面状态']) || '未获取到';
  const fundStatus = cleanInline(decisions['资金状态']) || '未获取到';
  const riskDirection = cleanInline(decisions['风险方向']) || '未获取到';
  const updatedAt = cleanInline(decisions['每日跟踪时间'] || metadata['研究截止时间']) || '未获取到';
  const candidateFundReport = safeSiblingHtml(decisions['资金面分析链接']);
  const fundReport = candidateFundReport && fs.existsSync(path.join(path.dirname(outputPath), candidateFundReport)) ? candidateFundReport : '';
  const price = extractNumbers(priceText)[0];
  const [low, high] = extractNumbers(fairValue);
  const deviation = describeDeviation(price, low, high);
  const secid = liveQuoteSecid(code);
  const liveValue = secid ? '等待连接' : '未配置实时行情';
  const liveDetail = secid ? '通过“大盘启动器”打开后获取盘中行情，每 60 秒刷新；直接打开 HTML 时不访问外部行情。' : '当前证券未配置本地行情白名单，继续使用每日正式快照。';
  const link = fundReport ? `<a href="./${escapeHtml(fundReport)}">查看完整资金面分析 →</a>` : '<span>资金面分析：未单独生成</span>';
  const badFundamental = /恶化|不利|增强/.test(fundamental);

  return `<!-- DAILY_TRACKING_START -->
<section class="daily-tracking" id="daily-tracking" data-updated-at="${escapeHtml(updatedAt)}" data-value-low="${Number.isFinite(low) ? low : ''}" data-value-high="${Number.isFinite(high) ? high : ''}">
  <div class="daily-tracking-head">
    <div><p class="daily-tracking-kicker">Daily decision tracker</p><h2>每日跟踪面板</h2></div>
    <p class="daily-tracking-time">更新：${escapeHtml(updatedAt)}<br>下次：收盘后 / 重大公告后</p>
  </div>
  <div class="tracking-grid">
    <div class="tracking-card" data-tracking-key="fundamental-status"><p class="tracking-label">基本面状态</p><p class="tracking-value${badFundamental ? ' bad' : ''}">${escapeHtml(fundamental)}</p><p class="tracking-detail">风险方向：${escapeHtml(riskDirection)}。下一验证点与失效条件见第 11—13 章。</p></div>
    <div class="tracking-card" data-tracking-key="dynamic-value-range"><p class="tracking-label">动态价值区间</p><p class="tracking-value">${escapeHtml(fairValue)}</p><p class="tracking-detail">价值区间来自三类估值交叉验证；行情刷新不会自动改变区间。</p></div>
    <div class="tracking-card" data-tracking-key="price-deviation"><p class="tracking-label">股价偏离度</p><p class="tracking-value${deviation.isBad ? ' bad' : ''}" id="deviation-value">${escapeHtml(deviation.value)}</p><p class="tracking-detail" id="deviation-detail">${escapeHtml(deviation.detail)}</p></div>
  </div>
  <div class="tracking-grid">
    <div class="tracking-card" data-tracking-key="daily-quote"><p class="tracking-label">每日同步价</p><p class="tracking-value">${escapeHtml(priceText)}</p><p class="tracking-detail">这是报告内嵌的正式跟踪基准，离线打开仍可使用。</p><span class="tracking-status">每日快照</span></div>
    <div class="tracking-card" data-tracking-key="intraday-quote"><p class="tracking-label">盘中实时</p><p class="tracking-value" id="intraday-price">${escapeHtml(liveValue)}</p><p class="tracking-detail" id="intraday-detail">${escapeHtml(liveDetail)}</p><span class="tracking-status" id="intraday-status">${secid ? '未连接' : '未配置'}</span></div>
    <div class="tracking-card" data-tracking-key="action-confidence"><p class="tracking-label">动作与置信度</p><p class="tracking-value">${escapeHtml(action)}</p><p class="tracking-detail">估值：${escapeHtml(valuation)} · ${escapeHtml(action)}；风险：${escapeHtml(riskDirection)}；结论置信度：${escapeHtml(confidence)}。</p><span class="tracking-status${valuation === '高估' ? ' error' : ''}">${escapeHtml(valuation)}</span></div>
  </div>
  <div class="tracking-footer"><span>资金状态：<strong>${escapeHtml(fundStatus)}</strong> · 新增/已有动作：<strong>${escapeHtml(action)}</strong></span>${link}</div>
</section>
<!-- DAILY_TRACKING_END -->`;
}

function renderLiveQuoteScript(code, decisions) {
  const secid = liveQuoteSecid(code);
  if (!secid) return '';
  const snapshotPrice = extractNumbers(cleanInline(decisions['当前价格及时间']))[0];
  return `<script>
(() => {
  const endpoint = '/api/stock-quote?secid=${secid}';
  const priceNode = document.getElementById('intraday-price');
  const detailNode = document.getElementById('intraday-detail');
  const statusNode = document.getElementById('intraday-status');
  const deviationValue = document.getElementById('deviation-value');
  const deviationDetail = document.getElementById('deviation-detail');
  const tracker = document.getElementById('daily-tracking');
  const snapshotPrice = ${Number.isFinite(snapshotPrice) ? snapshotPrice : 'null'};
  const percent = value => \`${'${value < 0 ? \'-\' : value > 0 ? \'+\' : \'\'}${Math.abs(value).toFixed(1)}'}%\`;
  function updateDeviation(price) {
    const low = Number(tracker.dataset.valueLow);
    const high = Number(tracker.dataset.valueHigh);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= low) return;
    const midpoint = (low + high) / 2;
    const versusLow = (price / low - 1) * 100;
    const versusMid = (price / midpoint - 1) * 100;
    const versusHigh = (price / high - 1) * 100;
    if (price > high) { deviationValue.textContent = \`高于上沿 ${'${percent(versusHigh)}'}\`; deviationValue.classList.add('bad'); }
    else if (price < low) { deviationValue.textContent = \`低于下沿 ${'${percent(Math.abs(versusLow))}'}\`; deviationValue.classList.remove('bad'); }
    else { deviationValue.textContent = '位于动态价值区间内'; deviationValue.classList.remove('bad'); }
    deviationDetail.textContent = \`盘中价 ${'${price.toFixed(2)}'} 元；相对区间中枢 ${'${midpoint.toFixed(2)}'} 元为 ${'${percent(versusMid)}'}，相对下沿为 ${'${percent(versusLow)}'}，相对上沿为 ${'${percent(versusHigh)}'}。盘中价格不改变价值区间本身。\`;
  }
  async function refreshIntradayQuote() {
    statusNode.textContent = '连接中'; statusNode.className = 'tracking-status';
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(\`HTTP ${'${response.status}'}\`);
      const payload = await response.json(); const quote = payload && payload.data;
      if (!quote || !Number.isFinite(quote.price) || !Number.isFinite(quote.prevClose) || !Number.isFinite(quote.changePercent) || !Number.isFinite(quote.quoteTimestamp)) throw new Error('invalid quote');
      const quoteTime = new Date(quote.quoteTimestamp * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      priceNode.textContent = \`${'${quote.price.toFixed(2)}'} 元 · ${'${percent(quote.changePercent)}'}\`;
      priceNode.classList.toggle('bad', quote.changePercent < 0);
      detailNode.textContent = \`行情时间：${'${quoteTime}'}；昨收 ${'${quote.prevClose.toFixed(2)}'} 元。来源：${'${payload.proxySource || \'本地行情代理\'}'}。\`;
      statusNode.textContent = '盘中实时 · 每 60 秒'; statusNode.className = 'tracking-status live'; updateDeviation(quote.price);
    } catch { priceNode.textContent = '实时行情暂不可用'; priceNode.classList.remove('bad'); detailNode.textContent = '每日同步值仍然有效；可重新双击“大盘启动器”后刷新本页。'; statusNode.textContent = '连接失败'; statusNode.className = 'tracking-status error'; }
  }
  if (location.protocol === 'http:' || location.protocol === 'https:') { refreshIntradayQuote(); window.setInterval(refreshIntradayQuote, 60000); }
  else { priceNode.textContent = Number.isFinite(snapshotPrice) ? \`${'${snapshotPrice.toFixed(2)}'} 元（每日值）\` : '每日值未获取'; detailNode.textContent = '当前为直接打开模式；盘中实时需通过“大盘启动器”进入本地服务。'; statusNode.textContent = '每日同步 · 实时未连接'; }
})();
</script>`;
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
    const id = `section-${number}`;
    sections.push({ id, label: `${number}. ${title.trim()}` });
    return `<h2 id="${id}">${escapeHtml(number)}. ${escapeHtml(title.trim())}</h2>`;
  });
  return { markdown: converted, sections };
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
  if (sectioned.sections.length !== 16) {
    throw new Error(`报告必须包含 16 个编号模块，当前为 ${sectioned.sections.length} 个。`);
  }

  const marked = loadMarked();
  const body = marked.parse(sectioned.markdown, { gfm: true, breaks: false });
  const css = fs.readFileSync(cssPath, 'utf8');
  const code = cleanInline(metadata['证券代码']) || cleanInline(title.match(/（([^）]+)）/)?.[1]) || 'SECURITY';
  const market = cleanInline(metadata['交易所 / 币种']) || '市场与币种未获取';
  const cutoff = cleanInline(metadata['研究截止时间']) || '研究截止时间未获取';
  const generated = cleanInline(metadata['报告生成时间']) || '报告生成时间未获取';
  const valuation = cleanInline(decisions['估值状态']) || '估值状态未获取';
  const action = cleanInline(decisions['冰冰小美动作'] || decisions['操作建议']) || '动作未获取';
  const price = cleanInline(decisions['当前价格及时间']) || '未获取';
  const fairValue = cleanInline(decisions['综合估值区间']) || '未获取';
  const confidence = cleanInline(decisions['结论置信度']) || '未获取';
  const toc = sectioned.sections.map(({ id, label }) => `<a class="toc-link" href="#${id}">${escapeHtml(label)}</a>`).join('\n');
  const tracking = renderDailyTracking(decisions, metadata, code, outputPath);
  const liveQuoteScript = renderLiveQuoteScript(code, decisions);
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
      <p class="eyebrow">BBXM EQUITY RESEARCH · ${escapeHtml(code)}</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="hero-meta"><span>${escapeHtml(cutoff)}</span><span>${escapeHtml(generated)}</span><span>${escapeHtml(market)}</span></div>
    </header>
    <div class="layout">
      <aside class="toc"><div class="toc-inner"><p class="toc-title">Report contents</p>${toc}</div></aside>
      <article class="content">${bodyWithTracking}${liveQuoteScript}</article>
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
