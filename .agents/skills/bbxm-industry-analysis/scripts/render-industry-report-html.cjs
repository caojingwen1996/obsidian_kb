const fs = require('node:fs');
const path = require('node:path');

const LIFECYCLE_CSS = `
.industry-lifecycle{margin:18px 0 28px;border:1px solid #cfdbe3;border-radius:10px;background:#f9fbfc;padding:20px;box-shadow:0 8px 24px rgba(23,59,87,.08);break-inside:avoid}
.lifecycle-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.lifecycle-head>div:first-child{display:grid;gap:2px}
.lifecycle-head>div:first-child>span{color:#667085;font-size:11px;font-weight:800}
.lifecycle-head h4{margin:0;color:#173b57;font-size:20px}
.lifecycle-position{display:grid;justify-items:end;gap:1px;text-align:right}
.lifecycle-position span,.lifecycle-position small{color:#667085;font-size:11px}
.lifecycle-position strong{color:#173b57;font-size:14px}
.lifecycle-stages{display:grid;grid-template-columns:repeat(var(--stage-count),minmax(180px,1fr));gap:4px;overflow-x:auto;padding-bottom:4px}
.lifecycle-stage{--stage-color:#3d7694;position:relative;min-height:132px;margin:0;border-top:4px solid var(--stage-color);background:#edf3f6;padding:13px 20px 13px 24px;clip-path:polygon(0 0,calc(100% - 13px) 0,100% 50%,calc(100% - 13px) 100%,0 100%,13px 50%)}
.lifecycle-stage:nth-child(4n+2){--stage-color:#17857f}
.lifecycle-stage:nth-child(4n+3){--stage-color:#c77a2c}
.lifecycle-stage:nth-child(4n){--stage-color:#4f845f}
.lifecycle-stage.is-current{background:var(--stage-color);color:#fff}
.lifecycle-stage.is-current strong,.lifecycle-stage.is-current p,.lifecycle-stage.is-current small,.lifecycle-stage.is-current b{color:#fff}
.lifecycle-stage.is-past{opacity:.82}
.lifecycle-stage.is-future{background:#f1f3f5}
.lifecycle-stage.is-uncertain{background:#fff;border-top-style:dashed}
.lifecycle-stage-kicker{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;color:#526472;font-size:10px}
.lifecycle-stage-kicker b{color:var(--stage-color);font-size:10px}
.lifecycle-stage>strong{display:block;color:#173b57;font-size:13px}
.lifecycle-stage>small{display:block;margin-top:2px;color:#667085;font-size:10px}
.lifecycle-stage>p{margin:7px 0 0;color:#425466;font-size:11px;line-height:1.45}
.lifecycle-events-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:20px;color:#667085;font-size:11px}
.lifecycle-events-head strong{color:#425466;font-size:11px}
.lifecycle-track{position:relative;display:flex;gap:14px;overflow-x:auto;padding:10px 2px 8px}
.lifecycle-event-line{position:absolute;top:22px;left:2px;right:2px;height:2px;background:#b9cbd6}
.lifecycle-event{position:relative;flex:1 0 190px;padding-top:27px}
.lifecycle-event-node{position:absolute;top:15px;left:16px;width:14px;height:14px;border:3px solid #fff;border-radius:50%;background:#3d7694;box-shadow:0 0 0 2px #3d7694}
.lifecycle-event.is-inference .lifecycle-event-node{background:#c77a2c;box-shadow:0 0 0 2px #c77a2c}
.lifecycle-event.is-unverified .lifecycle-event-node{background:#98a2ad;box-shadow:0 0 0 2px #98a2ad}
.lifecycle-event-card{min-height:132px;border:1px solid #d6e0e6;border-radius:7px;background:#fff;padding:11px 12px}
.lifecycle-event-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;color:#667085;font-size:10px}
.lifecycle-event-meta span{border-radius:99px;background:#edf3f6;padding:2px 6px}
.lifecycle-event-card>strong{display:block;color:#173b57;font-size:12px;line-height:1.45}
.lifecycle-event-card>p{margin:6px 0;color:#425466;font-size:11px;line-height:1.5}
.lifecycle-event-card>small{display:block;color:#667085;font-size:10px;line-height:1.45}
.lifecycle-current-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:14px;border:1px solid #d6e0e6;border-radius:8px;background:#fff}
.lifecycle-current-grid>div{min-width:0;padding:12px 14px;border-right:1px solid #e1e7ec}
.lifecycle-current-grid>div:last-child{border-right:0}
.lifecycle-current-grid span{display:block;margin-bottom:4px;color:#667085;font-size:10px;font-weight:800}
.lifecycle-current-grid strong,.lifecycle-current-grid p{margin:0;color:#263d4d;font-size:11px;line-height:1.5}
.lifecycle-signals{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.lifecycle-signals>div{display:flex;align-items:center;gap:6px;border:1px solid #d6e0e6;border-radius:6px;background:#f4f7f9;padding:5px 8px;font-size:10px}
.lifecycle-signals span{color:#667085}
.lifecycle-signals strong{color:#173b57}
.lifecycle-empty{margin:10px 0;color:#667085;font-size:11px}
@media(max-width:700px){.industry-lifecycle{padding:15px 14px}.lifecycle-head{flex-direction:column}.lifecycle-position{justify-items:start;text-align:left}.lifecycle-stages{grid-template-columns:1fr;overflow:visible}.lifecycle-stage{min-height:0;clip-path:none;border-top:0;border-left:4px solid var(--stage-color);padding:12px 14px}.lifecycle-track{display:grid;gap:12px;overflow:visible;padding:12px 0 4px 24px}.lifecycle-event-line{top:12px;bottom:4px;left:7px;right:auto;width:2px;height:auto}.lifecycle-event{padding-top:0}.lifecycle-event-node{top:14px;left:-23px}.lifecycle-current-grid{grid-template-columns:1fr}.lifecycle-current-grid>div{border-right:0;border-bottom:1px solid #e1e7ec}.lifecycle-current-grid>div:last-child{border-bottom:0}}
@media print{.industry-lifecycle{box-shadow:none}.lifecycle-stages,.lifecycle-track{overflow:visible}.lifecycle-event{flex-basis:150px}.lifecycle-stage,.lifecycle-event-card,.lifecycle-current-grid{break-inside:avoid}}
`;

const INDUSTRY_CHAIN_CSS = `
.industry-chain-visual{margin:18px 0 28px;border:1px solid #d4dee5;border-radius:10px;background:#f8fafb;padding:20px;box-shadow:0 8px 24px rgba(23,59,87,.08);break-inside:avoid}
.chain-visual-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.chain-visual-head>div:first-child{display:grid;gap:2px}
.chain-visual-head span{color:#667085;font-size:11px;font-weight:800}
.chain-visual-head h4{margin:0;color:#173b57;font-size:20px}
.chain-visual-summary{display:grid;justify-items:end;text-align:right}
.chain-visual-summary strong{color:#173b57;font-size:14px}
.chain-visual-summary small{color:#667085;font-size:11px}
.chain-flow-wrap{overflow-x:auto;padding-bottom:4px}
.chain-flow{display:grid;grid-template-columns:minmax(190px,1fr) 34px minmax(190px,1fr) 34px minmax(190px,1fr);align-items:start;min-width:700px}
.chain-column{--chain-color:#2f7ed8;--chain-wash:#eef5ff;min-width:0}
.chain-column.is-middle{--chain-color:#25936f;--chain-wash:#edf8f4}
.chain-column.is-downstream{--chain-color:#dc812c;--chain-wash:#fff5e9}
.chain-column-head{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:4px solid var(--chain-color);background:var(--chain-wash);padding:10px 12px}
.chain-column-head strong{color:#243746;font-size:13px}
.chain-column-head span{border-radius:99px;background:#fff;color:var(--chain-color);padding:2px 7px;font-size:10px;font-weight:800}
.chain-nodes{display:grid;gap:8px;padding-top:9px}
.chain-node{min-height:116px;border:1px solid #d7e0e6;border-left:3px solid var(--chain-color);border-radius:7px;background:#fff;padding:10px 11px}
.chain-node>strong{display:block;color:#1e3443;font-size:12px;line-height:1.4}
.chain-node>p{margin:5px 0 8px;color:#526472;font-size:10px;line-height:1.45}
.chain-node-tags{display:flex;flex-wrap:wrap;gap:5px}
.chain-node-tags span{border-radius:4px;background:var(--chain-wash);color:#435766;padding:2px 5px;font-size:9px}
.chain-node-detail{display:block;margin-top:5px;color:#526472;font-size:10px;line-height:1.5;overflow-wrap:anywhere}
.chain-node-status{display:block;margin-top:7px;border-top:1px solid #edf0f2;padding-top:6px;color:#667085;font-size:9px;line-height:1.4}
.chain-arrow{display:grid;align-content:start;justify-items:center;gap:4px;padding-top:13px;color:#7b8f9d}
.chain-arrow b{font-size:23px;line-height:1;color:#5f88a2}
.chain-arrow small{font-size:9px;line-height:1.25;text-align:center;writing-mode:vertical-rl}
.chain-value-strip{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:10px;margin-top:16px;border-top:1px solid #dce4e9;padding-top:14px}
.chain-value-strip div{min-width:0;background:#fff;padding:9px 10px;text-align:center}
.chain-value-strip span{display:block;color:#667085;font-size:9px}
.chain-value-strip strong{display:block;color:#263d4d;font-size:11px}
.chain-value-strip b{color:#78909f;font-size:16px}
.chain-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:11px;color:#667085;font-size:9px}
.chain-legend span{display:flex;align-items:center;gap:5px}
.chain-legend i{width:8px;height:8px;border-radius:2px;background:#2f7ed8}
.chain-legend span:nth-child(2) i{background:#25936f}
.chain-legend span:nth-child(3) i{background:#dc812c}
@media(max-width:700px){.industry-chain-visual{padding:15px 14px}.chain-visual-head{flex-direction:column}.chain-visual-summary{justify-items:start;text-align:left}.chain-flow{grid-template-columns:1fr;min-width:0;gap:8px}.chain-arrow{padding:0;display:flex;justify-content:center;align-items:center}.chain-arrow b{transform:rotate(90deg)}.chain-arrow small{writing-mode:horizontal-tb}.chain-value-strip{grid-template-columns:1fr}.chain-value-strip b{transform:rotate(90deg);justify-self:center}.chain-node{min-height:0}}
@media print{.industry-chain-visual{box-shadow:none}.chain-flow-wrap{overflow:visible}.chain-flow{min-width:0}.chain-node{break-inside:avoid}}
`;

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

function usesExtendedEvidence(markdown) {
  return markdown.includes('<!-- industry-research:v2.1 -->') || isIndustrySectorReport(markdown);
}

function isIndustrySectorReport(markdown) {
  return /<!-- industry-research:v3\.[0123] -->/.test(markdown);
}

function normalizeObsidianLinks(markdown, outputPath, vaultRoot) {
  const requireExistingTargets = usesExtendedEvidence(markdown);
  return markdown.replace(/!?(\[\[)([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (full, _open, target, anchor, label) => {
    if (full.startsWith('!')) return escapeHtml(label || target);
    const normalized = target.trim().replace(/\\/g, '/');
    const extension = path.extname(normalized);
    const sourceName = extension ? normalized : `${normalized}.md`;
    const candidates = [path.resolve(vaultRoot, sourceName), path.resolve(vaultRoot, 'wiki', sourceName)];
    const sourcePath = candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
    const isWorkbenchReport = normalized.startsWith('workbench/targets/');
    const htmlPath = sourcePath.replace(/\.md$/i, '.html');
    const linkedPath = isWorkbenchReport || (fs.existsSync(sourcePath) && !fs.existsSync(htmlPath)) ? sourcePath : htmlPath;
    if (requireExistingTargets && !fs.existsSync(linkedPath)) {
      throw new Error(`报告引用的本地链接不存在：${target}`);
    }
    let relative = path.relative(path.dirname(outputPath), linkedPath).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    if (anchor) relative += `#${encodeURIComponent(anchor.trim())}`;
    return `<a href="${escapeHtml(relative)}">${escapeHtml((label || path.basename(normalized)).trim())}</a>`;
  });
}

function sectionize(markdown) {
  const toc = [];
  let sequence = 0;
  const showConclusion = /<!-- industry-research:v3\.[23] -->/.test(markdown);
  const converted = markdown.replace(/^(##|###|####)\s+(.+)$/gm, (full, hashes, rawTitle) => {
    const title = rawTitle.trim();
    const level = hashes.length;
    if (level === 4 && (!showConclusion || !/^6\.1\.[12] /.test(title))) return full;
    // Keep existing chapter anchors stable when adding conclusion subheadings.
    const id = level === 4 ? `section-${sequence}-${title.split(' ')[0].split('.').pop()}` : `section-${++sequence}`;
    toc.push({ id, title, level });
    return `<h${level} id="${id}">${escapeHtml(title)}<a class="anchor" href="#${id}" aria-label="链接到本节">#</a></h${level}>`;
  });
  return { converted, toc };
}

function validateStructure(markdown) {
  const numbered = [...markdown.matchAll(/^##\s+(\d+)\.\s+/gm)].map((match) => Number(match[1]));
  if (isIndustrySectorReport(markdown)) {
    const version = markdown.match(/<!-- industry-research:(v3\.[0123]) -->/)[1];
    const expected = [0, 1, 2, 3, 4, 5, 6];
    if (numbered.length !== expected.length || numbered.some((value, index) => value !== expected[index])) {
      throw new Error(`产业与行业研究报告必须依次包含0—6章，当前识别为：${numbered.join(', ') || '无'}。`);
    }
    const requiredMarkers = ['## 1. 产业战略地位', '## 2. 长期成长空间', '### 2.1 产业边界与 TAM', '### 2.7 新旧需求变化与情景', '## 3. 产业投资生命周期', '### 3.1 阶段轨道与当前定位', '## 4. 产业维度结论', '## 5. 行业研究', '### 5.1 行业划分与候选清单', '### 5.2 需求传导与景气证据', '### 5.3 行业景气判断', '### 5.4 行业竞争格局', '### 5.5 核心矛盾与边际变化', '## 6. 综合判断与持续跟踪', '### 6.1 行业比较与研究优先级', '### 6.2 进入公司研究的条件', '### 6.3 持续跟踪与重估条件', '# 证据与边界附录', '**观察窗口：**', '**比较窗口：**', '**原文与归纳边界：**', '<!-- industry-chain:start -->', '<!-- industry-chain:end -->', '<!-- industry-lifecycle:start -->', '<!-- industry-lifecycle:end -->'];
    if (version === 'v3.3') requiredMarkers.push('### 1.1 全球环境与中国国情', '### 1.2 国家战略形成与政策落地', '### 1.3 资源配置与国家比较优势', '### 1.4 战略地位结论', '**战略证据链最高确认环节：**', '**证据链首个断点：**', '**是否属于未来重点发展的产业方向：**');
    for (const marker of requiredMarkers) {
      const expectedMarker = ['v3.2', 'v3.3'].includes(version) && marker === '### 6.2 进入公司研究的条件' ? '### 6.2 后续公司研究清单' : marker;
      if (!markdown.includes(expectedMarker)) throw new Error(`产业与行业研究报告缺少 ${version} 模板契约：${expectedMarker}`);
    }
    if (version === 'v3.3') {
      const strategicHeadings = ['### 1.1 全球环境与中国国情', '### 1.2 国家战略形成与政策落地', '### 1.3 资源配置与国家比较优势', '### 1.4 战略地位结论'];
      const positions = strategicHeadings.map(heading => markdown.indexOf(heading));
      if (positions.some((position, index) => index && position < positions[index - 1])) {
        throw new Error('产业战略地位必须按全球环境与中国国情、国家战略与政策、资源配置与比较优势、战略结论的顺序展开。');
      }
    }
    const companyOrInvestmentSection = /^#{2,4}\s+(?:\d+(?:\.\d+)*[.、]?\s+)?(?:公司研究|公司竞争优势|个股估值|估值与投资建议|最新估值观察|买卖建议|产业链公司映射)(?:\s|$)/m;
    if (companyOrInvestmentSection.test(markdown)) throw new Error('产业与行业研究报告包含公司或投资价值层的越界章节。');
    return;
  }
  const isIndustryLayerOnly = markdown.includes('## 1. 产业战略地位');

  if (isIndustryLayerOnly) {
    const expected = [0, 1, 2, 3, 4];
    if (numbered.length !== expected.length || numbered.some((value, index) => value !== expected[index])) {
      throw new Error(`产业维度报告必须依次包含0—4章，当前识别为：${numbered.join(', ') || '无'}。`);
    }
    for (const marker of ['## 2. 长期成长空间', '### 2.1 产业边界与 TAM', '## 3. 产业投资生命周期', '### 3.1 阶段轨道与当前定位', '## 4. 产业维度结论', '# 证据与边界附录']) {
      if (!markdown.includes(marker)) throw new Error(`产业维度报告缺少模板契约：${marker}`);
    }
    if (markdown.includes('<!-- industry-research:v2.1 -->')) {
      for (const marker of ['**观察窗口：**', '**比较窗口：**', '**原文与归纳边界：**', '### 2.7 新旧需求变化与情景', '### 4.2 向行业研究交接', '### 4.3 持续跟踪与重估条件', '<!-- industry-chain:start -->', '<!-- industry-chain:end -->', '<!-- industry-lifecycle:start -->', '<!-- industry-lifecycle:end -->']) {
        if (!markdown.includes(marker)) throw new Error(`产业维度报告缺少 v2.1 模板契约：${marker}`);
      }
    }
    for (const forbidden of [/^#{2,4}\s+.*行业景气周期/m, /^#{2,4}\s+.*行业利润周期/m, /^#{2,4}\s+.*产业链公司映射/m, /^#{2,4}\s+.*最新估值观察/m]) {
      if (forbidden.test(markdown)) throw new Error(`产业维度报告包含越界章节：${forbidden.source}`);
    }
    return;
  }

  if (numbered.length !== 8 || numbered.some((value, index) => value !== index)) {
    throw new Error(`旧版产业报告必须依次包含0—7章，当前识别为：${numbered.join(', ') || '无'}。`);
  }
  const companyMappingHeading = markdown.includes('### 3.1 产业空间与天花板')
    ? '### 3.2.1 产业链公司映射'
    : '### 3.1.1 产业链公司映射';
  for (const marker of [companyMappingHeading, '业务占比或纯度', '证据状态']) {
    if (!markdown.includes(marker)) throw new Error(`旧版产业报告缺少公司映射契约：${marker}`);
  }
}

function tableCellText(cell) {
  return String(cell?.text ?? '').trim();
}

function tableRecords(table) {
  const headers = table.header.map(tableCellText);
  return table.rows.map(row => Object.fromEntries(headers.map((header, index) => [header, tableCellText(row[index])])));
}

function findTable(tokens, requiredHeaders) {
  return tokens.find(token => token.type === 'table'
    && requiredHeaders.every(header => token.header.some(cell => tableCellText(cell) === header)));
}

function validateSectorTables(markdown, marked) {
  if (!isIndustrySectorReport(markdown)) return;
  const tokens = marked.lexer(markdown, { gfm: true });
  const candidateHeaders = ['行业／产品与地域', '产品与客户', '本轮变化及传导路径', '已有证据与日期', '待验证项／失效条件', '初筛'];
  const requiredTables = [
    candidateHeaders,
    ['行业／产品与地域', '景气水平', '变化方向', '主导原因', '持续条件', '反证', '证据与缺口', '置信度'],
  ];
  const hasRelativeComparison = /<!-- industry-research:v3\.[123] -->/.test(markdown);
  if (!hasRelativeComparison) requiredTables.push(['行业／产品与地域', '景气水平', '变化方向', '竞争与利润留存', '持续性与反证', '证据质量／缺口', '研究优先级与理由']);
  for (const headers of requiredTables) {
    if (!findTable(tokens, headers)) throw new Error(`行业研究缺少候选、景气或比较表的必填字段：${headers.join('、')}`);
  }
  if (markdown.includes('<!-- industry-research:v3.3 -->')) {
    const strategicSection = extractLevelThreeSection(markdown, /^### 1\.1 全球环境与中国国情\s*$/m)
      + extractLevelThreeSection(markdown, /^### 1\.2 国家战略形成与政策落地\s*$/m)
      + extractLevelThreeSection(markdown, /^### 1\.3 资源配置与国家比较优势\s*$/m);
    const strategicTokens = marked.lexer(strategicSection, { gfm: true });
    const strategicTables = [
      { headers: ['分析层级', '当前事实与核心矛盾', '与本产业的直接关系', '关键指标与统计口径', '数据时间／第一信息源', '证据性质'], rows: ['全球环境', '中国国情'] },
      { headers: ['证据层级', '当前状态／最高确认环节', '核心证据与正式程度', '政策工具、作用对象与执行主体', '对本产业的直接作用', '数据时间／第一信息源', '尚未打通的下一环节'], rows: ['战略酝酿', '国家战略形成', '政策落地', '产业政策落地'] },
      { headers: ['资源配置类型', '当前状态／实际配置', '核心证据与金额、项目或要素口径', '作用对象与本产业归属', '数据时间／第一信息源', '尚未落实部分／边界'], rows: ['财政', '金融', '产业资本', '生产要素'] },
      { headers: ['比较优势维度', '中国已证实的优势', '主要短板与外部依赖', '全球比较口径与证据', '能否承接及条件', '优势失效条件'] },
    ];
    for (const definition of strategicTables) {
      const table = findTable(strategicTokens, definition.headers);
      if (!table) throw new Error(`产业战略地位缺少必填证据表：${definition.headers.join('、')}`);
      if (definition.rows) {
        const labels = table.rows.map(row => tableCellText(row[0]));
        if (definition.rows.some(row => !labels.includes(row))) throw new Error(`产业战略地位证据链缺少固定层级：${definition.rows.join('、')}`);
      }
    }
  }
  if (!hasRelativeComparison) return;
  const comparisonSection = extractLevelThreeSection(markdown, /^### 6\.1 行业比较与研究优先级\s*$/m);
  const comparisonTokens = marked.lexer(comparisonSection, { gfm: true });
  const comparisonHeaders = ['比较编号', '比较对象与研究问题', '可比边界与窗口', '决定性差异及证据', '相对选择与代价', '置信度与限制', '选择逆转条件'];
  const arrangementHeaders = ['行业／产品与地域', '对应比较或不比较原因', '研究任务类型', '最终安排', '相对理由与初筛调整', '下一关键证据'];
  for (const headers of [comparisonHeaders, arrangementHeaders]) {
    if (!findTable(comparisonTokens, headers)) throw new Error(`6.1 缺少横向比较或研究安排表的必填字段：${headers.join('、')}`);
  }
  const candidates = tableRecords(findTable(tokens, candidateHeaders)).map(row => row['行业／产品与地域']);
  const arrangements = tableRecords(findTable(comparisonTokens, arrangementHeaders)).map(row => row['行业／产品与地域']);
  if (candidates.length !== arrangements.length || new Set(arrangements).size !== arrangements.length || candidates.some(candidate => !arrangements.includes(candidate))) {
    throw new Error('6.1 研究安排必须与 5.1 全部初筛候选逐项对应，不能遗漏、重复或新增候选。');
  }
  if (!/<!-- industry-research:v3\.[23] -->/.test(markdown)) return;
  if (!/^#### 6\.1\.2 最终结论：行业选择与研究安排\s*$/m.test(comparisonSection)) {
    throw new Error('6.1.2 缺少最终结论标题：最终结论：行业选择与研究安排');
  }
  const handoffSection = extractLevelThreeSection(markdown, /^### 6\.2 后续公司研究清单\s*$/m);
  const handoffHeaders = ['承接的行业方向', '具体公司的验证问题', '需要的公司级证据', '继续研究或暂缓条件'];
  const handoffTable = findTable(marked.lexer(handoffSection, { gfm: true }), handoffHeaders);
  const eligible = tableRecords(findTable(comparisonTokens, arrangementHeaders))
    .filter(row => row['研究任务类型'].includes('经营候选深入')).map(row => row['行业／产品与地域']);
  if (!handoffTable) {
    if (!eligible.length && handoffSection.includes('当前无公司研究交接项')) return;
    throw new Error('6.2 缺少公司级研究清单；无交接项时须明确说明，且与 6.1.2 安排一致。');
  }
  const handoffRows = tableRecords(handoffTable);
  const directions = handoffRows.map(row => row['承接的行业方向']);
  if (!directions.length || new Set(directions).size !== directions.length || directions.length !== eligible.length || eligible.some(item => !directions.includes(item)) || handoffRows.some(row => handoffHeaders.some(header => !row[header]))) {
    throw new Error('6.2 仅逐项承接 6.1.2 经营候选深入方向，并填写公司问题、公司证据和研究条件，不重列行业缺口或观察清单。');
  }
}

function extractHeadingSection(markdown, headingPattern) {
  const match = headingPattern.exec(markdown);
  if (!match) return '';
  const bodyStart = match.index + match[0].length;
  const remainder = markdown.slice(bodyStart);
  const nextHeading = remainder.search(/^#{1,4}\s+/m);
  return nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
}

function extractLevelThreeSection(markdown, headingPattern) {
  const match = headingPattern.exec(markdown);
  if (!match) return '';
  const bodyStart = match.index + match[0].length;
  const remainder = markdown.slice(bodyStart);
  const nextHeading = remainder.search(/^###\s+/m);
  return nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
}

function normalizeStageName(value) {
  return String(value ?? '').replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').replace(/\s+/g, '').trim();
}

function loadFrameworkLifecycleStages(vaultRoot, marked) {
  const frameworkPath = path.join(vaultRoot, 'wiki', 'concepts', '冰冰小美-framework-产业思维.md');
  const framework = fs.readFileSync(frameworkPath, 'utf8');
  const section = extractHeadingSection(framework, /^####\s+产业投资生命周期\s*$/m);
  const table = findTable(marked.lexer(section, { gfm: true }), ['阶段', '关注点', '核心特征', '关键观察指标']);
  if (!table) throw new Error('知识库主框架缺少可解析的产业投资生命周期详细定义表。');
  const stages = tableRecords(table).map(row => row['阶段']).filter(Boolean);
  if (!stages.length) throw new Error('知识库主框架的产业投资生命周期详细定义表为空。');
  return stages;
}

function lifecycleStateClass(value) {
  const state = normalizeStageName(value);
  if (state === '当前') return 'is-current';
  if (state === '已经历') return 'is-past';
  if (state === '待验证') return 'is-uncertain';
  return 'is-future';
}

function inlineMarkdown(marked, value) {
  return marked.parseInline(String(value ?? ''), { gfm: true });
}

function renderIndustryChain(markdown, marked) {
  const blockPattern = /<!--\s*industry-chain:start\s*-->([\s\S]*?)<!--\s*industry-chain:end\s*-->/;
  const blockMatch = markdown.match(blockPattern);
  if (!blockMatch) return markdown;

  const table = findTable(marked.lexer(blockMatch[1], { gfm: true }), [
    '层级',
    '子环节',
    '产品或服务',
    '解决的需求或约束',
    '价值分配',
    '技术或资源壁垒',
    '代表主体类型',
    '证据状态',
  ]);
  if (!table) throw new Error('产业链图数据缺少标准产业结构表。');
  if (usesExtendedEvidence(markdown)) {
    for (const header of ['上游投入', '客户与付费主体', '本轮变化', '来源与日期']) {
      if (!table.header.some(cell => tableCellText(cell) === header)) {
        throw new Error(`产业链图数据缺少必填字段：${header}`);
      }
    }
  }

  const records = tableRecords(table).filter(row => row['子环节']);
  const groups = [
    { key: '上游', className: 'is-upstream', label: '上游供给', flow: '关键能力供给' },
    { key: '中游', className: 'is-middle', label: '中游制造与交付', flow: '工程产品交付' },
    { key: '下游', className: 'is-downstream', label: '下游运营与应用', flow: '持续服务兑现' },
  ].map(group => ({
    ...group,
    rows: records.filter(row => normalizeStageName(row['层级']).includes(group.key)),
  }));

  if (groups.some(group => !group.rows.length)) {
    throw new Error('产业链图必须同时包含上游、中游和下游环节。');
  }

  const columns = groups.map((group, groupIndex) => {
    const nodes = group.rows.map(row => {
      const details = [
        ['上游投入', '投入'],
        ['客户与付费主体', '客户与付费主体'],
        ['解决的需求或约束', '作用'],
        ['本轮变化', '本轮变化'],
        ['代表主体类型', '主体'],
        ['来源与日期', '来源与日期'],
      ].filter(([key]) => row[key]).map(([key, label]) => `<small class="chain-node-detail">${label}：${inlineMarkdown(marked, row[key])}</small>`).join('');
      return `<article class="chain-node">
        <strong>${inlineMarkdown(marked, row['子环节'])}</strong>
        <p>${inlineMarkdown(marked, row['产品或服务'] || '产品或服务待验证')}</p>
        <div class="chain-node-tags"><span>价值 ${inlineMarkdown(marked, row['价值分配'] || '待验证')}</span><span>壁垒 ${inlineMarkdown(marked, row['技术或资源壁垒'] || '待验证')}</span></div>
        ${details}
        <small class="chain-node-status">${inlineMarkdown(marked, row['证据状态'] || '证据状态待验证')}</small>
      </article>`;
    }).join('');
    const arrow = groupIndex < groups.length - 1
      ? '<div class="chain-arrow" aria-hidden="true"><b>→</b><small>能力传导</small></div>'
      : '';
    return `<section class="chain-column ${group.className}">
      <header class="chain-column-head"><strong>${group.label}</strong><span>${group.rows.length} 个环节</span></header>
      <div class="chain-nodes">${nodes}</div>
    </section>${arrow}`;
  }).join('');

  const visualization = `<style>${INDUSTRY_CHAIN_CSS}</style><section class="industry-chain-visual" aria-label="产业链环节图">
    <header class="chain-visual-head">
      <div><span>INDUSTRY CHAIN</span><h4>产业链环节全景</h4></div>
      <div class="chain-visual-summary"><span>已识别环节</span><strong>${records.length} 个</strong><small>按纵向价值创造顺序排列</small></div>
    </header>
    <div class="chain-flow-wrap"><div class="chain-flow">${columns}</div></div>
    <div class="chain-value-strip">
      <div><span>上游</span><strong>${groups[0].flow}</strong></div><b>→</b>
      <div><span>中游</span><strong>${groups[1].flow}</strong></div><b>→</b>
      <div><span>下游</span><strong>${groups[2].flow}</strong></div>
    </div>
    <div class="chain-legend"><span><i></i>上游供给</span><span><i></i>中游制造与交付</span><span><i></i>下游运营与应用</span></div>
  </section>`.replace(/\n\s*/g, '');

  return markdown.replace(blockPattern, visualization);
}

function renderIndustryLifecycle(markdown, vaultRoot, marked) {
  const blockPattern = /<!--\s*industry-lifecycle:start\s*-->([\s\S]*?)<!--\s*industry-lifecycle:end\s*-->/;
  const blockMatch = markdown.match(blockPattern);
  if (!blockMatch) return markdown;

  const blockTokens = marked.lexer(blockMatch[1], { gfm: true });
  const stageTable = findTable(blockTokens, ['阶段序号', '阶段名称', '阶段状态', '时间范围', '当前判断', '核心证据', '下一阶段条件', '主要风险', '置信度']);
  const eventTable = findTable(blockTokens, ['时间', '所属阶段', '事件', '证据性质', '影响', '来源']);
  if (!stageTable || !eventTable) throw new Error('产业投资生命周期图数据缺少阶段轨道表或关键证据节点表。');
  if (usesExtendedEvidence(markdown) && !stageTable.header.some(cell => tableCellText(cell) === '过渡特征')) {
    throw new Error('产业投资生命周期图数据缺少必填字段：过渡特征');
  }

  const stages = tableRecords(stageTable);
  const events = tableRecords(eventTable).filter(row => row['事件']);
  const frameworkStages = loadFrameworkLifecycleStages(vaultRoot, marked);
  const renderedStageNames = stages.map(row => row['阶段名称']);
  const namesMatch = renderedStageNames.length === frameworkStages.length
    && renderedStageNames.every((name, index) => normalizeStageName(name) === normalizeStageName(frameworkStages[index]));
  if (!namesMatch) {
    throw new Error(`生命周期阶段必须与知识库详细定义表一致。知识库：${frameworkStages.join('、')}；报告：${renderedStageNames.join('、') || '无'}。`);
  }

  const currentStages = stages.filter(row => normalizeStageName(row['阶段状态']) === '当前');
  if (currentStages.length > 1) throw new Error('产业投资生命周期图最多只能有一个“当前”阶段。');
  const current = currentStages[0] ?? null;

  const allowedStates = new Set(['已经历', '当前', '未进入', '待验证']);
  for (const stage of stages) {
    if (!allowedStates.has(normalizeStageName(stage['阶段状态']))) {
      throw new Error(`生命周期阶段“${stage['阶段名称']}”使用了无效状态：${stage['阶段状态']}。`);
    }
  }

  for (const event of events) {
    if (event['所属阶段'] && !frameworkStages.some(stage => normalizeStageName(stage) === normalizeStageName(event['所属阶段']))) {
      throw new Error(`生命周期证据节点引用了知识库中不存在的阶段：${event['所属阶段']}。`);
    }
  }

  const lifecycleSection = extractLevelThreeSection(markdown, /^###\s+(?:5\.4\s+产业投资生命周期|3\.1\s+阶段轨道与当前定位)\s*$/m);
  const analysisTable = findTable(marked.lexer(lifecycleSection, { gfm: true }), ['分析项', '当前判断', '核心证据', '下一阶段条件', '主要风险']);
  const signals = analysisTable
    ? tableRecords(analysisTable).filter(row => row['分析项'] && row['当前判断'] && row['分析项'] !== '综合生命周期')
    : [];

  const stagesHtml = stages.map((stage, index) => {
    const stateClass = lifecycleStateClass(stage['阶段状态']);
    const currentAttribute = stateClass === 'is-current' ? ' aria-current="step"' : '';
    return `<article class="lifecycle-stage ${stateClass}"${currentAttribute}>
      <div class="lifecycle-stage-kicker"><span>${inlineMarkdown(marked, stage['阶段序号'] || `S${index + 1}`)}</span><b>${inlineMarkdown(marked, stage['阶段状态'])}</b></div>
      <strong>${inlineMarkdown(marked, stage['阶段名称'])}</strong>
      <small>${inlineMarkdown(marked, stage['时间范围'] || '时间待验证')}</small>
      <p>${inlineMarkdown(marked, stage['当前判断'] || '尚无阶段判断')}</p>
      ${stage['过渡特征'] ? `<p>过渡特征：${inlineMarkdown(marked, stage['过渡特征'])}</p>` : ''}
    </article>`;
  }).join('');

  const eventsHtml = events.length ? events.map(event => {
    const evidenceClass = ['事实', '已核实事实'].includes(normalizeStageName(event['证据性质']))
      ? 'is-fact'
      : normalizeStageName(event['证据性质']) === '待验证' ? 'is-unverified' : 'is-inference';
    return `<article class="lifecycle-event ${evidenceClass}">
      <div class="lifecycle-event-node" aria-hidden="true"></div>
      <div class="lifecycle-event-card">
        <div class="lifecycle-event-meta"><time>${inlineMarkdown(marked, event['时间'] || '待验证')}</time><span>${inlineMarkdown(marked, event['证据性质'] || '待验证')}</span></div>
        <strong>${inlineMarkdown(marked, event['事件'])}</strong>
        <p>${inlineMarkdown(marked, event['影响'] || '')}</p>
        <small>${inlineMarkdown(marked, event['所属阶段'])}${event['来源'] ? ` · ${inlineMarkdown(marked, event['来源'])}` : ''}</small>
      </div>
    </article>`;
  }).join('') : '<p class="lifecycle-empty">关键证据节点待验证。</p>';

  const currentHtml = current ? `<div class="lifecycle-current-grid">
    <div><span>当前判断</span><strong>${inlineMarkdown(marked, current['当前判断'] || current['阶段名称'])}</strong></div>
    <div><span>核心证据</span><p>${inlineMarkdown(marked, current['核心证据'] || '待验证')}</p></div>
    <div><span>下一阶段条件</span><p>${inlineMarkdown(marked, current['下一阶段条件'] || '待验证')}</p></div>
    <div><span>主要风险</span><p>${inlineMarkdown(marked, current['主要风险'] || '待验证')}</p></div>
  </div>` : '<p class="lifecycle-empty">当前生命周期阶段证据不足，暂不定位。</p>';

  const signalsHtml = signals.length ? `<div class="lifecycle-signals" aria-label="生命周期信号">
    ${signals.map(signal => `<div><span>${inlineMarkdown(marked, signal['分析项'])}</span><strong>${inlineMarkdown(marked, signal['当前判断'])}</strong></div>`).join('')}
  </div>` : '';

  const visualization = `<style>${LIFECYCLE_CSS}</style><section class="industry-lifecycle" aria-label="产业投资生命周期图">
    <header class="lifecycle-head">
      <div><span>INDUSTRY LIFECYCLE</span><h4>产业投资生命周期</h4></div>
      <div class="lifecycle-position"><span>当前主阶段</span><strong>${current ? inlineMarkdown(marked, current['阶段名称']) : '待验证'}</strong><small>置信度：${current ? inlineMarkdown(marked, current['置信度'] || '待验证') : '待验证'}</small></div>
    </header>
    <div class="lifecycle-stages" style="--stage-count:${stages.length}">${stagesHtml}</div>
    <div class="lifecycle-events-head"><span>关键证据节点</span><strong>阶段判断必须由可追踪证据支持</strong></div>
    <div class="lifecycle-track"><div class="lifecycle-event-line" aria-hidden="true"></div>${eventsHtml}</div>
    ${currentHtml}
    ${signalsHtml}
  </section>`.replace(/\n\s*/g, '');

  return markdown.replace(blockPattern, visualization);
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
  const marked = loadMarked();
  markdown = normalizeObsidianLinks(markdown, outputPath, vaultRoot);
  validateSectorTables(markdown, marked);
  markdown = renderIndustryChain(markdown, marked);
  markdown = renderIndustryLifecycle(markdown, vaultRoot, marked);
  const { converted, toc } = sectionize(markdown);
  const body = marked.parse(converted, { gfm: true, breaks: false });
  const tocHtml = toc.map(({ id, title: heading, level }) =>
    `<a class="toc-l${level}" href="#${id}">${escapeHtml(heading)}</a>`).join('\n');

  const css = `:root{--ink:#18212b;--muted:#667085;--line:#d9e0e7;--paper:#fff;--wash:#f4f7f9;--navy:#173b57;--blue:#256b91;--gold:#b78231;--shadow:0 12px 34px rgba(23,59,87,.10)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.72}.hero{background:linear-gradient(125deg,#102f47,#1f5879 68%,#a6752a);color:#fff;padding:54px 7vw 48px}.hero-inner{max-width:1180px;margin:auto}.eyebrow{font-size:13px;letter-spacing:.18em;opacity:.78}.hero h1{margin:10px 0 14px;font-family:"Noto Serif SC","Songti SC",serif;font-size:clamp(34px,5vw,64px);line-height:1.15}.meta{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;opacity:.86}.layout{display:grid;grid-template-columns:260px minmax(0,880px);gap:34px;max-width:1230px;margin:32px auto;padding:0 24px 70px}.toc{position:sticky;top:20px;align-self:start;max-height:calc(100vh - 40px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow)}.toc-title{font-weight:700;color:var(--navy);margin-bottom:10px}.toc a{display:block;color:#425466;text-decoration:none;border-left:2px solid transparent;padding:5px 8px;font-size:13px}.toc a:hover{color:var(--blue);border-color:var(--blue);background:#f2f7fa}.toc-l3{margin-left:12px;opacity:.88}.toc-l4{margin-left:24px;font-weight:600}.report{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:42px 48px;box-shadow:var(--shadow);min-width:0}h2{font-family:"Noto Serif SC","Songti SC",serif;color:var(--navy);font-size:30px;margin:54px 0 22px;padding-bottom:10px;border-bottom:2px solid #bed0dc}h2:first-of-type{margin-top:0}h3{color:#214e69;font-size:21px;margin:36px 0 16px}h4{color:#324a5b;font-size:17px}.anchor{opacity:0;margin-left:8px;text-decoration:none;color:var(--blue);font-weight:400}h2:hover .anchor,h3:hover .anchor,h4:hover .anchor{opacity:.55}p{margin:10px 0 16px}strong{color:#142f43}blockquote{margin:22px 0;padding:16px 20px;border-left:4px solid var(--gold);background:#fbf7ee;color:#374151;border-radius:0 8px 8px 0}table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:14px;display:block;overflow-x:auto}thead{background:#eaf1f5;color:#173b57}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;min-width:100px}tbody tr:nth-child(even){background:#fafcfd}tbody tr:hover{background:#f2f7fa}code{font-family:"Cascadia Code",Consolas,monospace;background:#eef2f5;border-radius:4px;padding:.12em .35em;font-size:.9em}pre{background:#142733;color:#e8f1f5;padding:18px 20px;border-radius:10px;overflow:auto;line-height:1.55}pre code{background:transparent;padding:0;color:inherit}a{color:#176b96;text-underline-offset:3px}hr{border:0;border-top:1px solid var(--line);margin:36px 0}ul,ol{padding-left:1.45em}li{margin:5px 0}.footer{color:var(--muted);text-align:center;font-size:13px;padding:22px}@media(max-width:900px){.layout{grid-template-columns:1fr;padding:0 12px 50px}.toc{position:relative;top:0;max-height:none}.report{padding:28px 20px}.hero{padding:42px 24px}h2{font-size:25px}}@media print{body{background:#fff}.hero{padding:24px 0;background:#fff;color:#111;border-bottom:2px solid #333}.layout{display:block;margin:0;padding:0}.toc{display:none}.report{box-shadow:none;border:0;padding:20px 0}a{color:inherit;text-decoration:none}table{display:table;font-size:10px}h2{break-before:page}h2:first-of-type{break-before:auto}.footer{display:none}}`;

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
