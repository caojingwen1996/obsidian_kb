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

function normalizeObsidianLinks(markdown, outputPath, vaultRoot) {
  return markdown.replace(/!?(\[\[)([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (full, _open, target, anchor, label) => {
    if (full.startsWith('!')) return escapeHtml(label || target);
    const normalizedTarget = target.trim().replace(/\\/g, '/');
    const sourcePath = path.resolve(vaultRoot, normalizedTarget.endsWith('.md') ? normalizedTarget : `${normalizedTarget}.md`);
    const htmlTarget = sourcePath.replace(/\.md$/i, '.html');
    let relative = path.relative(path.dirname(outputPath), htmlTarget).replace(/\\/g, '/');
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
      <div class="verdict">${escapeHtml(valuation)} · ${escapeHtml(action)}</div>
      <div class="kpis">
        <div class="kpi"><span class="kpi-value">${escapeHtml(price)}</span><span class="kpi-label">当前价格</span></div>
        <div class="kpi"><span class="kpi-value">${escapeHtml(fairValue)}</span><span class="kpi-label">综合估值区间</span></div>
        <div class="kpi"><span class="kpi-value">${escapeHtml(action)}</span><span class="kpi-label">冰冰小美动作</span></div>
        <div class="kpi"><span class="kpi-value">${escapeHtml(confidence)}</span><span class="kpi-label">结论置信度</span></div>
      </div>
    </header>
    <div class="layout">
      <aside class="toc"><div class="toc-inner"><p class="toc-title">Report contents</p>${toc}</div></aside>
      <article class="content">${body}</article>
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
