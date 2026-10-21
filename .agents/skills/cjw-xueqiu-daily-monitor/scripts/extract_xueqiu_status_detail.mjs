#!/usr/bin/env node
// Temporary helper: fetch full Xueqiu status text via the in-page status API.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CdpConnection, openPageSession, sleep } from "./vendor/baoyu-chrome-cdp/src/index.mjs";

const argv = process.argv.slice(2);
function getArg(name, fallback = "") {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
}

const idsFile = getArg("ids-file");
const outputFile = getArg("output-file");
const debugPort = Number.parseInt(getArg("debug-port", "9333"), 10);
const delayMin = Number.parseInt(getArg("delay-min", "1500"), 10);
const delayMax = Number.parseInt(getArg("delay-max", "3500"), 10);
const idsArg = argv.filter((item) => /^\d{6,}$/.test(item));

let ids = [];
if (idsFile) ids = fs.readFileSync(idsFile, "utf8").split(/\s+/).map((v) => v.trim()).filter(Boolean);
if (idsArg.length) ids = idsArg;

if (!ids.length) {
  process.stderr.write("no ids provided\n");
  process.exit(1);
}

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
  url: "https://www.xueqiu.com/",
  matchTarget: (target) => target.type === "page" && target.url.includes("xueqiu.com"),
});
const sessionId = session.sessionId;
await sleep(3500);

const results = [];
for (let index = 0; index < ids.length; index += 1) {
  const id = ids[index];
  const expression = `
    (async () => {
      const response = await fetch("/statuses/show.json?id=${encodeURIComponent(id)}", {
        credentials: "include",
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) return { id: "${id}", error: "HTTP " + response.status };
      const data = await response.json();
      return { id: "${id}", title: data.title || "", text: data.text || "", created_at: data.created_at };
    })()
  `;
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    { sessionId }
  );
  const value = result?.result?.value;
  if (!value || value.error) {
    process.stderr.write(`[detail] ${id} failed: ${value?.error || "unknown"}\n`);
    results.push({ id, error: value?.error || "unknown" });
  } else {
    process.stderr.write(`[detail] ${index + 1}/${ids.length} ${id} len=${(value.text || "").length}\n`);
    results.push(value);
  }
  if (index < ids.length - 1) {
    await sleep(delayMin + Math.floor(Math.random() * Math.max(0, delayMax - delayMin)));
  }
}

const text = JSON.stringify({ fetched_at: new Date().toISOString(), count: results.length, items: results }, null, 2);
if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, text, "utf8");
  process.stderr.write(`[detail] wrote ${outputFile}\n`);
} else {
  process.stdout.write(text + "\n");
}
ws.close();
process.exit(0);
