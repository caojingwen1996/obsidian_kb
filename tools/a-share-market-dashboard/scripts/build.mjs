import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');
const sourceDir = join(root, 'src');
const outputPath = join(root, 'a-share-market-dashboard.html');
const moduleOrder = ['core.mjs', 'adapters.mjs', 'data-service.mjs', 'app.mjs'];
const strategicResourceDir = join(repoRoot, 'sources', 'automations', '战略资源');
const commercialSpaceDir = join(repoRoot, 'sources', 'automations', '商业航天');
const pillarDir = join(repoRoot, 'sources', 'automations', '支柱产业');
const electricGridDir = join(repoRoot, 'sources', 'automations', '电网产业');

const htmlEscapeMap = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => htmlEscapeMap.get(char));
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.html$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function timeFromFilename(filename) {
  const timed = filename.match(/^\d{4}-\d{2}-\d{2}-(\d{2})(\d{2})-/);
  if (timed) return `${timed[1]}:${timed[2]}`;
  const dated = filename.match(/^\d{4}-(\d{2})-(\d{2})-/);
  if (dated) return `${dated[1]}-${dated[2]}`;
  return '—';
}

async function readReportFilenames(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(filename => filename.endsWith('.html'))
    .filter(filename => !filename.includes('完整分析报告'))
    .sort((left, right) => right.localeCompare(left, 'zh-CN'));
}

function renderReportCards(reports, options) {
  return reports.map(filename => {
    const title = titleFromFilename(filename);
    const type = title.includes('资金面') ? '资金面' : '研报';
    const href = `../../sources/automations/${options.directoryName}/${filename}`;
    const filters = typeof options.filters === 'function' ? options.filters(title) : options.filters;
    const label = typeof options.label === 'function' ? options.label(title) : options.label;
    const tagPrefix = typeof options.tagPrefix === 'function' ? options.tagPrefix(title) : options.tagPrefix;
    return `              <article class="industry-report" data-filters="${escapeHtml(filters)}">
                <span class="industry-time">${escapeHtml(timeFromFilename(filename))}</span><span class="industry-dot"></span>
                <div class="industry-report-meta"><span>${escapeHtml(label)} <b>${escapeHtml(type)}</b></span><span>自动</span></div>
                <h3><a class="industry-report-link" href="${escapeHtml(href)}">${escapeHtml(title)}</a></h3>
                <p>从${escapeHtml(options.directoryName)}目录自动读取，点击标题打开对应 HTML 研报。</p>
                <div class="industry-tags">#${escapeHtml(tagPrefix)} #目录自动读取 #${escapeHtml(type)}</div>
                <div class="industry-reason">来源目录：sources/automations/${escapeHtml(options.directoryName)}</div>
              </article>`;
  }).join('\n');
}

function pillarFilters(title) {
  if (title.includes('中国船舶')) return '高端制造,机械装备';
  return '高端制造,机械装备,成熟制造业龙头';
}

function strategicResourceFilters(title) {
  if (title.includes('云铝') || title.includes('铝')) return '关键矿产';
  return '关键矿产';
}

async function renderReports(directory, options) {
  const reports = await readReportFilenames(directory);
  return {
    count: reports.length,
    html: renderReportCards(reports, options),
  };
}

async function renderStrategicResourceReports() {
  return renderReports(strategicResourceDir, {
    directoryName: '战略资源',
    filters: strategicResourceFilters,
    label: '战略资源 · 关键矿产',
    tagPrefix: '战略资源',
  });
}

async function renderCommercialSpaceReports() {
  return renderReports(commercialSpaceDir, {
    directoryName: '商业航天',
    filters: '航空航天',
    label: '新兴产业 · 航空航天',
    tagPrefix: '航空航天',
  });
}

async function renderPillarReports() {
  return renderReports(pillarDir, {
    directoryName: '支柱产业',
    filters: pillarFilters,
    label: '支柱产业 · 高端制造',
    tagPrefix: '高端制造',
  });
}

async function renderElectricGridReports() {
  return renderReports(electricGridDir, {
    directoryName: '电网产业',
    filters: '电网',
    label: '支柱产业 · 电网',
    tagPrefix: '电网',
  });
}

function stripModuleSyntax(source, filename) {
  const withoutImports = source.replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm, '');
  const withoutExports = withoutImports.replace(/\bexport\s+(?=(?:async\s+)?function|const|class)/g, '');
  if (/\b(?:import|export)\s/.test(withoutExports)) {
    throw new Error(`Unsupported module syntax remains in ${filename}`);
  }
  return `\n// ---- ${filename} ----\n${withoutExports.trim()}\n`;
}

const [template, styles, ...modules] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  ...moduleOrder.map(filename => readFile(join(sourceDir, filename), 'utf8')),
]);
const strategicResourceReports = await renderStrategicResourceReports();
const commercialSpaceReports = await renderCommercialSpaceReports();
const pillarReports = await renderPillarReports();
const electricGridReports = await renderElectricGridReports();

const bundle = modules
  .map((source, index) => stripModuleSyntax(source, moduleOrder[index]))
  .join('')
  .replaceAll('</script', '<\\/script');

// Parse the generated runtime before writing it. The function is not executed.
new Function(bundle);

const output = template
  .replace('<!-- STRATEGY_REPORTS -->', strategicResourceReports.html)
  .replace('<!-- STRATEGY_REPORT_COUNT -->', String(strategicResourceReports.count))
  .replace('<!-- COMMERCIAL_SPACE_REPORTS -->', commercialSpaceReports.html)
  .replace('<!-- EMERGING_REPORT_COUNT -->', String(commercialSpaceReports.count))
  .replace('<!-- PILLAR_REPORTS -->', pillarReports.html)
  .replace('<!-- ELECTRIC_GRID_REPORTS -->', electricGridReports.html)
  .replace('<!-- PILLAR_REPORT_COUNT -->', String(pillarReports.count + electricGridReports.count))
  .replace('<!-- DASHBOARD_STYLES -->', `<style>${styles.trim()}</style>`)
  .replace('<!-- DASHBOARD_SCRIPT -->', `<script type="module">${bundle}</script>`);

if (output.includes('DASHBOARD_STYLES') || output.includes('DASHBOARD_SCRIPT') || /<!-- [A-Z_]+ -->/.test(output)) {
  throw new Error('Build placeholders were not fully replaced');
}
if (/from\s+['"]\.\//.test(output)) {
  throw new Error('Local module imports remain in the standalone artifact');
}

await writeFile(outputPath, output, 'utf8');
console.log(`Built ${outputPath} (${Buffer.byteLength(output, 'utf8')} bytes)`);
