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
      throw new Error(`未找到 marked。请使用 Codex 工作区 Node 运行时。原始错误：${firstError.message}`);
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
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

function extractBoldField(markdown, label, fallback) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^- \\*\\*${escaped}[：:]\\*\\*\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() || fallback;
}

function normalizeObsidianLinks(markdown, outputPath, vaultRoot) {
  return markdown.replace(/!?(\[\[)([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (full, _open, target, anchor, label) => {
    if (full.startsWith('!')) return escapeHtml(label || target);
    const normalized = target.trim().replace(/\\/g, '/');
    const extension = path.extname(normalized);
    const markdownPath = path.resolve(vaultRoot, extension ? normalized : `${normalized}.md`);
    const htmlPath = markdownPath.replace(/\.md$/i, '.html');
    const linkedPath = fs.existsSync(htmlPath) ? htmlPath : markdownPath;
    let relative = path.relative(path.dirname(outputPath), linkedPath).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    if (anchor) relative += `#${encodeURIComponent(anchor.trim())}`;
    return `<a href="${escapeHtml(relative)}">${escapeHtml((label || path.basename(normalized)).trim())}</a>`;
  });
}

function sectionize(markdown) {
  const toc = [];
  let sequence = 0;
  const converted = markdown.replace(/^(##|###)\s+(.+)$/gm, (_full, hashes, rawTitle) => {
    sequence += 1;
    const id = `section-${sequence}`;
    const title = rawTitle.trim();
    const level = hashes.length;
    toc.push({ id, title, level });
    return `<h${level} id="${id}">${escapeHtml(title)}<a class="anchor" href="#${id}" aria-label="链接到本节">#</a></h${level}>`;
  });
  return { converted, toc };
}

function parseNumber(value) {
  const match = String(value).replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseTableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function chartGrid({ left, top, width, height, max, suffix = '' }) {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = top + height - height * ratio;
    const value = max * ratio;
    return `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" class="chart-grid"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${value.toFixed(value >= 100 ? 0 : 1)}${suffix}</text>`;
  }).join('');
}

function buildProfitabilityVisual(rows) {
  const width = 760;
  const height = 310;
  const left = 54;
  const right = 40;
  const top = 42;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const groupWidth = plotWidth / rows.length;
  const revenueMax = Math.max(...rows.map((row) => row.revenue)) * 1.18;
  const grossValues = rows.map((row) => row.grossMargin);
  const grossMin = Math.max(0, Math.min(...grossValues) - 3);
  const grossMax = Math.max(...grossValues) + 3;
  const cashMax = Math.max(...rows.flatMap((row) => [row.operatingCashFlow, row.freeCashFlow])) * 1.2;
  const capexMax = Math.max(...rows.map((row) => row.capex)) * 1.2;

  const xAt = (index) => left + groupWidth * index + groupWidth / 2;
  const yRevenue = (value) => top + plotHeight - (value / revenueMax) * plotHeight;
  const yGross = (value) => top + plotHeight - ((value - grossMin) / (grossMax - grossMin || 1)) * plotHeight;
  const yCash = (value) => top + plotHeight - (value / cashMax) * plotHeight;
  const yCapex = (value) => top + plotHeight - (value / capexMax) * plotHeight;

  const periodLabels = rows.map((row, index) => `<text x="${xAt(index)}" y="${top + plotHeight + 25}" text-anchor="middle" class="chart-period">${escapeHtml(row.period)}</text>`).join('');
  const revenueBars = rows.map((row, index) => {
    const x = xAt(index) - 21;
    const y = yRevenue(row.revenue);
    return `<rect x="${x}" y="${y}" width="42" height="${top + plotHeight - y}" rx="3" class="chart-bar-revenue"/><text x="${xAt(index)}" y="${Math.max(top + 12, y - 7)}" text-anchor="middle" class="chart-value">${row.revenue.toFixed(1)}</text>`;
  }).join('');
  const grossPoints = rows.map((row, index) => `${xAt(index)},${yGross(row.grossMargin)}`).join(' ');
  const grossLine = `<polyline points="${grossPoints}" class="chart-line-gross"/>${rows.map((row, index) => `<circle cx="${xAt(index)}" cy="${yGross(row.grossMargin)}" r="4" class="chart-dot-gross"/><text x="${xAt(index)}" y="${Math.max(top + 10, yGross(row.grossMargin) - 9)}" text-anchor="middle" class="chart-value chart-value-gross">${row.grossMargin.toFixed(1)}%</text>`).join('')}`;

  const cashBars = rows.map((row, index) => {
    const center = xAt(index);
    const cfoY = yCash(row.operatingCashFlow);
    const fcfY = yCash(row.freeCashFlow);
    return `<rect x="${center - 24}" y="${cfoY}" width="20" height="${top + plotHeight - cfoY}" rx="2" class="chart-bar-cfo"/><rect x="${center + 4}" y="${fcfY}" width="20" height="${top + plotHeight - fcfY}" rx="2" class="chart-bar-fcf"/><text x="${center - 14}" y="${Math.max(top + 12, cfoY - 7)}" text-anchor="middle" class="chart-value">${row.operatingCashFlow.toFixed(1)}</text><text x="${center + 14}" y="${Math.max(top + 12, fcfY - 7)}" text-anchor="middle" class="chart-value">${row.freeCashFlow.toFixed(1)}</text>`;
  }).join('');
  const capexPoints = rows.map((row, index) => `${xAt(index)},${yCapex(row.capex)}`).join(' ');
  const capexLine = `<polyline points="${capexPoints}" class="chart-line-capex"/>${rows.map((row, index) => `<circle cx="${xAt(index)}" cy="${yCapex(row.capex)}" r="4" class="chart-dot-capex"/><text x="${xAt(index)}" y="${Math.max(top + 10, yCapex(row.capex) - 9)}" text-anchor="middle" class="chart-value chart-value-capex">${row.capex.toFixed(1)}</text>`).join('')}`;

  return `<div class="profitability-visual" aria-label="盈利能力趋势图">
<section class="profitability-chart"><div class="chart-heading"><strong>营收与毛利率</strong><span>亿元 / %</span></div><div class="chart-legend"><span><i class="legend-revenue"></i>营业收入</span><span><i class="legend-gross"></i>毛利率</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="营业收入柱状图与毛利率折线图">${chartGrid({ left, top, width: plotWidth, height: plotHeight, max: revenueMax })}${revenueBars}${grossLine}${periodLabels}<text x="${width - 4}" y="${top + 4}" text-anchor="end" class="chart-axis-label">毛利率 ${grossMin.toFixed(0)}%–${grossMax.toFixed(0)}%</text></svg></section>
<section class="profitability-chart"><div class="chart-heading"><strong>现金创造与再投资</strong><span>亿元</span></div><div class="chart-legend"><span><i class="legend-cfo"></i>经营现金流</span><span><i class="legend-fcf"></i>自由现金流</span><span><i class="legend-capex"></i>资本开支</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="经营现金流、自由现金流柱状图与资本开支折线图">${chartGrid({ left, top, width: plotWidth, height: plotHeight, max: cashMax })}${cashBars}${capexLine}${periodLabels}<text x="${width - 4}" y="${top + 4}" text-anchor="end" class="chart-axis-label">资本开支 0–${capexMax.toFixed(1)}</text></svg></section>
<p class="chart-note">注：2026H1 为半年度数据，不与完整年度线性比较；自由现金流和资本开支为报告口径近似值。</p>
</div>`;
}

function transformProfitabilityTable(markdown) {
  const sectionMatch = markdown.match(/(^### 3\.4 盈利能力\s*$)([\s\S]*?)(?=^### 3\.5 业绩兑现\s*$)/m);
  if (!sectionMatch) return markdown;

  const lines = sectionMatch[2].split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('| 期间 |') && line.includes('营业收入') && line.includes('毛利率'));
  if (headerIndex < 0) return markdown;
  let tableEnd = headerIndex;
  while (tableEnd < lines.length && lines[tableEnd].trim().startsWith('|')) tableEnd += 1;

  const headers = parseTableCells(lines[headerIndex]);
  const indexOf = (text) => headers.findIndex((header) => header.includes(text));
  const indexes = {
    period: indexOf('期间'),
    revenue: indexOf('营业收入'),
    grossMargin: indexOf('毛利率'),
    operatingCashFlow: indexOf('经营现金流'),
    capex: indexOf('资本开支'),
    freeCashFlow: indexOf('自由现金流'),
  };
  if (Object.values(indexes).some((index) => index < 0)) return markdown;

  const rows = lines.slice(headerIndex + 2, tableEnd).map(parseTableCells).map((cells) => ({
    period: cells[indexes.period],
    revenue: parseNumber(cells[indexes.revenue]),
    grossMargin: parseNumber(cells[indexes.grossMargin]),
    operatingCashFlow: parseNumber(cells[indexes.operatingCashFlow]),
    capex: parseNumber(cells[indexes.capex]),
    freeCashFlow: parseNumber(cells[indexes.freeCashFlow]),
  })).filter((row) => row.period && Object.values(row).slice(1).every(Number.isFinite));
  if (rows.length < 2) return markdown;

  lines.splice(headerIndex, tableEnd - headerIndex, buildProfitabilityVisual(rows));
  const transformedSection = `${sectionMatch[1]}${lines.join('\n')}`;
  return markdown.replace(sectionMatch[0], transformedSection);
}

function validateStructure(markdown) {
  const expectedH2 = ['1. 产业研究', '2. 行业研究', '3. 公司研究', '4. 投资价值'];
  const expectedH3 = [
    '1.1 产业战略地位',
    '1.2 长期成长空间',
    '1.3 产业投资生命周期',
    '2.1 行业景气周期',
    '2.2 行业竞争格局',
    '2.3 核心矛盾与边际变化',
    '3.1 竞争地位',
    '3.2 核心竞争壁垒',
    '3.3 市场份额',
    '3.4 盈利能力',
    '3.5 业绩兑现',
    '3.6 第二增长曲线',
    '4.1 估值',
    '4.2 市场预期',
    '4.3 预期差',
    '4.4 风险收益比',
  ];
  const actualH2 = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const actualH3 = [...markdown.matchAll(/^###\s+(.+)$/gm)].map((match) => match[1].trim());
  if (JSON.stringify(actualH2) !== JSON.stringify(expectedH2)) {
    throw new Error(`一级目录必须严格对应产业思维框架，当前识别为：${actualH2.join(' / ') || '无'}。`);
  }
  if (JSON.stringify(actualH3) !== JSON.stringify(expectedH3)) {
    throw new Error(`二级目录必须严格对应产业思维框架，当前识别为：${actualH3.join(' / ') || '无'}。`);
  }
  for (const marker of ['产业跟踪资格', '公司筛选资格', '当前投资资格', '候选池动作']) {
    if (!markdown.includes(marker)) throw new Error(`报告缺少最终决策字段：${marker}`);
  }
}

function cleanAuditCell(value) {
  return value.replace(/\*\*|`/g, '').replace(/<br\s*\/?>/gi, ' ').trim();
}

function validateFreshnessAudit(markdown) {
  const match = markdown.match(/\*\*数据源新鲜度审计\*\*\s*([\s\S]*?)(?=\n\*\*声明\*\*|\n##\s|$)/);
  if (!match) throw new Error('报告缺少“数据源新鲜度审计”。');
  if (!/报告截止日[：:]/.test(match[1])) throw new Error('数据源新鲜度审计缺少报告截止日。');

  const lines = match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('|') &&
    ['指标 / 证据', '发布频率', '报告使用期', '截止日最新可得期', '发布 / 获取日期', '来源', '审计结果']
      .every((header) => line.includes(header)));
  if (headerIndex < 0) throw new Error('数据源新鲜度审计表头不完整。');

  const rows = lines.slice(headerIndex + 2).filter((line) => line.startsWith('|') && line.endsWith('|'));
  if (rows.length === 0) throw new Error('数据源新鲜度审计没有数据行。');

  const allowedStatuses = new Set(['通过', '证据不足', '不适用']);
  for (const row of rows) {
    const cells = row.slice(1, -1).split('|').map(cleanAuditCell);
    if (cells.length !== 7 || cells.slice(0, 6).some((cell) => !cell)) {
      throw new Error(`数据源新鲜度审计行不完整：${row}`);
    }
    const status = cells[6];
    if (status === '滞后') throw new Error(`数据源新鲜度审计未通过，存在滞后项：${cells[0]}`);
    if (!allowedStatuses.has(status)) throw new Error(`数据源新鲜度审计状态无效：${status}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const vaultRoot = path.resolve(args['vault-root']);
  const source = fs.readFileSync(inputPath, 'utf8');
  if (source.includes('\uFFFD')) throw new Error('输入 Markdown 含替换字符，停止导出。');

  let markdown = stripFrontmatter(source);
  validateStructure(markdown);
  validateFreshnessAudit(markdown);
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(inputPath, '.md');
  const analysisDate = extractBoldField(markdown, '分析日期', '未获取');
  const cutoff = extractBoldField(markdown, '数据截止日期', '未获取');
  const scope = extractBoldField(markdown, '目标产业口径', '未获取');
  markdown = markdown.replace(/^#\s+.+\r?\n/, '');
  markdown = transformProfitabilityTable(markdown);
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  const { converted, toc } = sectionize(markdown);
  const body = loadMarked().parse(converted, { gfm: true, breaks: false });
  const tocHtml = toc.map(({ id, title: heading, level }) =>
    `<a class="toc-l${level}" href="#${id}">${escapeHtml(heading)}</a>`).join('\n');

  const css = `:root{--ink:#18221f;--muted:#64706b;--line:#d5ddd8;--paper:#fff;--wash:#f3f5f3;--forest:#174d3c;--teal:#19756e;--rust:#a75534;--gold:#b28a43;--shadow:0 10px 28px rgba(24,34,31,.09)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.72}.hero{background:var(--forest);color:#fff;padding:48px 7vw 42px;border-bottom:7px solid var(--gold)}.hero-inner{max-width:1180px;margin:auto}.eyebrow{font-size:13px;letter-spacing:.12em;color:#d8e7e0}.hero h1{margin:10px 0 14px;font-family:"Noto Serif SC","Songti SC",serif;font-size:clamp(32px,5vw,58px);line-height:1.18;letter-spacing:0}.meta{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;color:#e3eee9}.scope{max-width:920px;margin-top:14px;color:#d8e7e0;font-size:14px}.layout{display:grid;grid-template-columns:250px minmax(0,900px);gap:30px;max-width:1230px;margin:30px auto;padding:0 24px 68px}.toc{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px;box-shadow:var(--shadow)}.toc-title{font-weight:700;color:var(--forest);margin-bottom:10px}.toc a{display:block;color:#46564f;text-decoration:none;border-left:2px solid transparent;padding:5px 8px;font-size:13px}.toc a:hover{color:var(--teal);border-color:var(--teal);background:#f0f6f3}.toc-l3{margin-left:12px}.report{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:40px 46px;box-shadow:var(--shadow);min-width:0}h2{font-family:"Noto Serif SC","Songti SC",serif;color:var(--forest);font-size:29px;margin:52px 0 21px;padding-bottom:9px;border-bottom:2px solid #bdd0c7;letter-spacing:0}h2:first-of-type{margin-top:0}h3{color:#276154;font-size:20px;margin:34px 0 15px;letter-spacing:0}h4{color:#3a5148;font-size:17px;letter-spacing:0}.anchor{opacity:0;margin-left:8px;text-decoration:none;color:var(--teal);font-weight:400}h2:hover .anchor,h3:hover .anchor{opacity:.55}p{margin:10px 0 16px}strong{color:#193d31}blockquote{margin:22px 0;padding:16px 20px;border-left:4px solid var(--rust);background:#fbf4ef;color:#37413d;border-radius:0 6px 6px 0}table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:14px;display:block;overflow-x:auto}thead{background:#e8f0ec;color:#174d3c}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;min-width:100px}tbody tr:nth-child(even){background:#fafcfb}tbody tr:hover{background:#f0f6f3}code{font-family:"Cascadia Code",Consolas,monospace;background:#edf1ef;border-radius:4px;padding:.12em .35em;font-size:.9em}pre{background:#1d2d27;color:#e8f1ed;padding:18px 20px;border-radius:8px;overflow:auto;line-height:1.55}pre code{background:transparent;padding:0;color:inherit}a{color:#176e69;text-underline-offset:3px}hr{border:0;border-top:1px solid var(--line);margin:36px 0}ul,ol{padding-left:1.45em}li{margin:5px 0}.profitability-visual{display:grid;grid-template-columns:1fr;gap:18px;margin:20px 0 28px}.profitability-chart{border:1px solid var(--line);border-radius:8px;padding:18px;background:#fbfcfb;overflow:hidden}.chart-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.chart-heading strong{font-size:16px}.chart-heading span{font-size:12px;color:var(--muted)}.chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 2px;color:#52615b;font-size:12px}.chart-legend span{display:inline-flex;align-items:center;gap:6px}.chart-legend i{display:inline-block;width:12px;height:4px;border-radius:2px}.legend-revenue{background:#19756e}.legend-gross{background:#b28a43}.legend-cfo{background:#174d3c}.legend-fcf{background:#4f9d8d}.legend-capex{background:#a75534}.profitability-chart svg{display:block;width:100%;height:auto;min-width:560px}.profitability-chart{overflow-x:auto}.chart-grid{stroke:#dfe6e2;stroke-width:1}.chart-axis-label,.chart-period,.chart-value{fill:#63716b;font-size:11px}.chart-value{fill:#2a3b35;font-weight:600}.chart-value-gross{fill:#8b692f}.chart-value-capex{fill:#8e482f}.chart-bar-revenue{fill:#19756e}.chart-bar-cfo{fill:#174d3c}.chart-bar-fcf{fill:#4f9d8d}.chart-line-gross,.chart-line-capex{fill:none;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.chart-line-gross{stroke:#b28a43}.chart-dot-gross{fill:#fff;stroke:#b28a43;stroke-width:3}.chart-line-capex{stroke:#a75534}.chart-dot-capex{fill:#fff;stroke:#a75534;stroke-width:3}.chart-note{grid-column:1/-1;margin:0;color:var(--muted);font-size:12px}.footer{color:var(--muted);text-align:center;font-size:13px;padding:22px}@media(min-width:1180px){.profitability-visual{grid-template-columns:1fr 1fr}.profitability-chart svg{min-width:0}.chart-note{grid-column:1/-1}}@media(max-width:900px){.layout{grid-template-columns:1fr;padding:0 12px 48px}.toc{position:relative;top:0;max-height:none}.report{padding:27px 19px}.hero{padding:38px 22px}.hero h1{font-size:34px}h2{font-size:24px}table{font-size:13px}.profitability-chart{padding:14px}.profitability-chart svg{min-width:620px}}@media print{body{background:#fff}.hero{padding:24px 0;background:#fff;color:#111;border-bottom:2px solid #333}.scope,.meta{color:#333}.layout{display:block;margin:0;padding:0}.toc{display:none}.report{box-shadow:none;border:0;padding:20px 0}a{color:inherit;text-decoration:none}table{display:table;font-size:10px}.profitability-visual{display:block}.profitability-chart{break-inside:avoid;margin-bottom:12px}.profitability-chart svg{min-width:0}h2{break-before:page}h2:first-of-type{break-before:auto}.footer{display:none}}`;

  const html = `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="${escapeHtml(title)}，数据截止${escapeHtml(cutoff)}">\n<title>${escapeHtml(title)}</title>\n<style>${css}</style>\n</head>\n<body>\n<header class="hero"><div class="hero-inner"><div class="eyebrow">EQUITY INDUSTRY RESEARCH · 产业思维</div><h1>${escapeHtml(title)}</h1><div class="meta"><span>分析日期：${escapeHtml(analysisDate)}</span><span>数据截止：${escapeHtml(cutoff)}</span></div><div class="scope">产业口径：${escapeHtml(scope)}</div></div></header>\n<div class="layout"><nav class="toc" aria-label="报告目录"><div class="toc-title">报告目录</div>${tocHtml}</nav><main class="report">${body}</main></div>\n<footer class="footer">基于公开资料整理，用于产业研究和候选池管理，不构成投资建议。</footer>\n</body>\n</html>\n`;

  if (/\[\[|\uFFFD|12\?24|\?\?/.test(html)) throw new Error('HTML编码或双链转换检查失败。');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generated ${outputPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { transformProfitabilityTable, validateFreshnessAudit, validateStructure };
