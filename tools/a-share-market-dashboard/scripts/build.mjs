import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');
const sourceDir = join(root, 'src');
const outputPath = join(root, 'a-share-market-dashboard.html');
const moduleOrder = ['core.mjs', 'adapters.mjs', 'data-service.mjs', 'app.mjs'];
const automationsDir = join(repoRoot, 'sources', 'automations');
const industryDefinitions = [
  { key: 'STRATEGY', directoryName: '战略资源' },
  { key: 'EMERGING', directoryName: '新兴产业' },
  { key: 'PILLAR', directoryName: '支柱产业' },
];

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

async function walkHtmlFiles(directory, pathParts = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      reports.push(...await walkHtmlFiles(join(directory, entry.name), [...pathParts, entry.name]));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      reports.push({
        filename: entry.name,
        relativePath: [...pathParts, entry.name].join('/'),
        filter: pathParts[0] ?? '',
        sourceDirectory: pathParts.join('/'),
      });
    }
  }
  return reports;
}

async function scanIndustryReports(definition) {
  const directory = join(automationsDir, definition.directoryName);
  const entries = await readdir(directory, { withFileTypes: true });
  const filters = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const reports = (await walkHtmlFiles(directory))
    .sort((left, right) => right.relativePath.localeCompare(left.relativePath, 'zh-CN'));
  return {
    ...definition,
    filters,
    researchReports: reports.filter(report => report.filename.includes('完整分析报告')),
    feedReports: reports.filter(report => !report.filename.includes('完整分析报告')),
  };
}

function reportHref(industry, report) {
  return `../../sources/automations/${industry.directoryName}/${report.relativePath}`;
}

function sourceDirectoryLabel(industry, report) {
  return ['sources/automations', industry.directoryName, report.sourceDirectory]
    .filter(Boolean)
    .join('/');
}

function renderFilterTabs(industry) {
  return industry.filters.map(filter =>
    `            <button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="false">${escapeHtml(filter)}</button>`
  ).join('\n');
}

function renderReportCards(industry) {
  return industry.feedReports.map(report => {
    const title = titleFromFilename(report.filename);
    const type = title.includes('资金面') ? '资金面' : '研报';
    const label = report.filter ? `${industry.directoryName} · ${report.filter}` : industry.directoryName;
    return `              <article class="industry-report" data-filters="${escapeHtml(report.filter)}">
                <span class="industry-time">${escapeHtml(timeFromFilename(report.filename))}</span><span class="industry-dot"></span>
                <div class="industry-report-meta"><span>${escapeHtml(label)} <b>${escapeHtml(type)}</b></span><span>自动</span></div>
                <h3><a class="industry-report-link" href="${escapeHtml(reportHref(industry, report))}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></h3>
                <p>从${escapeHtml(industry.directoryName)}目录自动读取，点击标题打开对应 HTML 研报。</p>
                <div class="industry-tags">#${escapeHtml(report.filter || industry.directoryName)} #目录自动读取 #${escapeHtml(type)}</div>
                <div class="industry-reason">来源目录：${escapeHtml(sourceDirectoryLabel(industry, report))}</div>
              </article>`;
  }).join('\n');
}

function renderResearchBoards(industry) {
  return industry.researchReports.map(report => {
    const title = titleFromFilename(report.filename);
    const scope = report.filter ? `${industry.directoryName} / ${report.filter}` : industry.directoryName;
    return `          <section class="industry-research-board" data-filters="${escapeHtml(report.filter)}">
            <div><p class="eyebrow">产业研报</p><h3><a class="industry-report-link" href="${escapeHtml(reportHref(industry, report))}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></h3></div>
            <span>${escapeHtml(scope)} · 来源目录：${escapeHtml(sourceDirectoryLabel(industry, report))}</span>
          </section>`;
  }).join('\n');
}

function validateChangelog(entries) {
  if (!Array.isArray(entries)) throw new Error('Changelog must be an array');
  const required = ['date', 'weekday', 'type', 'title', 'summary'];
  entries.forEach((entry, index) => {
    for (const field of required) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        throw new Error(`Invalid changelog entry ${index}: ${field}`);
      }
    }
    if (entry.time != null && typeof entry.time !== 'string') {
      throw new Error(`Invalid changelog entry ${index}: time`);
    }
    if (entry.details != null && (!Array.isArray(entry.details) || entry.details.some(item => typeof item !== 'string'))) {
      throw new Error(`Invalid changelog entry ${index}: details`);
    }
  });
  return entries;
}

function displayChangelogDate(date) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : date;
}

function renderChangelog(entries) {
  if (!entries.length) return '        <p class="changelog-empty">暂时没有更新记录。</p>';
  const groups = new Map();
  [...entries]
    .sort((left, right) => right.date.localeCompare(left.date))
    .forEach(entry => {
      if (!groups.has(entry.date)) groups.set(entry.date, []);
      groups.get(entry.date).push(entry);
    });
  return [...groups.entries()].map(([date, dayEntries]) => {
    const weekday = dayEntries[0].weekday;
    const items = dayEntries.map(entry => {
      const time = entry.time?.trim()
        ? `<time datetime="${escapeHtml(`${entry.date}T${entry.time}`)}">${escapeHtml(entry.time)}</time>`
        : '';
      const details = entry.details?.length
        ? `<ul>${entry.details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      return `            <article class="changelog-entry">
              <div class="changelog-meta">${time}<span><i aria-hidden="true"></i>${escapeHtml(entry.type)}</span></div>
              <div class="changelog-copy"><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.summary)}</p>${details}</div>
            </article>`;
    }).join('\n');
    return `        <section class="changelog-day">
          <header><h3>${escapeHtml(displayChangelogDate(date))}</h3><span>${escapeHtml(weekday)}</span></header>
          <div class="changelog-entries">
${items}
          </div>
        </section>`;
  }).join('\n');
}

function stripModuleSyntax(source, filename) {
  const withoutImports = source.replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm, '');
  const withoutExports = withoutImports.replace(/\bexport\s+(?=(?:async\s+)?function|const|class)/g, '');
  if (/\b(?:import|export)\s/.test(withoutExports)) {
    throw new Error(`Unsupported module syntax remains in ${filename}`);
  }
  return `\n// ---- ${filename} ----\n${withoutExports.trim()}\n`;
}

const [template, styles, changelogSource, ...modules] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  readFile(join(sourceDir, 'changelog.json'), 'utf8'),
  ...moduleOrder.map(filename => readFile(join(sourceDir, filename), 'utf8')),
]);
const industries = await Promise.all(industryDefinitions.map(scanIndustryReports));
const changelog = validateChangelog(JSON.parse(changelogSource));

const bundle = modules
  .map((source, index) => stripModuleSyntax(source, moduleOrder[index]))
  .join('')
  .replaceAll('</script', '<\\/script');

// Parse the generated runtime before writing it. The function is not executed.
new Function(bundle);

let renderedTemplate = template;
for (const industry of industries) {
  renderedTemplate = renderedTemplate
    .replace(`            <!-- ${industry.key}_FILTER_TABS -->`, renderFilterTabs(industry))
    .replace(`          <!-- ${industry.key}_RESEARCH_BOARDS -->`, renderResearchBoards(industry))
    .replace(`              <!-- ${industry.key}_REPORTS -->`, renderReportCards(industry))
    .replace(`<!-- ${industry.key}_REPORT_COUNT -->`, String(industry.feedReports.length));
}

const output = renderedTemplate
  .replace('        <!-- CHANGELOG_ENTRIES -->', renderChangelog(changelog))
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
