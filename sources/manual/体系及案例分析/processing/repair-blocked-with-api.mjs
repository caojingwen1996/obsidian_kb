#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  CdpConnection,
  openPageSession,
  waitForChromeDebugPort,
} from "../../../.codex/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";

const OUTPUT_ROOT = path.resolve("xueqiu_exports/372290338");
const PROCESSING_ROOT = path.join(OUTPUT_ROOT, "processing");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlToText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function articleMarkdown(item, api) {
  const createdAt = api.created_at ? new Date(api.created_at).toISOString() : "";
  const content = htmlToText(api.text || api.description || "");
  return [
    "---",
    `title: ${JSON.stringify(item.title)}`,
    `source_url: ${item.url}`,
    `source_page: ${item.source_url}`,
    `chapter: ${JSON.stringify(item.chapter)}`,
    `section: ${JSON.stringify(item.section)}`,
    `listed_date: ${item.listed_date}`,
    createdAt ? `published_at: ${createdAt}` : "",
    `scraped_at: ${new Date().toISOString()}`,
    "repair_source: xueqiu_status_api",
    "---",
    "",
    `# ${item.title}`,
    "",
    `- 章节：${item.chapter}`,
    `- 小节：${item.section}`,
    `- 目录日期：${item.listed_date}`,
    `- 原文：${item.url}`,
    createdAt ? `- 接口时间：${createdAt}` : "",
    "",
    "## 正文",
    "",
    content,
    "",
  ].filter((line) => line !== "").join("\n");
}

function unavailableMarkdown(item, reason) {
  return [
    "---",
    `title: ${JSON.stringify(item.title)}`,
    `source_url: ${item.url}`,
    `source_page: ${item.source_url}`,
    `chapter: ${JSON.stringify(item.chapter)}`,
    `section: ${JSON.stringify(item.section)}`,
    `listed_date: ${item.listed_date}`,
    `scraped_at: ${new Date().toISOString()}`,
    "repair_source: xueqiu_status_api",
    "content_unavailable: true",
    "---",
    "",
    `# ${item.title}`,
    "",
    `- 章节：${item.chapter}`,
    `- 小节：${item.section}`,
    `- 目录日期：${item.listed_date}`,
    `- 原文：${item.url}`,
    `- 状态：${reason}`,
    "",
  ].join("\n");
}

async function evaluateJson(cdp, sessionId, expression, timeoutMs = 20_000) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, { sessionId, timeoutMs });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result?.value;
}

async function fetchStatus(cdp, sessionId, id) {
  return await evaluateJson(cdp, sessionId, `(async () => {
    const response = await fetch("https://xueqiu.com/statuses/show.json?id=${id}", { credentials: "include" });
    const text = await response.text();
    return { status: response.status, text };
  })()`, 25_000);
}

async function main() {
  const progressPath = path.join(PROCESSING_ROOT, "articles-progress.json");
  const articles = JSON.parse(await fs.readFile(progressPath, "utf8"));
  const blockedTerms = ["访问被阻断", "安全威胁"];
  const blockedItems = [];
  for (const item of articles) {
    const filePath = path.join(OUTPUT_ROOT, item.relative_path);
    let text = "";
    try {
      text = await fs.readFile(filePath, "utf8");
    } catch {
      text = "";
    }
    if (blockedTerms.some((term) => text.includes(term))) blockedItems.push({ item, filePath });
  }

  const endpoint = await waitForChromeDebugPort(9333, 2000);
  const cdp = await CdpConnection.connect(endpoint, 5000);
  const page = await openPageSession({ cdp, reusing: true, url: "https://xueqiu.com", enableNetwork: true });
  await sleep(1500);

  const repaired = [];
  try {
    for (const { item, filePath } of blockedItems) {
      const id = item.url.split("/").pop();
      process.stdout.write(`[repair ${repaired.length + 1}/${blockedItems.length}] ${item.order} ${item.title}\n`);
      let response;
      try {
        response = await fetchStatus(cdp, page.sessionId, id);
      } catch (error) {
        const reason = `接口请求超时或失败：${error instanceof Error ? error.message : String(error)}`;
        await fs.writeFile(filePath, unavailableMarkdown(item, reason), "utf8");
        item.detail = {
          ...(item.detail || {}),
          api_repaired: false,
          content_unavailable: true,
          unavailable_reason: reason,
        };
        repaired.push(item);
        await sleep(900);
        continue;
      }
      if (response.status !== 200) {
        let reason = `API status ${response.status}`;
        try {
          const errorPayload = JSON.parse(response.text);
          reason = errorPayload.error_description || reason;
        } catch {
          reason = `${reason}: ${response.text.slice(0, 120)}`;
        }
        await fs.writeFile(filePath, unavailableMarkdown(item, reason), "utf8");
        item.detail = {
          ...(item.detail || {}),
          api_repaired: false,
          content_unavailable: true,
          unavailable_reason: reason,
        };
        repaired.push(item);
        await sleep(900);
        continue;
      }
      const api = JSON.parse(response.text);
      const content = htmlToText(api.text || api.description || "");
      if (content.length < 30) {
        const reason = "接口返回正文为空";
        await fs.writeFile(filePath, unavailableMarkdown(item, reason), "utf8");
        item.detail = {
          ...(item.detail || {}),
          api_repaired: false,
          content_unavailable: true,
          unavailable_reason: reason,
        };
        repaired.push(item);
        await sleep(900);
        continue;
      }
      await fs.writeFile(filePath, articleMarkdown(item, api), "utf8");
      item.detail = {
        ...(item.detail || {}),
        api_repaired: true,
        content_length: content.length,
        published_at: api.created_at ? new Date(api.created_at).toISOString() : item.detail?.published_at,
      };
      repaired.push(item);
      await sleep(900);
    }
  } finally {
    cdp.close();
  }

  await fs.writeFile(path.join(PROCESSING_ROOT, "articles.json"), JSON.stringify(articles, null, 2), "utf8");
  await fs.writeFile(path.join(PROCESSING_ROOT, "source-outline.json"), JSON.stringify(articles.map((item) => ({
    order: item.order,
    source_url: item.source_url,
    chapter: item.chapter,
    section: item.section,
    title: item.title,
    listed_date: item.listed_date,
    url: item.url,
    relative_path: item.relative_path,
  })), null, 2), "utf8");
  await fs.writeFile(path.join(PROCESSING_ROOT, "api-repaired.json"), JSON.stringify(repaired, null, 2), "utf8");
  process.stdout.write(`repaired=${repaired.length}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
