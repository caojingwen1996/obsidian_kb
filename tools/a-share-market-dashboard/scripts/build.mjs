import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { renderIndexDayChart } from './index-day-chart.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');
const sourceDir = join(root, 'src');
const dataDir = join(root, 'data');
const marketOverviewDataDir = join(dataDir, '市场总览');
const outputPath = join(root, 'a-share-market-dashboard.html');
const moduleOrder = ['core.mjs', 'adapters.mjs', 'data-service.mjs', 'risk-state.mjs', 'risk-indicators.mjs', 'risk-screen.mjs', 'app.mjs'];
const automationsDir = join(repoRoot, 'sources', 'automations');
const topicsDir = join(repoRoot, 'wiki', 'topics');
const dividendSignalPath = join(automationsDir, '中证红利信号', '最新信号.md');
const dividendHistoryWorkbookPath = join(automationsDir, '中证红利信号', '中证红利每日信号.xlsx');
const dividendAnnualPerformancePath = join(automationsDir, '中证红利信号', '中证红利年度表现.json');
const bbxmDailyDigestDir = join(automationsDir, 'BBXM每日汇总');
const todoDataPath = join(dataDir, '需求清单', 'todo.json');
const todoDataHref = 'data/需求清单/todo.json';
const todoQuadrants = [
  { key: 'important-urgent', label: '重要且紧急', shortLabel: 'Q1', description: '立即处理', className: 'is-important-urgent' },
  { key: 'important-not-urgent', label: '重要不紧急', shortLabel: 'Q2', description: '排入计划', className: 'is-important-not-urgent' },
  { key: 'urgent-not-important', label: '紧急不重要', shortLabel: 'Q3', description: '压缩或委托', className: 'is-urgent-not-important' },
  { key: 'not-important-not-urgent', label: '不重要且不紧急', shortLabel: 'Q4', description: '延后或删除', className: 'is-not-important-not-urgent' },
];
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

function obsidianOpenPathHref(path) {
  return `obsidian://open?path=${encodeURIComponent(path)}`;
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

function stockNameFromFeedTitle(title) {
  return stockNameFromReportTitle(String(title)
    .replace(/[-_]?三要素分析$/u, '')
    .replace(/[-_]?资金面(?:分层)?分析$/u, '')
    .replace(/[-_]?交易方画像[-_]?跟踪$/u, '')
    .replace(/[-_]?财报分析$/u, ''));
}

function feedReportKind(report) {
  const title = titleFromFilename(report.filename);
  if (title.includes('三要素分析')) return 'threeFactor';
  if (title.includes('资金面')) return 'fundFlow';
  if (/(?:机构级(?:决策|研究)?研报|机构级(?:决策|研究)?报告|目录帖子逻辑研报|阅读版)/u.test(title)) return 'equity';
  return 'other';
}

function groupFeedReportsByStock(reports) {
  const targets = new Map();
  for (const report of reports) {
    const title = titleFromFilename(report.filename);
    const name = stockNameFromFeedTitle(title);
    if (!name) continue;
    if (!targets.has(name)) targets.set(name, { name, filters: new Set() });
    const target = targets.get(name);
    if (report.filter) target.filters.add(report.filter);
    const kind = feedReportKind(report);
    if (!target[kind] || report.filename.localeCompare(target[kind].filename, 'zh-CN') > 0) target[kind] = report;
    if (!target.latest || report.filename.localeCompare(target.latest.filename, 'zh-CN') > 0) target.latest = report;
  }
  return [...targets.values()];
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

function markdownSection(markdown, heading) {
  const escapedHeading = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(markdown ?? '').match(new RegExp(`^##\\s+${escapedHeading}\\s+([\\s\\S]*?)(?:\\n##\\s+|\\n$)`, 'mu'))?.[1]?.trim() ?? '';
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

function metadataValue(markdown, label) {
  return markdown.match(new RegExp(`^(?:-\\s*)?${label}：(.+)$`, 'mu'))?.[1].trim() ?? '';
}

function digestTitleFromFilename(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/^\d{6}_/, '')
    .replace(/_\d{6,}$/, '')
    .replace(/_/g, ' ');
}

function digestBody(markdown) {
  return markdown.split(/^正文：$/mu).at(1)
    ?? markdown.split(/^## 原文内容\s*$/mu).at(1)
    ?? markdown;
}

function digestExcerpt(markdown, fallbackTitle) {
  const body = digestBody(markdown);
  const cleaned = normalizeDigestText(body)
    .replace(/^首页 下载App 发帖.*?冰冰小美\s*/u, '')
    .replace(/风险提示：用户发表的所有文章[\s\S]*$/u, '')
    .replace(fallbackTitle, '')
    .trim();
  return truncateText(cleaned || fallbackTitle, 132);
}

function digestOriginalText(markdown, fallbackTitle) {
  const cleanedLines = digestBody(markdown)
    .replace(/[]/g, '')
    .replace(/风险提示：用户发表的所有文章[\s\S]*$/u, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const cleaned = cleanedLines.join('\n').replace(fallbackTitle, '').trim();
  return cleaned || fallbackTitle;
}

const digestFilterLabels = {
  macro: '宏观',
  market: '市场',
  industry: '产业',
  trade: '交易',
};

const digestFilterAliases = new Map([
  ['宏观', 'macro'],
  ['市场', 'market'],
  ['行业', 'industry'],
  ['产业', 'industry'],
  ['交易', 'trade'],
]);

function digestFiltersFromPost(markdown) {
  const rawTags = metadataValue(markdown, '标签');
  const filters = new Set(
    rawTags
      .replace(/[。；;]/g, ' ')
      .split(/[,\s，、]+/u)
      .map(tag => digestFilterAliases.get(tag.trim()))
      .filter(Boolean)
  );
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
      if (!file.isFile() || !file.name.endsWith('.md') || file.name === 'summary.md' || file.name === '操作.md' || file.name.includes('_解读')) continue;
      const markdown = await readFile(join(dayDir, file.name), 'utf8');
      const title = frontmatterValue(markdown, '标题') || digestTitleFromFilename(file.name);
      const publishedAt = frontmatterValue(markdown, '发布时间') || `${dateEntry.name} ${timeFromFilename(file.name)}`;
      const sourceUrl = frontmatterValue(markdown, '原始链接');
      entries.push({
        date: dateEntry.name,
        time: publishedAt.match(/\d{2}:\d{2}/)?.[0] ?? timeFromFilename(file.name),
        title: truncateText(title, 78),
        excerpt: digestExcerpt(markdown, title),
        originalTextEncoded: Buffer.from(digestOriginalText(markdown, title), 'utf8').toString('base64'),
        sourceUrl,
        href: `../../sources/automations/BBXM每日汇总/${dateEntry.name}/冰冰小美/${file.name}`,
        filters: digestFiltersFromPost(markdown),
      });
    }
    const summaryPath = join(dayDir, 'summary.md');
    const summary = await readFile(summaryPath, 'utf8').catch(() => '');
    const summaryHeadline = markdownSection(summary, '总观点');
    const summaryAnalysis = markdownSection(summary, '解析今天文章的观点');
    dayGroups.push({
      date: dateEntry.name,
      weekday: weekdayFromDate(dateEntry.name),
      entries: entries.sort((left, right) => right.time.localeCompare(left.time)),
      summary: truncateText(summaryHeadline, 138),
      summaryDetail: truncateText(summaryHeadline, 360),
      summaryAnalysis: truncateText(summaryAnalysis, 360),
      summaryHref: summary ? obsidianOpenPathHref(summaryPath) : '',
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
    const topicPath = join(topicsDir, file.name);
    const markdown = await readFile(topicPath, 'utf8');
    const fallbackTitle = file.name.replace(/\.md$/i, '');
    const title = markdownTitle(markdown, fallbackTitle);
    const category = topicCategory(title);
    topics.push({
      filename: file.name,
      title,
      summary: markdownSummary(markdown),
      category,
      href: obsidianOpenPathHref(topicPath),
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
    `                <li class="featured-hot-item" data-featured-id="${escapeHtml(entry.href)}" data-featured-filters="${escapeHtml(entry.filters.join(','))}">
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
    const summaryCard = group.summaryHref && (group.summaryDetail || group.summaryAnalysis)
      ? `                <article class="featured-card featured-summary-card" data-featured-id="${escapeHtml(group.summaryHref)}" data-featured-filters="macro,market,industry,trade">
                  <span class="featured-time">汇总</span><span class="featured-dot"></span>
                  <div class="featured-card-inner">
                    <div class="featured-meta"><span>summary.md · 自动化摘要</span><b>汇总</b></div>
                    <h3><a href="${escapeHtml(group.summaryHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayDigestDate(group.date))} 当日汇总</a></h3>
                    ${group.summaryDetail ? `<p><strong>总观点：</strong>${escapeHtml(group.summaryDetail)}</p>` : ''}
                    ${group.summaryAnalysis ? `<p><strong>解析：</strong>${escapeHtml(group.summaryAnalysis)}</p>` : ''}
                    <div class="featured-tags">#宏观 #市场 #产业 #交易</div>
                    <div class="featured-actions">
                      <a class="featured-source" href="${escapeHtml(group.summaryHref)}" target="_blank" rel="noopener noreferrer">打开 summary.md</a>
                    </div>
                  </div>
                </article>`
      : '';
    const cards = group.entries.map(entry =>
      `                <article class="featured-card" data-featured-id="${escapeHtml(entry.href)}" data-featured-filters="${escapeHtml(entry.filters.join(','))}">
                  <span class="featured-time">${escapeHtml(entry.time)}</span><span class="featured-dot"></span>
                  <div class="featured-card-inner">
                    <div class="featured-meta"><span>冰冰小美 · 雪球</span><b>精选</b></div>
                    <h3><a href="${escapeHtml(entry.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title)}</a></h3>
                    <p>${escapeHtml(entry.excerpt)}</p>
                    <div class="featured-tags">${entry.filters.map(filter => `#${escapeHtml(digestFilterLabels[filter] ?? filter)}`).join(' ')}</div>
                    <div class="featured-actions">
                      ${entry.sourceUrl ? `<a class="featured-source" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开雪球原帖</a>` : ''}
                      <button class="featured-original-toggle" type="button" aria-expanded="false">显示原文</button>
                      <button class="featured-delete" type="button">删除</button>
                    </div>
                    <div class="featured-original" data-featured-original="${escapeHtml(entry.originalTextEncoded)}" hidden>
                      <pre></pre>
                    </div>
                  </div>
                </article>`
    ).join('\n');
    const summary = group.summary && !group.entries.length && !summaryCard
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
${summaryCard}
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

function renderTodoSummaryCards(todoList) {
  return todoQuadrants.map(quadrant => {
    const count = todoList.items.filter(item => item.quadrant === quadrant.label).length;
    return `            <article class="todo-summary-card ${escapeHtml(quadrant.className)}" data-todo-summary-quadrant="${escapeHtml(quadrant.label)}">
              <small>${escapeHtml(quadrant.shortLabel)}</small>
              <strong>${count}</strong>
              <span>${escapeHtml(quadrant.label)}</span>
            </article>`;
  }).join('\n');
}

function renderTodoItem(item) {
  const createdAt = item.createdAt || item.updatedAt || '';
  const createdAtText = createdAt ? `创建 ${createdAt}` : '创建时间未记录';
  const status = item.status || '未开始';
  const detail = item.detail && item.detail !== item.owner && item.detail !== 'User' ? item.detail : '';
  const detailLine = detail ? `                  <p>${escapeHtml(detail)}</p>\n` : '';
  return `                <article class="todo-item" draggable="true" data-todo-id="${escapeHtml(item.id)}" data-todo-quadrant="${escapeHtml(item.quadrant)}" aria-label="拖动 ${escapeHtml(item.title)} 到其他象限">
                  <div class="todo-item-kicker"><span>${escapeHtml(item.id)}</span><span class="todo-item-time">${escapeHtml(createdAtText)}</span></div>
                  <div class="todo-item-head"><strong>${escapeHtml(item.title)}</strong></div>
${detailLine}                  <div class="todo-item-actions">
                    <button class="todo-action-button is-status todo-status-button" type="button" data-action="cycle-todo-status" data-todo-id="${escapeHtml(item.id)}" data-todo-status="${escapeHtml(status)}" aria-label="修改 ${escapeHtml(item.title)} 状态">状态 · ${escapeHtml(status)}</button>
                    <button class="todo-action-button is-danger" type="button" data-action="delete-todo" data-todo-id="${escapeHtml(item.id)}">删除</button>
                  </div>
                </article>`;
}

function todoArchiveSortKey(item) {
  return item.archivedAt || item.completedAt || item.updatedAt || item.createdAt || '';
}

function normalizeTodoArchiveItems(rawArchive) {
  return rawArchive.flatMap((item, rowIndex) => {
    if (!item || typeof item !== 'object') return [];
    const title = String(item.title ?? item['需求事项'] ?? '').trim();
    if (!title) return [];
    const important = normalizeTodoFlag(item.important ?? item['重要性']);
    const urgent = normalizeTodoFlag(item.urgent ?? item['紧急性']);
    const quadrant = canonicalTodoQuadrant(item.quadrant ?? item['四象限标签']) || todoQuadrantFromFlags(important, urgent);
    const createdAt = normalizeTodoDate(item.createdAt ?? item['创建时间'] ?? item.updatedAt ?? item['更新时间']);
    const updatedAt = normalizeTodoDate(item.updatedAt ?? item['更新时间'] ?? createdAt);
    const completedAt = normalizeTodoDate(item.completedAt ?? item['完成时间'] ?? updatedAt);
    const archivedAt = normalizeTodoDate(item.archivedAt ?? item['归档时间'] ?? completedAt);
    return [{
      id: String(item.id ?? item['需求编号'] ?? `TODO-${String(rowIndex + 1).padStart(3, '0')}`).trim(),
      title: truncateText(title, 72),
      detail: truncateText(String(item.detail ?? item['说明'] ?? '').trim(), 150),
      quadrant,
      status: '已完成',
      source: truncateText(String(item.source ?? item['来源/备注'] ?? item['来源'] ?? '').trim(), 56),
      createdAt,
      updatedAt,
      completedAt,
      archivedAt,
    }];
  }).sort((left, right) => {
    const dateOrder = todoArchiveSortKey(right).localeCompare(todoArchiveSortKey(left));
    return dateOrder || right.id.localeCompare(left.id, 'zh-CN', { numeric: true });
  });
}

function renderTodoArchiveItem(item) {
  const detail = item.detail && item.detail !== 'User' ? item.detail : '';
  const detailLine = detail ? `\n                  <p>${escapeHtml(detail)}</p>` : '';
  const completedAt = item.completedAt ? `完成 ${item.completedAt}` : '完成时间未记录';
  const archivedAt = item.archivedAt ? `归档 ${item.archivedAt}` : '归档时间未记录';
  return `                <article class="todo-archive-item" data-todo-archive-id="${escapeHtml(item.id)}">
                  <div class="todo-archive-row">
                    <span class="todo-archive-id">${escapeHtml(item.id)}</span>
                    <div class="todo-item-head todo-archive-title"><strong>${escapeHtml(item.title)}</strong></div>
                    <div class="todo-archive-meta"><span class="todo-archive-completed">${escapeHtml(completedAt)}</span>${item.quadrant ? `<span class="todo-archive-quadrant">${escapeHtml(item.quadrant)}</span>` : ''}</div>
                    <span class="todo-item-time">${escapeHtml(archivedAt)}</span>
                  </div>${detailLine}
                </article>`;
}

function renderTodoArchiveList(todoList) {
  const archive = todoList.archive ?? [];
  return archive.length
    ? archive.map(renderTodoArchiveItem).join('\n')
    : '                <p class="todo-empty">暂无归档任务</p>';
}

function renderTodoMatrix(todoList) {
  return todoQuadrants.map(quadrant => {
    const items = todoList.items.filter(item => item.quadrant === quadrant.label);
    const body = items.length
      ? items.map(renderTodoItem).join('\n')
      : '                <p class="todo-empty">暂无事项</p>';
    return `              <section class="todo-quadrant ${escapeHtml(quadrant.className)}" data-todo-quadrant="${escapeHtml(quadrant.label)}" tabindex="0" aria-label="${escapeHtml(quadrant.label)}，${items.length}项任务，可滚动查看">
                <header class="todo-quadrant-header">
                  <div class="todo-quadrant-heading"><span class="todo-quadrant-index">${escapeHtml(quadrant.shortLabel)}</span><div><h3>${escapeHtml(quadrant.label)}</h3><p class="todo-quadrant-guide">${escapeHtml(quadrant.description)}</p></div></div>
                  <div class="todo-quadrant-meta"><strong>${items.length}项</strong><button class="todo-quadrant-toggle" type="button" data-action="toggle-todo-quadrant" aria-expanded="true">收起</button></div>
                </header>
${body}
              </section>`;
  }).join('\n');
}

async function walkHtmlFiles(directory, pathParts = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === 'archive') continue;
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
    .filter(entry => entry.isDirectory() && entry.name.toLowerCase() !== 'archive')
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const reports = (await walkHtmlFiles(directory))
    .sort((left, right) => right.relativePath.localeCompare(left.relativePath, 'zh-CN'));
  const feedReports = reports.filter(report => !report.filename.includes('完整分析报告'));
  return {
    ...definition,
    filters,
    researchReports: reports
      .filter(report => report.filename.includes('完整分析报告'))
      .sort(compareResearchReports),
    feedReports,
    reportTargets: groupFeedReportsByStock(feedReports),
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

function renderReportRows(industry) {
  return industry.reportTargets.map(target => {
    const primary = target.equity || target.other || target.threeFactor || target.fundFlow || target.latest;
    const title = titleFromFilename(primary.filename);
    const label = primary.filter ? `${industry.directoryName} · ${primary.filter}` : industry.directoryName;
    const href = reportHref(industry, primary);
    const equityHref = target.equity ? reportHref(industry, target.equity) : '';
    const threeFactorHref = target.threeFactor ? reportHref(industry, target.threeFactor) : '';
    const fundFlowHref = target.fundFlow ? reportHref(industry, target.fundFlow) : '';
    const fundFlowLink = fundFlowHref
      ? `<a class="industry-report-link" href="${escapeHtml(fundFlowHref)}" target="_blank" rel="noopener noreferrer">资金面分析</a>`
      : '<span class="tracking-three-factor-state">未关联</span>';
    const equityLink = equityHref
      ? `<a class="industry-report-link" href="${escapeHtml(equityHref)}" target="_blank" rel="noopener noreferrer">个股研报</a>`
      : '<span class="tracking-three-factor-state">未关联</span>';
    return `                <tr class="industry-report" data-filters="${escapeHtml([...target.filters].join(','))}" data-report-href="${escapeHtml(href)}" data-equity-report-href="${escapeHtml(equityHref)}" data-three-factor-href="${escapeHtml(threeFactorHref)}" data-fund-flow-href="${escapeHtml(fundFlowHref)}" data-report-title="${escapeHtml(title)}" data-stock-name="${escapeHtml(target.name)}" data-report-label="${escapeHtml(label)}" data-report-time="${escapeHtml(timeFromFilename(primary.filename))}" data-source-directory="${escapeHtml(sourceDirectoryLabel(industry, primary))}">
                  <td class="tracking-target"><strong><a class="industry-report-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)}</a></strong><small>${escapeHtml(title)}</small></td>
                  <td>读取研报…</td>
                  <td><span class="tracking-pricing-deviation is-neutral">读取研报…</span></td>
                  <td>读取中…</td>
                  <td>读取中…</td>
                  <td>读取研报…</td>
                  <td><div class="tracking-report-links">${fundFlowLink}</div></td>
                  <td><div class="tracking-fundamental-status"><span>读取研报…</span>${equityLink}</div><small class="tracking-updated">${escapeHtml(label)} · ${escapeHtml(timeFromFilename(primary.filename))}<br>来源目录：${escapeHtml(sourceDirectoryLabel(industry, primary))}</small></td>
                  <td>—</td>
                </tr>`;
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

function reportHrefFromAutomations(report) {
  return `../../sources/automations/${report.relativePath}`;
}

function renderStockReportLinkMap(industries, automationReports = []) {
  const links = new Map();
  const addReport = (href, filename) => {
    if (!/(?:机构级(?:决策|研究)?研报|机构级(?:决策|研究)?报告|阅读版)/u.test(filename)) return;
    const stockName = stockNameFromReportTitle(titleFromFilename(filename));
    if (!stockName || links.has(stockName)) return;
    links.set(stockName, href);
  };
  for (const industry of industries) {
    for (const report of industry.feedReports) {
      addReport(reportHref(industry, report), report.filename);
    }
  }
  for (const report of automationReports) {
    addReport(reportHrefFromAutomations(report), report.filename);
  }
  return [...links.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([name, href]) => `  ${JSON.stringify(name)}: ${JSON.stringify(href)},`)
    .join('\n');
}

function renderStockThreeFactorReportLinkMap(automationReports = []) {
  const links = new Map();
  for (const report of automationReports) {
    if (!/-三要素分析\.html$/u.test(report.filename)) continue;
    const stockName = normalizeStockName(titleFromFilename(report.filename).replace(/[-_]?三要素分析$/u, ''));
    if (!stockName) continue;
    const previous = links.get(stockName);
    if (!previous || report.filename.localeCompare(previous.filename, 'zh-CN') > 0) {
      links.set(stockName, { filename: report.filename, href: reportHrefFromAutomations(report) });
    }
  }
  return [...links.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([name, report]) => `  ${JSON.stringify(name)}: ${JSON.stringify(report.href)},`)
    .join('\n');
}

function dailyMonitorDescriptor(filename) {
  const single = filename.match(/^(\d{6}|待核实)-(.+)-每日监控-(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?\.md$/u);
  if (single) {
    const [, code, name, date, time = '0000'] = single;
    return { code, name, date, time, kind: 'single' };
  }
  const summary = filename.match(/^持仓今日监控汇总-(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?\.md$/u);
  if (summary) return { code: '', name: '', date: summary[1], time: summary[2] ?? '0000', kind: 'summary' };
  const legacyPortfolio = filename.match(/^持仓今日监控-(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?\.md$/u)
    ?? filename.match(/^(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?-持仓今日监控\.md$/u);
  if (!legacyPortfolio) return null;
  return { code: '', name: '', date: legacyPortfolio[1], time: legacyPortfolio[2] ?? '0000', kind: 'legacy-portfolio' };
}

function monitorValueFromMarkdown(markdown, descriptor, href, title) {
  const valuationStatus = markdown.match(/估值处置状态[：:]\s*`?(NO_REVALUE|LIGHT_REVALUE|FULL_REVALUE|MANUAL_REVIEW)`?/u)?.[1] ?? '';
  const valuationReason = markdown.match(/触发理由[：:]\s*([^\n]+)/u)?.[1]?.replaceAll('`', '').trim() ?? '';
  const judgment = markdown.match(/当前判断[：:]\s*([^\n]+)/u)?.[1]?.trim() ?? '';
  const monitorStatus = markdown.match(/监控状态[：:]\s*([^\n]+)/u)?.[1]?.trim() ?? '';
  return {
    href,
    title,
    code: descriptor.code,
    name: descriptor.name,
    date: descriptor.date,
    status: judgment || monitorStatus || '打开监控',
    valuationStatus,
    valuationReason,
  };
}

async function scanDailyMonitorData() {
  const entries = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  const links = new Map();
  const reports = [];
  const addLink = (key, value, sortKey) => {
    const normalizedKey = normalizeStockName(key);
    if (!normalizedKey) return;
    const previous = links.get(normalizedKey);
    if (!previous || sortKey.localeCompare(previous.sortKey, 'zh-CN') > 0) {
      links.set(normalizedKey, { value, sortKey });
    }
  };
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const descriptor = dailyMonitorDescriptor(entry.name);
    if (!descriptor) continue;
    const htmlFilename = entry.name.replace(/\.md$/iu, '.html');
    if (!await readFile(join(dataDir, htmlFilename), 'utf8').catch(() => '')) continue;
    const markdown = await readFile(join(dataDir, entry.name), 'utf8').catch(() => '');
    const href = `data/${htmlFilename}`;
    const title = titleFromFilename(htmlFilename);
    const sortKey = `${descriptor.date}-${descriptor.time}-${entry.name}`;
    const values = descriptor.kind === 'single'
      ? [monitorValueFromMarkdown(markdown, descriptor, href, title)]
      : [];
    for (const value of values) {
      addLink(value.code, value, sortKey);
      addLink(value.name, value, sortKey);
    }
    if (descriptor.kind === 'summary') reports.push({ href, title, date: descriptor.date, sortKey });
  }
  const mapSource = [...links.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([key, entry]) => `  ${JSON.stringify(key)}: ${JSON.stringify(entry.value)},`)
    .join('\n');
  const latestSummary = reports.sort((left, right) => right.sortKey.localeCompare(left.sortKey, 'zh-CN'))[0] ?? null;
  return { mapSource, latestSummary };
}

function renderDailyMonitorButton(report) {
  if (!report) {
    return '<button class="button-secondary daily-monitor-button" id="open-daily-monitor" type="button" disabled title="尚未生成 HTML 每日监控汇总报告">每日监控</button>';
  }
  return `<a class="button-secondary daily-monitor-button" id="open-daily-monitor" href="${escapeHtml(report.href)}" target="_blank" rel="noopener noreferrer" title="打开 ${escapeHtml(report.date)} 持仓今日监控汇总报告">每日监控</a>`;
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
  return [...xml.matchAll(/<(?:\w+:)?si\b[\s\S]*?<\/(?:\w+:)?si>/g)].map(match => (
    [...match[0].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(text => decodeXml(text[1])).join('')
  ));
}

function cellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] ?? '';
  const rawValue = cellXml.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? cellXml.match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1] ?? '';
  if (type === 's') return sharedStrings[Number(rawValue)] ?? '';
  return decodeXml(rawValue);
}

function parseXlsxSheetRows(sheetXml, sharedStrings) {
  return [...sheetXml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)].map(rowMatch => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
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

function normalizeTodoFlag(value) {
  const text = String(value ?? '').trim().toLocaleLowerCase('zh-CN');
  if (['是', 'yes', 'y', 'true', '1', '重要', '紧急'].includes(text)) return true;
  if (['否', 'no', 'n', 'false', '0', '不重要', '不紧急'].includes(text)) return false;
  return null;
}

function canonicalTodoQuadrant(value) {
  const text = String(value ?? '').replace(/\s+/g, '').trim();
  return todoQuadrants.find(quadrant => quadrant.label === text)?.label ?? '';
}

function todoQuadrantFromFlags(important, urgent) {
  if (important === true && urgent === true) return '重要且紧急';
  if (important === true && urgent !== true) return '重要不紧急';
  if (important !== true && urgent === true) return '紧急不重要';
  return '不重要且不紧急';
}

function normalizeTodoDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const isoDate = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10);
  }
  return text.slice(0, 20);
}

function parseTodoListFromJson(text) {
  if (!text?.trim()) {
    return { items: [], sourceHref: todoDataHref, sourceNote: `未找到 ${todoDataHref}`, status: 'missing' };
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { items: [], sourceHref: todoDataHref, sourceNote: 'todo.json 格式无效', status: 'invalid' };
  }
  const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
  const rawArchive = Array.isArray(payload?.archive) ? payload.archive : Array.isArray(payload?.archivedItems) ? payload.archivedItems : [];
  const items = rawItems.flatMap((item, rowIndex) => {
    if (!item || typeof item !== 'object') return [];
    const title = String(item.title ?? item['需求事项'] ?? '').trim();
    if (!title) return [];
    const important = normalizeTodoFlag(item.important ?? item['重要性']);
    const urgent = normalizeTodoFlag(item.urgent ?? item['紧急性']);
    const quadrant = canonicalTodoQuadrant(item.quadrant ?? item['四象限标签']) || todoQuadrantFromFlags(important, urgent);
    const dueDate = normalizeTodoDate(item.dueDate ?? item['截止日期']);
    const createdAt = normalizeTodoDate(item.createdAt ?? item['创建时间'] ?? item.updatedAt ?? item['更新时间']);
    const updatedAt = normalizeTodoDate(item.updatedAt ?? item['更新时间'] ?? createdAt);
    return [{
      id: String(item.id ?? item['需求编号'] ?? `TODO-${String(rowIndex + 1).padStart(3, '0')}`).trim(),
      title: truncateText(title, 72),
      detail: truncateText(String(item.detail ?? item['说明'] ?? '').trim(), 150),
      dueDate,
      owner: truncateText(String(item.owner ?? item['负责人'] ?? '').trim(), 18),
      important: important === true ? '是' : important === false ? '否' : '',
      urgent: urgent === true ? '是' : urgent === false ? '否' : '',
      quadrant,
      status: truncateText(String(item.status ?? item['状态'] ?? '').trim() || '未开始', 16),
      source: truncateText(String(item.source ?? item['来源/备注'] ?? item['来源'] ?? '').trim(), 56),
      createdAt,
      updatedAt,
    }];
  }).filter(item => item.status !== '已完成').sort((left, right) => {
    const leftOrder = todoQuadrants.findIndex(quadrant => quadrant.label === left.quadrant);
    const rightOrder = todoQuadrants.findIndex(quadrant => quadrant.label === right.quadrant);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftCreatedAt = left.createdAt || left.updatedAt || '';
    const rightCreatedAt = right.createdAt || right.updatedAt || '';
    const createdAtOrder = (rightCreatedAt || '0000-00-00').localeCompare(leftCreatedAt || '0000-00-00');
    if (createdAtOrder) return createdAtOrder;
    return right.id.localeCompare(left.id, 'zh-CN', { numeric: true })
      || left.title.localeCompare(right.title, 'zh-CN');
  });
  const payloadUpdate = normalizeTodoDate(payload?.updatedAt);
  const latestUpdate = payloadUpdate || items.map(item => item.updatedAt).filter(Boolean).sort().at(-1) || '';
  return {
    items,
    archive: normalizeTodoArchiveItems(rawArchive),
    sourceHref: todoDataHref,
    sourceNote: `来源：${todoDataHref}${latestUpdate ? ` · 更新：${latestUpdate}` : ''}${rawArchive.length ? ` · 已归档${rawArchive.length}项` : ''}`,
    status: 'loaded',
  };
}

function parseDividendSignal(markdown) {
  if (!markdown?.trim()) return null;
  const pick = label => markdown.match(new RegExp(`^- ${label}：(.+)$`, 'mu'))?.[1].trim() ?? '';
  const pickAny = labels => labels.map(pick).find(Boolean) ?? '';
  const runTime = pick('运行时间');
  const recordDate = runTime.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  const signal = {
    recordDate,
    runTime,
    indexDate: pickAny(['指数估值日期', 'AKShare 指数估值日期']),
    bondDate: pick('10年国债收益率日期'),
    dividendYield2: numberFromText(pickAny(['中证红利股息率口径', 'AKShare 中证红利股息率2'])),
    ytdReturn: numberFromText(pickAny(['全年收益率', '年内收益率'])),
    ytdMaxDrawdown: numberFromText(pickAny(['年内最大回撤', '全年最大回撤'])),
    xueqiuChangePercent: pick('雪球当天涨跌幅'),
    lixingerDate: pick('理杏仁估值日期'),
    lixingerDividendYield: pick('理杏仁市值加权股息率'),
    lixingerPercentile10y: pick('理杏仁近10年股息率分位'),
    lixingerPercentile80Value: pick('理杏仁近10年80%分位点'),
    bond10yYield: numberFromText(pick('中国10年国债收益率')),
    spread: numberFromText(pickAny(['指数股息率口径 - 10年国债收益率', 'AKShare 股息率2 - 10年国债收益率'])),
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

function parseDividendAnnualPerformance(source) {
  if (!source?.trim()) return { rows: [] };
  const payload = JSON.parse(source);
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return {
    indexCode: String(payload?.indexCode ?? ''),
    source: String(payload?.source ?? ''),
    firstDate: String(payload?.firstDate ?? ''),
    lastDate: String(payload?.lastDate ?? ''),
    returnConvention: String(payload?.returnConvention ?? ''),
    drawdownConvention: String(payload?.drawdownConvention ?? ''),
    rows: rows.flatMap(row => {
      const year = Number(row?.year);
      const annualReturn = Number(row?.annual_return);
      const maxDrawdown = Number(row?.max_drawdown);
      const startDate = String(row?.start_date ?? '');
      const endDate = String(row?.end_date ?? '');
      if (!Number.isInteger(year) || !Number.isFinite(annualReturn) || !Number.isFinite(maxDrawdown)) return [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return [];
      return [{
        year,
        startDate,
        endDate,
        annualReturn,
        maxDrawdown,
        status: String(row?.status ?? ''),
        monthlyReturns: Array.isArray(row?.monthly_returns) ? row.monthly_returns : [],
      }];
    }).sort((left, right) => left.year - right.year),
  };
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

async function readOptionalSnapshot(filename) {
  try {
    return await readFile(join(marketOverviewDataDir, filename), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn(`数据文件缺失：${filename}；对应内容显示待验证。`);
    return null;
  }
}

const [template, styles, changelogSource, eventCalendarSource, ...modules] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  readFile(join(sourceDir, 'changelog.json'), 'utf8'),
  readFile(join(marketOverviewDataDir, 'event-calendar.json'), 'utf8'),
  ...moduleOrder.map(filename => readFile(join(sourceDir, filename), 'utf8')),
]);
const nasdaqEtfAnchor = JSON.parse(await readOptionalSnapshot('nasdaq-etf-anchor.json') ?? '{}');
const industries = await Promise.all(industryDefinitions.map(scanIndustryReports));
const indexDayStatistics = await readFile(join(repoRoot, 'sources', 'assets', '2026-09-11-index-day-distribution', 'yearly.csv'), 'utf8');
const nasdaqDayStatistics = await readOptionalSnapshot('nasdaq-day-statistics.csv');
const bbxmDailyDigest = await scanBbxmDailyDigest();
const topicPages = await scanTopicPages();
const changelog = validateChangelog(JSON.parse(changelogSource));
const eventCalendar = validateEventCalendar(JSON.parse(eventCalendarSource));
const dividendSignal = parseDividendSignal(await readFile(dividendSignalPath, 'utf8').catch(() => ''));
const dividendYieldHistory = parseDividendYieldHistoryFromWorkbook(await readFile(dividendHistoryWorkbookPath).catch(() => null));
const dividendAnnualPerformance = parseDividendAnnualPerformance(await readFile(dividendAnnualPerformancePath, 'utf8').catch(() => ''));
const todoList = parseTodoListFromJson(await readFile(todoDataPath, 'utf8').catch(() => ''));

const automationReports = await walkHtmlFiles(automationsDir);
const stockReportLinks = renderStockReportLinkMap(industries, automationReports);
const stockThreeFactorReportLinks = renderStockThreeFactorReportLinkMap(automationReports);
const dailyMonitorData = await scanDailyMonitorData();
const bundle = modules
  .map((source, index) => {
    const withGeneratedData = moduleOrder[index] === 'app.mjs'
      ? source
        .replace('  // NASDAQ_ETF_ANCHOR', JSON.stringify(nasdaqEtfAnchor).slice(1, -1))
        .replace('  // STOCK_REPORT_LINKS', stockReportLinks)
        .replace('  // STOCK_THREE_FACTOR_REPORT_LINKS', stockThreeFactorReportLinks)
        .replace('  // DAILY_MONITOR_LINKS', dailyMonitorData.mapSource)
        .replace('  // EVENT_CALENDAR', JSON.stringify(eventCalendar, null, 2))
        .replace('  // CSI_DIVIDEND_SIGNAL', JSON.stringify(dividendSignal, null, 2))
        .replace('  // CSI_DIVIDEND_YIELD_HISTORY', JSON.stringify(dividendYieldHistory, null, 2))
        .replace('  // CSI_DIVIDEND_ANNUAL_PERFORMANCE', JSON.stringify(dividendAnnualPerformance, null, 2))
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
    .replace(`                <!-- ${industry.key}_REPORTS -->`, renderReportRows(industry))
    .replace(`<!-- ${industry.key}_REPORT_COUNT -->`, String(industry.reportTargets.length));
}

const output = renderedTemplate
  .replace('            <!-- DAILY_MONITOR_BUTTON -->', renderDailyMonitorButton(dailyMonitorData.latestSummary))
  .replace('            <!-- BBXM_FEATURED_DIGEST -->', renderFeaturedDigest(bbxmDailyDigest))
  .replace('            <!-- TODO_SUMMARY_CARDS -->', renderTodoSummaryCards(todoList))
  .replace('<!-- TODO_SOURCE_NOTE -->', escapeHtml(todoList.sourceNote))
  .replace('<!-- TODO_COUNT -->', String(todoList.items.length))
  .replace('                <!-- TODO_ARCHIVE_LIST -->', renderTodoArchiveList(todoList))
  .replace('              <!-- TODO_MATRIX -->', renderTodoMatrix(todoList))
  .replace('              <!-- TOPIC_FILTER_TABS -->', renderTopicFilterTabs(topicPages))
  .replace('            <!-- TOPIC_CARDS -->', renderTopicCards(topicPages))
  .replace('        <!-- CHANGELOG_ENTRIES -->', renderChangelog(changelog))
  .replace('<!-- DASHBOARD_STYLES -->', `<style>${styles.trim()}</style>`)
  .replace('<!-- NDX_DAY_CHART -->', nasdaqDayStatistics === null
    ? '<section class="panel index-day-chart" data-index-day-chart="NDX"><h3>纳斯达克100（NDX） · 逐年涨跌震荡天数</h3><p>年度统计数据缺失，待验证。请补充 data/市场总览/nasdaq-day-statistics.csv 后重新构建。</p></section>'
    : renderIndexDayChart(nasdaqDayStatistics, 'NDX'))
  .replace('<!-- DIVIDEND_DAY_CHART -->', renderIndexDayChart(indexDayStatistics, 'H30269.CSI'))
  .replace('<!-- DASHBOARD_SCRIPT -->', () => `<script type="module">${bundle}</script>`);

if (output.includes('DASHBOARD_STYLES') || output.includes('DASHBOARD_SCRIPT') || /<!-- [A-Z_]+ -->/.test(output)) {
  throw new Error('Build placeholders were not fully replaced');
}
if (/from\s+['"]\.\//.test(output)) {
  throw new Error('Local module imports remain in the standalone artifact');
}

await writeFile(outputPath, output, 'utf8');
console.log(`Built ${outputPath} (${Buffer.byteLength(output, 'utf8')} bytes)`);
