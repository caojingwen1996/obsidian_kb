#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  CdpConnection,
  openPageSession,
  waitForChromeDebugPort,
} from "../../../.codex/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";

const ROOT_URL = "https://xueqiu.com/7052186871/372290338";
const CONTINUATION_URL = "https://xueqiu.com/7052186871/372893503";
const OUTPUT_ROOT = path.resolve("xueqiu_exports/372290338");
const PROCESSING_ROOT = path.join(OUTPUT_ROOT, "processing");
const DEBUG_PORT = 9333;

const CHAPTER_NUMBERS = new Set(["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function safeName(value, fallback = "untitled") {
  const cleaned = cleanText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 90);
  return cleaned || fallback;
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href;
}

function isArticleUrl(value) {
  return /^https:\/\/xueqiu\.com\/7143769715\/\d+$/.test(normalizeUrl(value));
}

function markdownEscape(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function parseOutline(page, sourceUrl) {
  const lines = page.lines.map(cleanText).filter(Boolean);
  const links = page.links
    .map((item) => normalizeUrl(item.href))
    .filter(isArticleUrl);
  let linkIndex = 0;
  let chapter = "";
  let section = "";
  let pending = [];
  const items = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    const afterNext = lines[index + 2];

    if (CHAPTER_NUMBERS.has(line) && next === "、" && afterNext && !/\d{4}-\d{1,2}-\d{1,2}/.test(afterNext)) {
      chapter = `${line}、${afterNext}`;
      section = "";
      pending = [];
      index += 2;
      continue;
    }

    if (/^\d+$/.test(line) && next === "、" && afterNext && !/\d{4}-\d{1,2}-\d{1,2}/.test(afterNext)) {
      section = `${line}、${afterNext}`;
      pending = [];
      index += 2;
      continue;
    }

    if (!chapter || !section) continue;
    if (/^[，。；、·]$/.test(line)) continue;

    const dateMatch = line.match(/(\d{4}-\d{1,2}-\d{1,2})\s*$/);
    if (!dateMatch) {
      pending.push(line);
      continue;
    }

    const titlePart = cleanText(line.slice(0, dateMatch.index));
    const title = [...pending, titlePart].map(cleanText).filter(Boolean).join("");
    pending = [];
    const url = links[linkIndex++];
    if (!url) {
      throw new Error(`Missing article URL for ${chapter} / ${section} / ${title}`);
    }
    items.push({
      order: items.length + 1,
      source_url: sourceUrl,
      chapter,
      section,
      title,
      listed_date: dateMatch[1],
      url,
    });
  }

  if (linkIndex !== links.length) {
    throw new Error(`Parsed ${items.length} items but found ${links.length} article links on ${sourceUrl}`);
  }
  return items;
}

async function evaluateJson(cdp, sessionId, expression, timeoutMs = 15_000) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, { sessionId, timeoutMs });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function waitForReady(cdp, sessionId) {
  for (let i = 0; i < 60; i += 1) {
    const state = await evaluateJson(cdp, sessionId, "document.readyState", 5000);
    if (state === "complete" || state === "interactive") return;
    await sleep(250);
  }
}

async function navigate(cdp, sessionId, url, waitMs = 1600) {
  await cdp.send("Page.navigate", { url }, { sessionId, timeoutMs: 15_000 });
  await waitForReady(cdp, sessionId);
  await sleep(waitMs);
}

async function snapshotPage(cdp, sessionId, url) {
  await navigate(cdp, sessionId, url, 5000);
  return await evaluateJson(cdp, sessionId, `(() => {
    const text = document.body?.innerText || "";
    const lines = text.split(/\\n+/).map((line) => line.trim()).filter(Boolean);
    const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
      text: (a.innerText || a.textContent || "").trim(),
      href: new URL(a.getAttribute("href"), location.href).href,
    }));
    return { title: document.title, url: location.href, lines, links };
  })()`);
}

async function extractArticle(cdp, sessionId, item) {
  await navigate(cdp, sessionId, item.url, 1200);
  const detail = await evaluateJson(cdp, sessionId, `(() => {
    const bodyText = (document.body?.innerText || "").trim();
    const title = [
      document.querySelector("h1")?.innerText,
      document.title,
      ${JSON.stringify(item.title)}
    ].find((value) => value && String(value).trim());
    const author = Array.from(document.querySelectorAll("h1, .user-name, .profile__name, .name"))
      .map((node) => (node.innerText || "").trim())
      .find(Boolean) || "";
    const published = bodyText.match(/\\d{4}-\\d{1,2}-\\d{1,2}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?/)?.[0] || "";
    return {
      page_title: String(title || "").trim(),
      author_name: author,
      published_at: published,
      content: bodyText,
      url: location.href,
    };
  })()`, 20_000);

  const actionText = [detail.page_title, detail.author_name, detail.content].join("\n");
  const looksLikeRealArticle = /风险提示：用户发表的所有文章仅代表个人观点/.test(actionText) && detail.content.length > 300;
  if (!looksLikeRealArticle && /访问验证|请按住滑块|登录雪球|账号密码登录|验证码登录|访问被阻断|安全威胁/.test(actionText)) {
    throw new Error(`Manual action still required at ${item.url}`);
  }
  return detail;
}

function articleMarkdown(item, detail) {
  return [
    "---",
    `title: ${JSON.stringify(item.title)}`,
    `source_url: ${item.url}`,
    `source_page: ${item.source_url}`,
    `chapter: ${JSON.stringify(item.chapter)}`,
    `section: ${JSON.stringify(item.section)}`,
    `listed_date: ${item.listed_date}`,
    `scraped_at: ${new Date().toISOString()}`,
    "---",
    "",
    `# ${item.title}`,
    "",
    `- 章节：${item.chapter}`,
    `- 小节：${item.section}`,
    `- 目录日期：${item.listed_date}`,
    `- 原文：${item.url}`,
    detail.published_at ? `- 页面时间：${detail.published_at}` : "",
    "",
    "## 正文",
    "",
    markdownEscape(detail.content),
    "",
  ].filter((line) => line !== "").join("\n");
}

function indexMarkdown(items) {
  const lines = [
    "# 冰冰小美体系",
    "",
    `- 来源：${ROOT_URL}`,
    `- 续帖：${CONTINUATION_URL}`,
    `- 抓取时间：${new Date().toISOString()}`,
    `- 文章数：${items.length}`,
    "",
  ];
  let currentChapter = "";
  let currentSection = "";
  for (const item of items) {
    if (item.chapter !== currentChapter) {
      currentChapter = item.chapter;
      lines.push(`## ${currentChapter}`, "");
      currentSection = "";
    }
    if (item.section !== currentSection) {
      currentSection = item.section;
      lines.push(`### ${currentSection}`, "");
    }
    lines.push(`- [${String(item.order).padStart(3, "0")}_${item.title}](${item.relative_path.replace(/\\/g, "/")})`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(PROCESSING_ROOT, { recursive: true });
  const endpoint = await waitForChromeDebugPort(DEBUG_PORT, 2000);
  const cdp = await CdpConnection.connect(endpoint, 5000, { defaultTimeoutMs: 20_000 });
  const page = await openPageSession({ cdp, reusing: true, url: "about:blank", enableNetwork: true });

  try {
    const snapshots = [];
    for (const url of [ROOT_URL, CONTINUATION_URL]) {
      const snapshot = await snapshotPage(cdp, page.sessionId, url);
      snapshots.push(snapshot);
      await fs.writeFile(
        path.join(PROCESSING_ROOT, `snapshot-${url.split("/").pop()}.json`),
        JSON.stringify(snapshot, null, 2),
        "utf8"
      );
    }

    let items = snapshots.flatMap((snapshot) => parseOutline(snapshot, snapshot.url));
    if (items.length === 0) {
      const existingArticlesPath = path.join(PROCESSING_ROOT, "articles-progress.json");
      const existingArticles = JSON.parse(await fs.readFile(existingArticlesPath, "utf8"));
      items = existingArticles.map((item) => ({
        order: item.order,
        source_url: item.source_url,
        chapter: item.chapter,
        section: item.section,
        title: item.title,
        listed_date: item.listed_date,
        url: item.url,
        relative_path: item.relative_path,
      }));
    }
    items.forEach((item, index) => { item.order = index + 1; });
    await fs.writeFile(path.join(PROCESSING_ROOT, "source-outline.json"), JSON.stringify(items, null, 2), "utf8");

    const articles = [];
    for (const item of items) {
      const chapterDir = safeName(item.chapter);
      const sectionDir = safeName(item.section);
      const fileName = `${String(item.order).padStart(3, "0")}_${safeName(item.title)}.md`;
      const outDir = path.join(OUTPUT_ROOT, chapterDir, sectionDir);
      const outPath = path.join(outDir, fileName);
      await fs.mkdir(outDir, { recursive: true });

      item.relative_path = path.relative(OUTPUT_ROOT, outPath);
      let existing = "";
      const legacyPath = path.join(
        OUTPUT_ROOT,
        `${String(item.order).padStart(3, "0")}_${safeName(item.chapter)}`,
        sectionDir,
        fileName
      );
      try {
        existing = await fs.readFile(outPath, "utf8");
      } catch {
        existing = "";
      }
      if (!existing) {
        try {
          const legacyContent = await fs.readFile(legacyPath, "utf8");
          await fs.writeFile(outPath, legacyContent, "utf8");
          existing = legacyContent;
        } catch {
          existing = "";
        }
      }
      const existingBlocked = /访问被阻断|安全威胁|访问验证|请按住滑块/.test(existing);
      if (existing.length > 300 && !existingBlocked) {
        process.stdout.write(`[${item.order}/${items.length}] skip existing ${item.title}\n`);
        articles.push({ ...item, detail: { content_length: existing.length, reused_existing: true } });
        continue;
      }

      process.stdout.write(`[${item.order}/${items.length}] ${item.chapter} / ${item.section} / ${item.title}\n`);
      await sleep(3500);
      const detail = await extractArticle(cdp, page.sessionId, item);
      await fs.writeFile(outPath, articleMarkdown(item, detail), "utf8");
      articles.push({ ...item, detail: { ...detail, content_length: detail.content.length, content: undefined } });
      await fs.writeFile(path.join(PROCESSING_ROOT, "articles-progress.json"), JSON.stringify(articles, null, 2), "utf8");
    }

    await fs.writeFile(path.join(PROCESSING_ROOT, "articles.json"), JSON.stringify(articles, null, 2), "utf8");
    await fs.writeFile(path.join(OUTPUT_ROOT, "index.md"), indexMarkdown(items), "utf8");
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
