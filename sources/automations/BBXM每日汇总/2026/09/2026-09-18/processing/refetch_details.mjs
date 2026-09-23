#!/usr/bin/env node
// 一次性重抓脚本：直取帖子详情页，只提取作者正文（帖子容器内），排除页面外壳与评论重复。
import {
  CdpConnection,
  launchChrome,
  openPageSession,
  sleep,
  waitForChromeDebugPort,
} from "file:///E:/caojingwen/obsidian/llmwiki/.agents/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";
import fs from "node:fs";

const PROFILE = "E:\\caojingwen\\obsidian\\llmwiki\\.agents\\skills\\cjw-xueqiu-daily-monitor\\scripts\\.xueqiu-chrome-profile";
const PORT = 9333;
const OUT = "E:\\caojingwen\\obsidian\\llmwiki\\sources\\automations\\BBXM每日汇总\\2026\\09\\2026-09-18\\processing\\detail-refetch.json";

const URLS = [
  "https://xueqiu.com/7143769715/409824691",
  "https://xueqiu.com/7143769715/409823838",
  "https://xueqiu.com/7143769715/409823541",
  "https://xueqiu.com/7143769715/409810755",
  "https://xueqiu.com/7143769715/409780551",
  "https://xueqiu.com/7143769715/409713758",
  "https://xueqiu.com/7143769715/409713707",
  "https://xueqiu.com/7143769715/409713683",
];

async function evaluateJson(cdp, sessionId, expression, awaitPromise = false) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, { sessionId });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
}

async function waitReady(cdp, sessionId, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await evaluateJson(cdp, sessionId, "document.readyState");
    if (s === "complete") return;
    await sleep(400);
  }
  throw new Error("not ready");
}

const EXTRACT = `(() => {
  const clean = (s) => (s || "").replace(/\\u00a0/g, " ").replace(/[ \\t]+\\n/g, "\\n").replace(/\\n{3,}/g, "\\n\\n").trim();

  // 1) 标题
  const titleEl = document.querySelector("h1") || document.querySelector(".article__bd__title") || document.querySelector(".status-title");
  const title = titleEl ? titleEl.innerText.trim() : document.title.replace(/\\s*-\\s*雪球\\s*$/, "").trim();

  // 2) 发布时间（详情页标注）
  const bodyAll = document.body ? document.body.innerText : "";
  const m = bodyAll.match(/发布于\\s*(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})/);
  const published = m ? m[1] : null;

  // 3) 作者正文：优先 .article__bd，其次 .status-content
  const candidates = [
    ".article__bd__detail",
    ".article__bd",
    ".status-content",
    ".content",
  ];
  let postBody = "";
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 20) {
      postBody = el.innerText;
      break;
    }
  }
  // 兜底：从「关注」之后、「风险提示」/「投诉」之前截
  if (!postBody) {
    const start = bodyAll.indexOf("关注");
    const endMarkers = ["风险提示：用户发表的所有文章", "投诉", "全部讨论（"];
    let end = bodyAll.length;
    for (const em of endMarkers) { const i = bodyAll.indexOf(em, start); if (i > 0 && i < end) end = i; }
    if (start >= 0) postBody = bodyAll.slice(start + 2, end);
  }

  // 4) 只保留作者本人评论：评论区中含「作者」徽标的条目
  const authorComments = [];
  const nodes = document.querySelectorAll(".comment__item, .status-comment-item, [class*=commentItem]");
  nodes.forEach((n) => {
    const txt = (n.innerText || "").trim();
    if (!txt) return;
    // 作者标识：同一评论文本里出现「作者」标签，或包含 冰冰小美作者
    if (/冰冰小美作者|\\n作者\\n|^作者/.test(txt) || /冰冰小美\\s*作者/.test(txt)) {
      const t2 = txt.match(/(\\d{2}-\\d{2} \\d{2}:\\d{2})/);
      authorComments.push({ published_at: t2 ? t2[1] : "", content: clean(txt) });
    }
  });

  return {
    url: location.href,
    title: title,
    published_at: published,
    post_body: clean(postBody),
    author_comments: authorComments,
    has_captcha: /安全威胁|访问验证|请输入验证|滑块/.test(bodyAll),
  };
})()`;

let launched = null;
let wsUrl = null;
try {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) });
  if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl || null;
} catch { /* not running */ }

if (!wsUrl) {
  const chromePath = process.env.CHROME_PATH;
  if (!chromePath) throw new Error("CHROME_PATH not set and CDP unavailable");
  launched = await launchChrome({ chromePath, profileDir: PROFILE, port: PORT, url: "about:blank", headless: false, extraArgs: ["--disable-popup-blocking"] });
  wsUrl = await waitForChromeDebugPort(PORT, 25000, { includeLastError: true });
}

const cdp = await CdpConnection.connect(wsUrl, 12000);
const results = [];
try {
  const page = await openPageSession({ cdp, reusing: true, url: "about:blank", matchTarget: (t) => t.url.includes("xueqiu.com"), activateTarget: false });
  for (const u of URLS) {
    try {
      await cdp.send("Page.navigate", { url: u }, { sessionId: page.sessionId });
      await waitReady(cdp, page.sessionId);
      await sleep(2500);
      const data = await evaluateJson(cdp, page.sessionId, EXTRACT, false);
      results.push(data);
      console.error(`[ok] ${u} body=${(data.post_body || "").length} authorComments=${data.author_comments.length}`);
      await sleep(2000);
    } catch (e) {
      results.push({ url: u, error: String(e).slice(0, 300) });
      console.error(`[fail] ${u} :: ${e}`);
    }
  }
} finally {
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
  console.error("written: " + OUT);
  cdp.close?.();
  if (launched) { try { launched.kill("SIGTERM"); } catch {} }
}
