import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');
const sourceDir = join(root, 'src');
const outputPath = join(root, 'a-share-market-dashboard.html');
const moduleOrder = ['core.mjs', 'adapters.mjs', 'data-service.mjs', 'app.mjs'];
const automationsDir = join(repoRoot, 'sources', 'automations');
const topicsDir = join(repoRoot, 'wiki', 'topics');
const dividendSignalPath = join(automationsDir, '中证红利信号', '最新信号.md');
const dividendHistoryWorkbookPath = join(automationsDir, '中证红利信号', '中证红利每日信号.xlsx');
const bbxmDailyDigestDir = join(automationsDir, 'BBXM每日汇总');
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

function reportPathParts(report) {
  return report.sourceDirectory.split('/').filter(Boolean);
}

function compareResearchReports(left, right) {
  const leftParts = reportPathParts(left);
  const rightParts = reportPathParts(right);
  const topLevel = (leftParts[0] ?? '').localeCompare(rightParts[0] ?? '', 'zh-CN');
  if (topLevel !== 0) return topLevel;
  if (leftParts.length !== rightParts.length) return leftParts.length - rightParts.length;
  return titleFromFilename(left.filename).localeCompare(titleFromFilename(right.filename), 'zh-CN');
}

function researchTitle(industry, report) {
  const parts = reportPathParts(report);
  if (parts.length <= 1) return titleFromFilename(report.filename);
  return `${parts[0]}-${parts.at(-1)}产业完整分析报告`;
}

function normalizeStockName(value) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

function stockNameFromReportTitle(title) {
  return normalizeStockName(title
    .replace(/[-_]?机构级(?:决策|研究)?研报(?:-阅读版)?$/u, '')
    .replace(/[-_]?机构级(?:决策|研究)?报告(?:-阅读版)?$/u, '')
    .replace(/[-_]?目录帖子逻辑研报$/u, '')
    .replace(/[-_]?阅读版$/u, '')
    .replace(/[-_]+$/u, ''));
}

function timeFromFilename(filename) {
  const timed = filename.match(/^\d{4}-\d{2}-\d{2}-(\d{2})(\d{2})-/);
  if (timed) return `${timed[1]}:${timed[2]}`;
  const dated = filename.match(/^\d{4}-(\d{2})-(\d{2})-/);
  if (dated) return `${dated[1]}-${dated[2]}`;
  return '—';
}

function displayDigestDate(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}月${Number(match[3])}日` : date;
}

function weekdayFromDate(date) {
  const timestamp = Date.parse(`${date}T12:00:00+08:00`);
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'Asia/Shanghai' }).format(timestamp);
}

function truncateText(value, maxLength = 118) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function stripFrontmatter(markdown) {
  return String(markdown ?? '').replace(/^---\s*[\s\S]*?\n---\s*/u, '');
}

function markdownTitle(markdown, fallback) {
  return markdown.match(/^title:\s*"?([^"\n]+)"?\s*$/mu)?.[1]?.trim()
    ?? markdown.match(/^#\s+(.+)$/mu)?.[1]?.trim()
    ?? fallback;
}

function markdownSummary(markdown) {
  const frontmatterSummary = markdown.match(/^summary:\s*"?([^"\n]+)"?\s*$/mu)?.[1]?.trim();
  if (frontmatterSummary) return truncateText(frontmatterSummary, 118);
  const body = stripFrontmatter(markdown)
    .replace(/^#\s+.+$/mu, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateText(body || '主题页暂无可提取摘要。', 118);
}

function topicCategory(title) {
  if (title.startsWith('冰冰小美')) return 'bbxm';
  if (title.startsWith('碧树西风')) return 'bishi';
  if (/AI|人工智能|模型|算力/u.test(title)) return 'ai';
  return 'other';
}

function topicCategoryLabel(category) {
  return {
    bbxm: '冰冰小美',
    bishi: '碧树西风',
    ai: 'AI',
    other: '其他',
  }[category] ?? category;
}

function normalizeDigestText(value) {
  return String(value ?? '')
    .replace(/[]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function frontmatterValue(markdown, label) {
  return markdown.match(new RegExp(`^${label}：(.+)$`, 'mu'))?.[1].trim() ?? '';
}

function digestTitleFromFilename(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/^\d{6}_/, '')
    .replace(/_\d{6,}$/, '')
    .replace(/_/g, ' ');
}

function digestExcerpt(markdown, fallbackTitle) {
  const body = markdown.split(/^正文：$/mu).at(1) ?? markdown;
  const cleaned = normalizeDigestText(body)
    .replace(/^首页 下载App 发帖.*?冰冰小美\s*/u, '')
    .replace(/风险提示：用户发表的所有文章[\s\S]*$/u, '')
    .replace(fallbackTitle, '')
    .trim();
  return truncateText(cleaned || fallbackTitle, 132);
}

function digestFilters(text) {
  const filters = new Set();
  if (/宏观|财政|税|美元|美债|利率|流动性|关税|汇率|风险|救市|股指期货/u.test(text)) filters.add('macro');
  if (/市场|A股|牛市|熊市|行情|股市|指数|资金|做空|交易节点/u.test(text)) filters.add('market');
  if (/产业|科技|AI|有色|黄金|银行|半导体|机器人|商业航天|电力|资源/u.test(text)) filters.add('industry');
  if (/交易|投机|仓位|加仓|减仓|持仓|观察|复盘|等待|买入|卖出/u.test(text)) filters.add('trade');
  if (!filters.size) filters.add('market');
  return [...filters];
}

async function scanBbxmDailyDigest() {
  const dateEntries = await readdir(bbxmDailyDigestDir, { withFileTypes: true }).catch(() => []);
  const dayGroups = [];
  for (const dateEntry of dateEntries) {
    if (!dateEntry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(dateEntry.name)) continue;
    const dayDir = join(bbxmDailyDigestDir, dateEntry.name, '冰冰小美');
    const files = await readdir(dayDir, { withFileTypes: true }).catch(() => []);
    const entries = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md') || file.name === 'summary.md' || file.name.includes('_解读')) continue;
      const markdown = await readFile(join(dayDir, file.name), 'utf8');
      const title = frontmatterValue(markdown, '标题') || digestTitleFromFilename(file.name);
      const publishedAt = frontmatterValue(markdown, '发布时间') || `${dateEntry.name} ${timeFromFilename(file.name)}`;
      const sourceUrl = frontmatterValue(markdown, '原始链接');
      const text = `${title} ${markdown}`;
      entries.push({
        date: dateEntry.name,
        time: publishedAt.match(/\d{2}:\d{2}/)?.[0] ?? timeFromFilename(file.name),
        title: truncateText(title, 78),
        excerpt: digestExcerpt(markdown, title),
        sourceUrl,
        href: `../../sources/automations/BBXM每日汇总/${dateEntry.name}/冰冰小美/${file.name}`,
        filters: digestFilters(text),
      });
    }
    const summaryPath = join(dayDir, 'summary.md');
    const summary = await readFile(summaryPath, 'utf8').catch(() => '');
    const summaryHeadline = summary.match(/^## 总观点\s+([\s\S]*?)(?:\n## |\n$)/u)?.[1]?.trim() ?? '';
    dayGroups.push({
      date: dateEntry.name,
      weekday: weekdayFromDate(dateEntry.name),
      entries: entries.sort((left, right) => right.time.localeCompare(left.time)),
      summary: truncateText(summaryHeadline, 138),
      summaryHref: summary ? `../../sources/automations/BBXM每日汇总/${dateEntry.name}/冰冰小美/summary.md` : '',
    });
  }
  return dayGroups
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter(group => group.entries.length || group.summary)
    .slice(0, 10);
}

async function scanTopicPages() {
  const files = await readdir(topicsDir, { withFileTypes: true }).catch(() => []);
  const topics = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;
    const markdown = await readFile(join(topicsDir, file.name), 'utf8');
    const fallbackTitle = file.name.replace(/\.md$/i, '');
    const title = markdownTitle(markdown, fallbackTitle);
    const category = topicCategory(title);
    topics.push({
      filename: file.name,
      title,
      summary: markdownSummary(markdown),
      category,
      href: `../../wiki/topics/${file.name}`,
      updated: markdown.match(/^updated:\s*"?([^"\n]+)"?\s*$/mu)?.[1]?.trim() ?? '待更新',
    });
  }
  return topics.sort((left, right) =>
    topicCategoryLabel(left.category).localeCompare(topicCategoryLabel(right.category), 'zh-CN')
    || left.title.localeCompare(right.title, 'zh-CN')
  );
}

function renderFeaturedDigest(groups) {
  if (!groups.length) {
    return `            <p class="personal-empty">未找到 BBXM 每日汇总。来源目录：sources/automations/BBXM每日汇总</p>`;
  }
  const allEntries = groups.flatMap(group => group.entries.map(entry => ({ ...entry, groupDate: group.date })));
  const hotItems = allEntries.slice(0, 5).map((entry, index) =>
    `                <li class="featured-hot-item" data-featured-filters="${escapeHtml(entry.filters.join(','))}">
                  <span>${index + 1}</span>
                  <a href="${escapeHtml(entry.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title)}</a>
                </li>`
  ).join('\n');
  const latestGroup = groups[0];
  const hotBlock = `            <section class="featured-hot panel" aria-label="当前热点">
              <h3>当前热点</h3>
              ${hotItems ? `<ol>\n${hotItems}\n              </ol>` : `<p>${escapeHtml(latestGroup.summary || '最新日期暂无目标日期原帖。')}</p>`}
            </section>`;
  const dayBlocks = groups.map(group => {
    const cards = group.entries.map(entry =>
      `                <article class="featured-card" data-featured-filters="${escapeHtml(entry.filters.join(','))}">
                  <span class="featured-time">${escapeHtml(entry.time)}</span><span class="featured-dot"></span>
                  <div class="featured-card-inner">
                    <div class="featured-meta"><span>冰冰小美 · 雪球</span><b>精选</b></div>
                    <h3><a href="${escapeHtml(entry.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title)}</a></h3>
                    <p>${escapeHtml(entry.excerpt)}</p>
                    <div class="featured-tags">${entry.filters.map(filter => `#${escapeHtml({ macro: '宏观', market: '市场', industry: '产业', trade: '交易' }[filter] ?? filter)}`).join(' ')}</div>
                    ${entry.sourceUrl ? `<a class="featured-source" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开雪球原帖</a>` : ''}
                  </div>
                </article>`
    ).join('\n');
    const summary = group.summary && !group.entries.length
      ? `              <article class="featured-card is-summary" data-featured-filters="market">
                <span class="featured-time">—</span><span class="featured-dot"></span>
                <div class="featured-card-inner">
                  <div class="featured-meta"><span>自动化摘要</span><b>汇总</b></div>
                  <h3><a href="${escapeHtml(group.summaryHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayDigestDate(group.date))} 无目标日期原帖</a></h3>
                  <p>${escapeHtml(group.summary)}</p>
                  <div class="featured-tags">#市场 #自动化边界</div>
                </div>
              </article>`
      : '';
    return `            <details class="featured-day">
              <summary class="featured-date-row"><strong>${escapeHtml(displayDigestDate(group.date))}</strong><span>${escapeHtml(group.weekday)} · ${group.entries.length} 条</span></summary>
              <div class="featured-timeline">
                <div class="featured-feed">
${cards || summary}
                </div>
              </div>
            </details>`;
  }).join('\n');
  return `${hotBlock}
            <div class="featured-source-note">来源目录：sources/automations/BBXM每日汇总</div>
${dayBlocks}
            <p class="featured-empty-results" hidden>没有匹配的精选条目。</p>`;
}

function renderTopicFilterTabs(topics) {
  const categories = [...new Set(topics.map(topic => topic.category))];
  return categories.map(category =>
    `              <button type="button" data-topic-filter="${escapeHtml(category)}" aria-pressed="false">${escapeHtml(topicCategoryLabel(category))}</button>`
  ).join('\n');
}

function renderTopicCards(topics) {
  if (!topics.length) {
    return `            <p class="personal-empty">未找到主题页。来源目录：wiki/topics</p>`;
  }
  const cards = topics.map(topic =>
    `              <article class="topic-card" data-topic-category="${escapeHtml(topic.category)}">
                <div class="topic-card-meta"><span>${escapeHtml(topicCategoryLabel(topic.category))}</span><span>${escapeHtml(topic.updated)}</span></div>
                <h3><a href="${escapeHtml(topic.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(topic.title)}</a></h3>
                <p>${escapeHtml(topic.summary)}</p>
                <div class="topic-card-footer"><span>来源：wiki/topics</span><a href="${escapeHtml(topic.href)}" target="_blank" rel="noopener noreferrer">打开主题</a></div>
              </article>`
  ).join('\n');
  return `            <div class="topic-source-note">来源目录：wiki/topics · ${topics.length} 个主题页</div>
            <div class="topic-grid">
${cards}
            </div>
            <p class="topic-empty-results" hidden>没有匹配的主题页。</p>`;
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
    researchReports: reports
      .filter(report => report.filename.includes('完整分析报告'))
      .sort(compareResearchReports),
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
  if (!industry.researchReports.length) return '';
  const items = industry.researchReports.map((report, index) => {
    const title = researchTitle(industry, report);
    return `              <li class="industry-research-item" data-filters="${escapeHtml(report.filter)}">
                <span class="industry-research-rank">${index + 1}</span>
                <a class="industry-report-link" href="${escapeHtml(reportHref(industry, report))}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
              </li>`;
  }).join('\n');
  return `          <section class="industry-research-list" aria-label="${escapeHtml(industry.directoryName)}产业研报">
            <h3>产业研报</h3>
            <ol>
${items}
            </ol>
          </section>`;
}

function renderStockReportLinkMap(industries) {
  const links = new Map();
  for (const industry of industries) {
    for (const report of industry.feedReports) {
      if (!/(?:机构级(?:决策|研究)?研报|机构级(?:决策|研究)?报告|阅读版)/u.test(report.filename)) continue;
      const stockName = stockNameFromReportTitle(titleFromFilename(report.filename));
      if (!stockName || links.has(stockName)) continue;
      links.set(stockName, reportHref(industry, report));
    }
  }
  return [...links.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([name, href]) => `  ${JSON.stringify(name)}: ${JSON.stringify(href)},`)
    .join('\n');
}

function numberFromText(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function decodeXml(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function columnIndexFromCellRef(ref) {
  const letters = String(ref ?? '').match(/^[A-Z]+/)?.[0] ?? '';
  return [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function readZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid xlsx: EOCD not found');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('Invalid xlsx: central directory mismatch');
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (data) entries.set(name, data.toString('utf8'));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseXlsxSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(match => (
    [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(text => decodeXml(text[1])).join('')
  ));
}

function cellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] ?? '';
  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
  if (type === 's') return sharedStrings[Number(rawValue)] ?? '';
  return decodeXml(rawValue);
}

function parseXlsxSheetRows(sheetXml, sharedStrings) {
  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(rowMatch => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const index = columnIndexFromCellRef(cellMatch[1].match(/\br="([^"]+)"/)?.[1]);
      if (index >= 0) row[index] = cellValue(cellMatch[0], sharedStrings);
    }
    return row;
  });
}

function parseDividendYieldHistoryFromWorkbook(buffer) {
  if (!buffer?.length) return [];
  const entries = readZipEntries(buffer);
  const sharedStrings = parseXlsxSharedStrings(entries.get('xl/sharedStrings.xml'));
  const sheetXml = entries.get('xl/worksheets/sheet1.xml') ?? [...entries.entries()].find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1] ?? '';
  const rows = parseXlsxSheetRows(sheetXml, sharedStrings).filter(row => row.some(value => String(value ?? '').trim()));
  const header = rows[0] ?? [];
  const indexDateIndex = header.findIndex(value => String(value).trim() === 'index_date__index_valuation_date');
  const runDateIndex = header.findIndex(value => String(value).trim() === 'run_date__record_date');
  const dateIndex = indexDateIndex >= 0 ? indexDateIndex : runDateIndex;
  const dividendIndex = header.findIndex(value => String(value).trim() === 'akshare_dividend_yield_2');
  if (dateIndex < 0 || dividendIndex < 0) return [];
  return rows.slice(2).map(row => {
    const date = String(row[dateIndex] ?? '').trim().replaceAll('/', '-');
    const value = Number(row[dividendIndex]);
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(date) && Number.isFinite(value)
      ? { date: date.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (_, year, month, day) => `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`), value }
      : null;
  }).filter(Boolean);
}

function parseDividendSignal(markdown) {
  if (!markdown?.trim()) return null;
  const pick = label => markdown.match(new RegExp(`^- ${label}：(.+)$`, 'mu'))?.[1].trim() ?? '';
  const runTime = pick('运行时间');
  const recordDate = runTime.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  const signal = {
    recordDate,
    runTime,
    indexDate: pick('AKShare 指数估值日期'),
    bondDate: pick('10年国债收益率日期'),
    dividendYield2: numberFromText(pick('AKShare 中证红利股息率2')),
    xueqiuChangePercent: pick('雪球当天涨跌幅'),
    lixingerDate: pick('理杏仁估值日期'),
    lixingerDividendYield: pick('理杏仁市值加权股息率'),
    lixingerPercentile10y: pick('理杏仁近10年股息率分位'),
    lixingerPercentile80Value: pick('理杏仁近10年80%分位点'),
    bond10yYield: numberFromText(pick('中国10年国债收益率')),
    spread: numberFromText(pick('AKShare 股息率2 - 10年国债收益率')),
    percentileSignal: pick('历史分位点触发'),
    absoluteSignal: pick('绝对股息率触发'),
    spreadSignal: pick('相对债券收益率触发'),
    headline: pick('综合结论'),
    source: 'zzhl-dividend-signal 最新信号',
    sourceNote: markdown.match(/^## 来源[\s\S]*?^- (.+)$/mu)?.[1].trim() ?? '',
    status: recordDate ? 'latest' : 'snapshot',
  };
  return signal.recordDate || signal.indexDate ? signal : null;
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

function validateEventCalendar(entries) {
  if (!Array.isArray(entries)) throw new Error('Event calendar must be an array');
  entries.forEach((entry, index) => {
    for (const field of ['date', 'type', 'title']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        throw new Error(`Invalid event calendar entry ${index}: ${field}`);
      }
    }
    for (const field of ['scope', 'note']) {
      if (entry[field] != null && typeof entry[field] !== 'string') {
        throw new Error(`Invalid event calendar entry ${index}: ${field}`);
      }
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

const [template, styles, changelogSource, eventCalendarSource, ...modules] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  readFile(join(sourceDir, 'changelog.json'), 'utf8'),
  readFile(join(sourceDir, 'event-calendar.json'), 'utf8'),
  ...moduleOrder.map(filename => readFile(join(sourceDir, filename), 'utf8')),
]);
const industries = await Promise.all(industryDefinitions.map(scanIndustryReports));
const bbxmDailyDigest = await scanBbxmDailyDigest();
const topicPages = await scanTopicPages();
const changelog = validateChangelog(JSON.parse(changelogSource));
const eventCalendar = validateEventCalendar(JSON.parse(eventCalendarSource));
const dividendSignal = parseDividendSignal(await readFile(dividendSignalPath, 'utf8').catch(() => ''));
const dividendYieldHistory = parseDividendYieldHistoryFromWorkbook(await readFile(dividendHistoryWorkbookPath).catch(() => null));

const stockReportLinks = renderStockReportLinkMap(industries);
const bundle = modules
  .map((source, index) => {
    const withGeneratedData = moduleOrder[index] === 'app.mjs'
      ? source
        .replace('  // STOCK_REPORT_LINKS', stockReportLinks)
        .replace('  // EVENT_CALENDAR', JSON.stringify(eventCalendar, null, 2))
        .replace('  // CSI_DIVIDEND_SIGNAL', JSON.stringify(dividendSignal, null, 2))
        .replace('  // CSI_DIVIDEND_YIELD_HISTORY', JSON.stringify(dividendYieldHistory, null, 2))
      : source;
    return stripModuleSyntax(withGeneratedData, moduleOrder[index]);
  })
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
  .replace('            <!-- BBXM_FEATURED_DIGEST -->', renderFeaturedDigest(bbxmDailyDigest))
  .replace('              <!-- TOPIC_FILTER_TABS -->', renderTopicFilterTabs(topicPages))
  .replace('            <!-- TOPIC_CARDS -->', renderTopicCards(topicPages))
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
