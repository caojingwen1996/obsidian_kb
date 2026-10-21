#!/usr/bin/env node
// Temporary helper: pull a Xueqiu user timeline via the in-page API (same-origin fetch)
// so pagination beyond the visible scroll window is possible.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CdpConnection, openPageSession, sleep } from "./vendor/baoyu-chrome-cdp/src/index.mjs";

const argv = process.argv.slice(2);
function getArg(name, fallback = "") {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
}

const accountUrl = getArg("account-url");
const userId = getArg("user-id");
const maxPages = Number.parseInt(getArg("max-pages", "10"), 10);
const debugPort = Number.parseInt(getArg("debug-port", "9333"), 10);
const outputFile = getArg("output-file", "");
const warmupUrl = getArg("warmup-url", accountUrl || "https://www.xueqiu.com/");

const baseUrl = `http://127.0.0.1:${debugPort}`;
const version = await (await fetch(`${baseUrl}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const cdp = new CdpConnection(ws);

const session = await openPageSession({
  cdp,
  reusing: false,
  url: warmupUrl,
  matchTarget: (target) => target.type === "page" && target.url.includes("xueqiu.com"),
});
const sessionId = session.sessionId;
await sleep(4000);

const all = [];
for (let page = 1; page <= maxPages; page += 1) {
  const expression = `
    (async () => {
      const url = "/v4/statuses/user_timeline.json?user_id=${encodeURIComponent(userId)}&page=${page}&count=20";
      const response = await fetch(url, { credentials: "include", headers: { "Accept": "application/json" } });
      if (!response.ok) return { error: "HTTP " + response.status, page: ${page} };
      const data = await response.json();
      return { page: ${page}, statuses: data.statuses || [] };
    })()
  `;
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    { sessionId }
  );
  const value = result?.result?.value;
  if (!value || value.error) {
    process.stderr.write(`[api] page ${page} failed: ${value?.error || JSON.stringify(result?.exceptionDetails || {})}\n`);
    break;
  }
  const statuses = value.statuses || [];
  process.stderr.write(`[api] page ${page}: ${statuses.length} statuses\n`);
  if (statuses.length === 0) break;
  all.push(...statuses);
  await sleep(1200);
}

const payload = {
  user_id: userId,
  account_url: accountUrl,
  fetched_at: new Date().toISOString(),
  count: all.length,
  statuses: all.map((s) => ({
    id: s.id,
    title: s.title || "",
    created_at: s.created_at,
    text: s.text || s.description || "",
    truncated: Boolean(s.truncated),
    retweet: s.retweet_status?.text || "",
  })),
};
const text = JSON.stringify(payload, null, 2);
if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, text, "utf8");
  process.stderr.write(`[api] wrote ${outputFile} (${payload.count})\n`);
} else {
  process.stdout.write(text + "\n");
}
ws.close();
process.exit(0);
