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

function validateStructure(markdown) {
  const numbered = [...markdown.matchAll(/^##\s+([0-7])\.\s+/gm)].map((match) => Number(match[1]));
  if (numbered.length !== 8 || numbered.some((value, index) => value !== index)) {
    throw new Error(`个股产业思维报告必须依次包含0—7章，当前识别为：${numbered.join(', ') || '无'}。`);
  }
  for (const marker of ['产业跟踪资格', '公司筛选资格', '当前投资资格', '候选池动作']) {
    if (!markdown.includes(marker)) throw new Error(`报告缺少最终决策字段：${marker}`);
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
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(inputPath, '.md');
  const analysisDate = extractBoldField(markdown, '分析日期', '未获取');
  const cutoff = extractBoldField(markdown, '数据截止日期', '未获取');
  const scope = extractBoldField(markdown, '目标产业口径', '未获取');
  markdown = markdown.replace(/^#\s+.+\r?\n/, '');
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  const { converted, toc } = sectionize(markdown);
  const body = loadMarked().parse(converted, { gfm: true, breaks: false });
  const tocHtml = toc.map(({ id, title: heading, level }) =>
    `<a class="toc-l${level}" href="#${id}">${escapeHtml(heading)}</a>`).join('\n');

  const css = `:root{--ink:#18221f;--muted:#64706b;--line:#d5ddd8;--paper:#fff;--wash:#f3f5f3;--forest:#174d3c;--teal:#19756e;--rust:#a75534;--gold:#b28a43;--shadow:0 10px 28px rgba(24,34,31,.09)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.72}.hero{background:var(--forest);color:#fff;padding:48px 7vw 42px;border-bottom:7px solid var(--gold)}.hero-inner{max-width:1180px;margin:auto}.eyebrow{font-size:13px;letter-spacing:.12em;color:#d8e7e0}.hero h1{margin:10px 0 14px;font-family:"Noto Serif SC","Songti SC",serif;font-size:clamp(32px,5vw,58px);line-height:1.18;letter-spacing:0}.meta{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;color:#e3eee9}.scope{max-width:920px;margin-top:14px;color:#d8e7e0;font-size:14px}.layout{display:grid;grid-template-columns:250px minmax(0,900px);gap:30px;max-width:1230px;margin:30px auto;padding:0 24px 68px}.toc{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px;box-shadow:var(--shadow)}.toc-title{font-weight:700;color:var(--forest);margin-bottom:10px}.toc a{display:block;color:#46564f;text-decoration:none;border-left:2px solid transparent;padding:5px 8px;font-size:13px}.toc a:hover{color:var(--teal);border-color:var(--teal);background:#f0f6f3}.toc-l3{margin-left:12px}.report{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:40px 46px;box-shadow:var(--shadow);min-width:0}h2{font-family:"Noto Serif SC","Songti SC",serif;color:var(--forest);font-size:29px;margin:52px 0 21px;padding-bottom:9px;border-bottom:2px solid #bdd0c7;letter-spacing:0}h2:first-of-type{margin-top:0}h3{color:#276154;font-size:20px;margin:34px 0 15px;letter-spacing:0}h4{color:#3a5148;font-size:17px;letter-spacing:0}.anchor{opacity:0;margin-left:8px;text-decoration:none;color:var(--teal);font-weight:400}h2:hover .anchor,h3:hover .anchor{opacity:.55}p{margin:10px 0 16px}strong{color:#193d31}blockquote{margin:22px 0;padding:16px 20px;border-left:4px solid var(--rust);background:#fbf4ef;color:#37413d;border-radius:0 6px 6px 0}table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:14px;display:block;overflow-x:auto}thead{background:#e8f0ec;color:#174d3c}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;min-width:100px}tbody tr:nth-child(even){background:#fafcfb}tbody tr:hover{background:#f0f6f3}code{font-family:"Cascadia Code",Consolas,monospace;background:#edf1ef;border-radius:4px;padding:.12em .35em;font-size:.9em}pre{background:#1d2d27;color:#e8f1ed;padding:18px 20px;border-radius:8px;overflow:auto;line-height:1.55}pre code{background:transparent;padding:0;color:inherit}a{color:#176e69;text-underline-offset:3px}hr{border:0;border-top:1px solid var(--line);margin:36px 0}ul,ol{padding-left:1.45em}li{margin:5px 0}.footer{color:var(--muted);text-align:center;font-size:13px;padding:22px}@media(max-width:900px){.layout{grid-template-columns:1fr;padding:0 12px 48px}.toc{position:relative;top:0;max-height:none}.report{padding:27px 19px}.hero{padding:38px 22px}.hero h1{font-size:34px}h2{font-size:24px}table{font-size:13px}}@media print{body{background:#fff}.hero{padding:24px 0;background:#fff;color:#111;border-bottom:2px solid #333}.scope,.meta{color:#333}.layout{display:block;margin:0;padding:0}.toc{display:none}.report{box-shadow:none;border:0;padding:20px 0}a{color:inherit;text-decoration:none}table{display:table;font-size:10px}h2{break-before:page}h2:first-of-type{break-before:auto}.footer{display:none}}`;

  const html = `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="${escapeHtml(title)}，数据截止${escapeHtml(cutoff)}">\n<title>${escapeHtml(title)}</title>\n<style>${css}</style>\n</head>\n<body>\n<header class="hero"><div class="hero-inner"><div class="eyebrow">EQUITY INDUSTRY RESEARCH · 产业思维</div><h1>${escapeHtml(title)}</h1><div class="meta"><span>分析日期：${escapeHtml(analysisDate)}</span><span>数据截止：${escapeHtml(cutoff)}</span></div><div class="scope">产业口径：${escapeHtml(scope)}</div></div></header>\n<div class="layout"><nav class="toc" aria-label="报告目录"><div class="toc-title">报告目录</div>${tocHtml}</nav><main class="report">${body}</main></div>\n<footer class="footer">基于公开资料整理，用于产业研究和候选池管理，不构成投资建议。</footer>\n</body>\n</html>\n`;

  if (/\[\[|\uFFFD|12\?24|\?\?/.test(html)) throw new Error('HTML编码或双链转换检查失败。');
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
