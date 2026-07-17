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
    const sourcePath = path.resolve(vaultRoot, extension ? normalized : `${normalized}.md`);
    const linkedPath = sourcePath.replace(/\.md$/i, '.html');
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
    throw new Error(`产业报告必须依次包含0—7章，当前识别为：${numbered.join(', ') || '无'}。`);
  }
  for (const marker of ['### 3.1.1 产业链公司映射', '业务占比或纯度', '证据状态']) {
    if (!markdown.includes(marker)) throw new Error(`产业报告缺少公司映射契约：${marker}`);
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
  const region = extractBoldField(markdown, '地域范围', '未获取');
  markdown = markdown.replace(/^#\s+.+\r?\n/, '');
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  const { converted, toc } = sectionize(markdown);
  const body = loadMarked().parse(converted, { gfm: true, breaks: false });
  const tocHtml = toc.map(({ id, title: heading, level }) =>
    `<a class="toc-l${level}" href="#${id}">${escapeHtml(heading)}</a>`).join('\n');

  const css = `:root{--ink:#18212b;--muted:#667085;--line:#d9e0e7;--paper:#fff;--wash:#f4f7f9;--navy:#173b57;--blue:#256b91;--gold:#b78231;--shadow:0 12px 34px rgba(23,59,87,.10)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.72}.hero{background:linear-gradient(125deg,#102f47,#1f5879 68%,#a6752a);color:#fff;padding:54px 7vw 48px}.hero-inner{max-width:1180px;margin:auto}.eyebrow{font-size:13px;letter-spacing:.18em;opacity:.78}.hero h1{margin:10px 0 14px;font-family:"Noto Serif SC","Songti SC",serif;font-size:clamp(34px,5vw,64px);line-height:1.15}.meta{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;opacity:.86}.layout{display:grid;grid-template-columns:260px minmax(0,880px);gap:34px;max-width:1230px;margin:32px auto;padding:0 24px 70px}.toc{position:sticky;top:20px;align-self:start;max-height:calc(100vh - 40px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow)}.toc-title{font-weight:700;color:var(--navy);margin-bottom:10px}.toc a{display:block;color:#425466;text-decoration:none;border-left:2px solid transparent;padding:5px 8px;font-size:13px}.toc a:hover{color:var(--blue);border-color:var(--blue);background:#f2f7fa}.toc-l3{margin-left:12px;opacity:.88}.report{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:42px 48px;box-shadow:var(--shadow);min-width:0}h2{font-family:"Noto Serif SC","Songti SC",serif;color:var(--navy);font-size:30px;margin:54px 0 22px;padding-bottom:10px;border-bottom:2px solid #bed0dc}h2:first-of-type{margin-top:0}h3{color:#214e69;font-size:21px;margin:36px 0 16px}h4{color:#324a5b;font-size:17px}.anchor{opacity:0;margin-left:8px;text-decoration:none;color:var(--blue);font-weight:400}h2:hover .anchor,h3:hover .anchor{opacity:.55}p{margin:10px 0 16px}strong{color:#142f43}blockquote{margin:22px 0;padding:16px 20px;border-left:4px solid var(--gold);background:#fbf7ee;color:#374151;border-radius:0 8px 8px 0}table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:14px;display:block;overflow-x:auto}thead{background:#eaf1f5;color:#173b57}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;min-width:100px}tbody tr:nth-child(even){background:#fafcfd}tbody tr:hover{background:#f2f7fa}code{font-family:"Cascadia Code",Consolas,monospace;background:#eef2f5;border-radius:4px;padding:.12em .35em;font-size:.9em}pre{background:#142733;color:#e8f1f5;padding:18px 20px;border-radius:10px;overflow:auto;line-height:1.55}pre code{background:transparent;padding:0;color:inherit}a{color:#176b96;text-underline-offset:3px}hr{border:0;border-top:1px solid var(--line);margin:36px 0}ul,ol{padding-left:1.45em}li{margin:5px 0}.footer{color:var(--muted);text-align:center;font-size:13px;padding:22px}@media(max-width:900px){.layout{grid-template-columns:1fr;padding:0 12px 50px}.toc{position:relative;top:0;max-height:none}.report{padding:28px 20px}.hero{padding:42px 24px}h2{font-size:25px}}@media print{body{background:#fff}.hero{padding:24px 0;background:#fff;color:#111;border-bottom:2px solid #333}.layout{display:block;margin:0;padding:0}.toc{display:none}.report{box-shadow:none;border:0;padding:20px 0}a{color:inherit;text-decoration:none}table{display:table;font-size:10px}h2{break-before:page}h2:first-of-type{break-before:auto}.footer{display:none}}`;

  const html = `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="${escapeHtml(title)}，数据截止${escapeHtml(cutoff)}">\n<title>${escapeHtml(title)}</title>\n<style>${css}</style>\n</head>\n<body>\n<header class="hero"><div class="hero-inner"><div class="eyebrow">INDUSTRY RESEARCH · 产业思维</div><h1>${escapeHtml(title)}</h1><div class="meta"><span>分析日期：${escapeHtml(analysisDate)}</span><span>数据截止：${escapeHtml(cutoff)}</span><span>${escapeHtml(region)}</span></div></div></header>\n<div class="layout"><nav class="toc" aria-label="报告目录"><div class="toc-title">报告目录</div>${tocHtml}</nav><main class="report">${body}</main></div>\n<footer class="footer">基于公开资料整理，不构成投资建议。</footer>\n</body>\n</html>\n`;

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
