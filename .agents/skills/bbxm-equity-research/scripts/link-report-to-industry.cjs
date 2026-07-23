const fs = require('node:fs');
const path = require('node:path');

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function findIndustryReport(directory, equityPath, explicitPath) {
  if (explicitPath) return path.resolve(explicitPath);
  const candidates = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => path.join(directory, entry.name))
    .filter((candidate) => path.resolve(candidate) !== path.resolve(equityPath))
    .filter((candidate) => /产业.*(?:完整)?分析报告|产业研报/.test(path.basename(candidate)));

  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    throw new Error(`multiple-industry-reports: ${candidates.map((item) => path.basename(item)).join(', ')}`);
  }
  return candidates[0];
}

function extractLabel(html, filename) {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  return title || path.basename(filename, path.extname(filename));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCompanyName(filename, label) {
  const base = path.basename(filename, path.extname(filename));
  const fromFile = base
    .replace(/^\d{4}-\d{2}-\d{2}(?:-\d{4})?-/, '')
    .replace(/-?机构级决策研报$/, '')
    .trim();
  if (fromFile) return fromFile;
  return label
    .replace(/（[^）]+）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/机构级决策研报.*$/, '')
    .trim();
}

function linkCompanyInIndustryChain(industryHtml, filename, label) {
  const companyName = extractCompanyName(filename, label);
  if (!companyName) return null;

  const sectionMatch = industryHtml.match(/<h3[^>]*>\s*3\.1\.1\s+产业链公司映射/i);
  if (!sectionMatch || sectionMatch.index === undefined) return null;
  const sectionStart = sectionMatch.index;
  const nextSection = industryHtml.indexOf('<h3', sectionStart + 1);
  const sectionEnd = nextSection >= 0 ? nextSection : industryHtml.length;
  const before = industryHtml.slice(0, sectionStart);
  let section = industryHtml.slice(sectionStart, sectionEnd);
  const after = industryHtml.slice(sectionEnd);

  const encodedFilename = escapeHtml(filename);
  const link = `<a href="./${encodedFilename}">`;
  const companyPattern = escapeRegExp(companyName);

  const linkedCell = new RegExp(`(<td>\\s*<a\\s+href=")[^"]+("[^>]*>[^<]*${companyPattern}[^<]*<\\/a>\\s*<\\/td>)`);
  if (linkedCell.test(section)) {
    section = section.replace(linkedCell, `$1./${encodedFilename}$2`);
    return {
      html: `${before}${section}${after}`,
      status: section.includes(`href="./${encodedFilename}"`) ? 'linked-in-industry-chain' : 'already-linked',
    };
  }

  const plainCell = new RegExp(`(<td>)([^<]*${companyPattern}[^<]*)(<\\/td>)`);
  if (plainCell.test(section)) {
    section = section.replace(plainCell, `$1<a href="./${encodedFilename}">$2</a>$3`);
    return {
      html: `${before}${section}${after}`,
      status: 'linked-in-industry-chain',
    };
  }

  return null;
}

function insertLink(industryHtml, filename, label) {
  const encodedFilename = escapeHtml(filename);
  const industryChainResult = linkCompanyInIndustryChain(industryHtml, filename, label);
  if (industryChainResult) return industryChainResult;

  if (industryHtml.includes(`href="./${encodedFilename}"`) || industryHtml.includes(`href="${encodedFilename}"`)) {
    return { html: industryHtml, status: 'already-linked' };
  }

  const item = `<li data-equity-report="${encodedFilename}"><a href="./${encodedFilename}">${escapeHtml(label)}</a></li>`;
  const sectionStart = industryHtml.indexOf('id="equity-research-links"');
  if (sectionStart >= 0) {
    const listEnd = industryHtml.indexOf('</ul>', sectionStart);
    if (listEnd < 0) throw new Error('invalid-equity-research-links-section: missing </ul>');
    return {
      html: `${industryHtml.slice(0, listEnd)}${item}\n${industryHtml.slice(listEnd)}`,
      status: 'linked',
    };
  }

  const section = `\n<section id="equity-research-links">\n<h2>个股研报链接</h2>\n<p>以下链接由个股研报流程在同一产业目录内自动维护。</p>\n<ul>\n${item}\n</ul>\n</section>\n`;
  for (const marker of ['</main>', '</article>', '</body>']) {
    const index = industryHtml.lastIndexOf(marker);
    if (index >= 0) {
      return {
        html: `${industryHtml.slice(0, index)}${section}${industryHtml.slice(index)}`,
        status: 'linked',
      };
    }
  }
  throw new Error('invalid-industry-report: missing closing main, article, or body tag');
}

const equityArg = getArg('--equity-html');
if (!equityArg) {
  console.error('usage: node link-report-to-industry.cjs --equity-html <report.html> [--industry-report <industry.html>]');
  process.exit(2);
}

const equityPath = path.resolve(equityArg);
if (!fs.existsSync(equityPath)) {
  console.error(`equity-html-not-found: ${equityPath}`);
  process.exit(2);
}

try {
  const industryPath = findIndustryReport(path.dirname(equityPath), equityPath, getArg('--industry-report'));
  if (!industryPath) {
    console.log(`industry-report-not-found: ${path.dirname(equityPath)}`);
    process.exit(0);
  }
  if (!fs.existsSync(industryPath)) throw new Error(`industry-report-not-found: ${industryPath}`);

  const equityHtml = fs.readFileSync(equityPath, 'utf8');
  const industryHtml = fs.readFileSync(industryPath, 'utf8');
  const result = insertLink(industryHtml, path.basename(equityPath), extractLabel(equityHtml, equityPath));
  if (result.html !== industryHtml) fs.writeFileSync(industryPath, result.html, 'utf8');
  console.log(`${result.status}: ${industryPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
