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

function cleanInline(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

function extractFrontmatter(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm'));
  return cleanInline(match?.[1]);
}

function extractMetadata(markdown) {
  const fields = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^>\s*([^：:]+)[：:]\s*(.*?)\s{0,2}$/);
    if (match) fields[match[1].trim()] = cleanInline(match[2]);
  }
  return fields;
}

function extractSummary(markdown) {
  const summary = {};
  const chapterOne = markdown.match(/^## 1\. 一句话结论\s*$([\s\S]*?)(?=^## 2\.|\Z)/m)?.[1] ?? '';
  for (const line of chapterOne.split(/\r?\n/)) {
    const match = line.match(/^[-*]\s*([^：:]+)[：:]\s*(.+)$/);
    if (match) summary[cleanInline(match[1])] = cleanInline(match[2]);
  }

  const chapterTwo = markdown.match(/^## 2\. 三要素状态总表\s*$([\s\S]*?)(?=^## 3\.|\Z)/m)?.[1] ?? '';
  for (const line of chapterTwo.split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map(cleanInline);
    if (cells.length >= 2 && !/^[-:]+$/.test(cells[0]) && cells[0] !== '要素') {
      summary[cells[0]] = cells[1];
      if (cells[4]) summary[`${cells[0]}置信度`] = cells[4];
    }
  }

  const confidence = markdown.match(/^[-*]\s*总体置信度[：:]\s*(.+)$/m)?.[1];
  if (confidence) summary['总体置信度'] = cleanInline(confidence);
  return summary;
}

function statusClass(value) {
  if (/证据不足/.test(value)) return 'unknown';
  if (/尚未形成有利共振|部分有利/.test(value)) return 'neutral';
  if (/同步不利|不利/.test(value)) return 'negative';
  if (/同步有利|有利/.test(value)) return 'positive';
  return 'neutral';
}

function renderSummaryCards(summary) {
  const liquidityDirection = summary['流动性辩证分析'] || '未获取';
  const liquidityStage = summary['流动性阶段'];
  const liquiditySummary = liquidityStage ? `${liquidityDirection} / ${liquidityStage}` : liquidityDirection;
  const cards = [
    ['综合状态', summary['综合状态'] || '未获取'],
    ['竞争格局', summary['竞争格局'] || '未获取'],
    ['流动性', liquiditySummary],
    ['情绪位置', summary['情绪位置变化'] || '未获取'],
    ['总体置信度', summary['总体置信度'] || '未获取'],
  ];
  return `<section class="factor-summary" aria-label="三要素摘要">
    ${cards.map(([label, value]) => `<div class="factor-card ${statusClass(value)}"><p>${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong></div>`).join('\n    ')}
  </section>`;
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

function renderResearchNotes(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!note\]\s*研究提示<\/p>\s*([\s\S]*?)<\/blockquote>/g,
    '<aside class="research-note" aria-label="研究提示"><p class="research-note-title">研究提示</p>$1</aside>',
  );
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const vaultRoot = path.resolve(args['vault-root']);
  const cssPath = path.resolve(__dirname, '..', 'assets', 'report.css');
  const source = fs.readFileSync(inputPath, 'utf8');
  if (source.includes('\uFFFD')) throw new Error('输入 Markdown 含替换字符，停止导出。');

  let markdown = stripFrontmatter(source);
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(inputPath, '.md');
  const metadata = extractMetadata(markdown);
  const summary = extractSummary(markdown);
  markdown = markdown.replace(/^#\s+.+\r?\n/, '');
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  const sectioned = sectionize(markdown);
  if (sectioned.sections.length !== 9) {
    throw new Error(`报告必须包含 9 个编号章节，当前为 ${sectioned.sections.length} 个。`);
  }

  const marked = loadMarked();
  const body = renderResearchNotes(marked.parse(sectioned.markdown, { gfm: true, breaks: false }));
  const css = fs.readFileSync(cssPath, 'utf8');
  const toc = sectioned.sections.map(({ id, label }) => `<a class="toc-link" href="#${id}">${escapeHtml(label)}</a>`).join('\n');
  const cards = renderSummaryCards(summary);
  const bodyWithCards = body.includes('</blockquote>') ? body.replace('</blockquote>', `</blockquote>\n${cards}`) : `${cards}\n${body}`;
  const level = metadata['对象层级'] || extractFrontmatter(source, 'object_level') || '对象层级未获取';
  const market = metadata['市场'] || extractFrontmatter(source, 'market') || '市场未获取';
  const cutoff = metadata['分析截止时间'] || extractFrontmatter(source, 'as_of') || '分析截止时间未获取';
  const generated = metadata['报告生成时间'] || '报告生成时间未获取';

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
      <p class="eyebrow">BBXM THREE-FACTOR ANALYSIS</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="hero-meta"><span>${escapeHtml(level)}</span><span>${escapeHtml(market)}</span><span>${escapeHtml(cutoff)}</span><span>${escapeHtml(generated)}</span></div>
    </header>
    <div class="layout">
      <aside class="toc"><div class="toc-inner"><p class="toc-title">Report contents</p>${toc}</div></aside>
      <article class="content">${bodyWithCards}</article>
    </div>
  </main>
</body>
</html>\n`;

  if (/\[\[|\[!note\]|\uFFFD|12\?24|\?\?/.test(html)) throw new Error('HTML 编码、Callout 或双链转换检查失败。');
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
