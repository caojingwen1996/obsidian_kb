#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  CdpConnection,
  openPageSession,
  sleep,
  waitForChromeDebugPort,
} from "../../../../.codex/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";

const SOURCE_URL = "https://xueqiu.com/2786922896/372435019";
const OUTPUT_ROOT = path.resolve("output/xueqiu_exports/江淮汽车跟踪");
const PROCESSING_ROOT = path.join(OUTPUT_ROOT, "processing");
const DEBUG_PORT = 9333;

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeName(value, fallback = "untitled") {
  const cleaned = cleanText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 72);
  return cleaned || fallback;
}

function normalizeUrl(value) {
  const url = new URL(value, SOURCE_URL);
  url.hash = "";
  url.search = "";
  return url.href;
}

function isXueqiuArticleUrl(value) {
  return /^https:\/\/xueqiu\.com\/\d+\/\d+$/.test(normalizeUrl(value));
}

function decodeEntities(value) {
  const named = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return String(value || "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity] ?? match;
  });
}

function htmlToMarkdown(value) {
  return decodeEntities(String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, text) => {
      const label = cleanText(text.replace(/<[^>]+>/g, "")) || href;
      const url = href.startsWith("//") ? `https:${href}` : href;
      return `[${label}](${url})`;
    })
    .replace(/<img\b[^>]*(?:alt|title)=["']([^"']*)["'][^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function urlsFromHtml(html) {
  const urls = [];
  const hrefPattern = /href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const href = decodeEntities(match[1]);
    try {
      const normalized = normalizeUrl(href.startsWith("//") ? `https:${href}` : href);
      if (isXueqiuArticleUrl(normalized)) urls.push(normalized);
    } catch {
      // Ignore malformed page links.
    }
  }
  return urls;
}

function titleFromStatus(status, order) {
  return cleanText(
    status.title ||
    htmlToMarkdown(status.text || status.description || "").split("\n").find(Boolean) ||
    `article-${order}`
  );
}

async function evaluateJson(cdp, sessionId, expression, timeoutMs = 20_000) {
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

async function fetchStatus(cdp, sessionId, url) {
  const id = url.split("/").pop();
  const apiUrl = `https://xueqiu.com/statuses/show.json?id=${id}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await evaluateJson(cdp, sessionId, `fetch(${JSON.stringify(apiUrl)}, {
      credentials: "include",
      headers: { "accept": "application/json, text/plain, */*" }
    }).then(async (response) => {
      const buffer = await response.arrayBuffer();
      return { status: response.status, text: new TextDecoder("utf-8").decode(buffer) };
    })`, 25_000);
    const text = response?.text || "";
    const trimmed = String(text || "").trim();
    if (trimmed.startsWith("{") && trimmed.includes(`"id":${id}`)) {
      return JSON.parse(trimmed);
    }
    await sleep(1500 * attempt);
  }
  throw new Error("API page did not return status JSON");
}

async function navigate(cdp, sessionId, url, waitMs = 1000) {
  await cdp.send("Page.navigate", { url }, { sessionId, timeoutMs: 25_000 });
  await sleep(waitMs);
}

async function extractDomLinks(cdp, sessionId) {
  await navigate(cdp, sessionId, SOURCE_URL, 2500);
  return await evaluateJson(cdp, sessionId, `(() => Array.from(document.querySelectorAll("a[href]"))
    .map((anchor) => new URL(anchor.getAttribute("href"), location.href).href))()`, 20_000);
}

async function existingItemsByUrl() {
  const map = new Map();
  let entries = [];
  try {
    entries = await fs.readdir(OUTPUT_ROOT, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md") || entry.name === "index.md") continue;
    const filePath = path.join(OUTPUT_ROOT, entry.name);
    const markdown = await fs.readFile(filePath, "utf8");
    const url = markdown.match(/^source_url:\s*(https:\/\/xueqiu\.com\/\d+\/\d+)/m)?.[1];
    const order = Number.parseInt(markdown.match(/^order:\s*(\d+)/m)?.[1] || "", 10);
    const title = cleanText(markdown.match(/^#\s+(.+)$/m)?.[1] || path.basename(entry.name, ".md"));
    if (url && Number.isFinite(order)) {
      map.set(url, {
        order,
        title,
        url,
        relative_path: path.relative(OUTPUT_ROOT, filePath),
      });
    }
  }
  return map;
}

function markdownFromStatus(item, status) {
  const body = htmlToMarkdown(status.text || status.description || "");
  return [
    "---",
    `title: ${JSON.stringify(item.title)}`,
    `source_url: ${item.url}`,
    `source_page: ${SOURCE_URL}`,
    `order: ${item.order}`,
    `scraped_at: ${new Date().toISOString()}`,
    status.created_at ? `published_at: ${formatDate(status.created_at)}` : "",
    "---",
    "",
    `# ${item.title}`,
    "",
    `- 来源：${item.url}`,
    item.url === SOURCE_URL ? "" : `- 上级帖子：${SOURCE_URL}`,
    status.created_at ? `- 页面时间：${formatDate(status.created_at)}` : "",
    "",
    "## 正文",
    "",
    body || "（正文为空或雪球未返回正文。）",
    "",
  ].filter((line) => line !== "").join("\n");
}

function indexMarkdown(items, unresolved) {
  return [
    "# 江淮汽车跟踪",
    "",
    `- 来源：${SOURCE_URL}`,
    `- 抓取时间：${new Date().toISOString()}`,
    `- 已保存 Markdown：${items.length}`,
    `- 未完成：${unresolved.length}`,
    "",
    "## 已保存",
    "",
    ...items
      .sort((a, b) => a.order - b.order)
      .map((item) => `- [${String(item.order).padStart(3, "0")}_${item.title}](${item.relative_path.replace(/\\/g, "/")}) - ${item.url}`),
    "",
    "## 未完成",
    "",
    ...(unresolved.length
      ? unresolved.map((item) => `- ${String(item.order).padStart(3, "0")} ${item.url}：${item.error}`)
      : ["- 无"]),
    "",
  ].join("\n");
}

async function main() {
  await fs.mkdir(PROCESSING_ROOT, { recursive: true });
  const endpoint = await waitForChromeDebugPort(DEBUG_PORT, 5000);
  const cdp = await CdpConnection.connect(endpoint, 5000, { defaultTimeoutMs: 25_000 });
  const page = await openPageSession({
    cdp,
    reusing: false,
    url: "https://xueqiu.com/",
    matchTarget: (target) => target.type === "page" && String(target.url || "").includes("xueqiu.com"),
    enableNetwork: true,
  });

  try {
    let sourceStatus = null;
    let linkedUrls = [];
    try {
      const savedLinks = JSON.parse(await fs.readFile(path.join(PROCESSING_ROOT, "source-links.json"), "utf8"));
      linkedUrls = Array.isArray(savedLinks.urls) ? savedLinks.urls : [];
      sourceStatus = JSON.parse(await fs.readFile(path.join(PROCESSING_ROOT, "source-status.json"), "utf8"));
    } catch {
      sourceStatus = await fetchStatus(cdp, page.sessionId, SOURCE_URL);
    }
    const apiLinks = urlsFromHtml(`${sourceStatus.text || ""}\n${sourceStatus.description || ""}`);
    const domLinks = [];
    const sourceUrl = normalizeUrl(SOURCE_URL);
    linkedUrls = linkedUrls.length
      ? linkedUrls
      : Array.from(new Set([...apiLinks, ...domLinks])).filter((url) => url !== sourceUrl);

    await fs.writeFile(path.join(PROCESSING_ROOT, "source-status.json"), JSON.stringify(sourceStatus, null, 2), "utf8");
    await fs.writeFile(path.join(PROCESSING_ROOT, "source-links.json"), JSON.stringify({
      source: SOURCE_URL,
      apiLinks: apiLinks.length,
      domLinks: domLinks.length,
      count: linkedUrls.length,
      urls: linkedUrls,
    }, null, 2), "utf8");

    const queue = [sourceUrl, ...linkedUrls].map((url, order) => ({ url, order }));
    const existing = await existingItemsByUrl();
    const items = Array.from(existing.values());
    const unresolved = [];

    for (const queued of queue) {
      if (existing.has(queued.url)) continue;
      try {
        const status = queued.url === sourceUrl ? sourceStatus : await fetchStatus(cdp, page.sessionId, queued.url);
        const title = titleFromStatus(status, queued.order);
        const item = {
          order: queued.order,
          title,
          url: queued.url,
        };
        const markdown = markdownFromStatus(item, status);
        const outPath = path.join(OUTPUT_ROOT, `${String(queued.order).padStart(3, "0")}_${safeName(title)}.md`);
        await fs.writeFile(outPath, markdown, "utf8");
        items.push({
          ...item,
          relative_path: path.relative(OUTPUT_ROOT, outPath),
          content_length: htmlToMarkdown(status.text || status.description || "").length,
          published_at: formatDate(status.created_at),
        });
        await fs.writeFile(path.join(PROCESSING_ROOT, "articles-progress.json"), JSON.stringify(items, null, 2), "utf8");
        await sleep(900);
      } catch (error) {
        unresolved.push({ ...queued, error: error instanceof Error ? error.message : String(error) });
        await fs.writeFile(path.join(PROCESSING_ROOT, "unresolved-progress.json"), JSON.stringify(unresolved, null, 2), "utf8");
      }
    }

    await fs.writeFile(path.join(PROCESSING_ROOT, "articles.json"), JSON.stringify(items, null, 2), "utf8");
    await fs.writeFile(path.join(PROCESSING_ROOT, "unresolved.json"), JSON.stringify(unresolved, null, 2), "utf8");
    await fs.writeFile(path.join(OUTPUT_ROOT, "index.md"), indexMarkdown(items, unresolved), "utf8");
    process.stdout.write(JSON.stringify({ saved: items.length, unresolved: unresolved.length, outputRoot: OUTPUT_ROOT }, null, 2));
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

