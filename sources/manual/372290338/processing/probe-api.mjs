#!/usr/bin/env node

import {
  CdpConnection,
  openPageSession,
  waitForChromeDebugPort,
} from "../../../.codex/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";

const id = process.argv[2] || "330347953";
const endpoint = await waitForChromeDebugPort(9333, 2000);
const cdp = await CdpConnection.connect(endpoint, 5000);
const page = await openPageSession({ cdp, reusing: true, url: "https://xueqiu.com", enableNetwork: true });
await new Promise((resolve) => setTimeout(resolve, 2000));
const result = await cdp.send("Runtime.evaluate", {
  expression: `(async () => {
    const urls = [
      "https://xueqiu.com/statuses/show.json?id=${id}",
      "https://xueqiu.com/statuses/show.json?status_id=${id}",
      "https://xueqiu.com/statuses/show/${id}.json"
    ];
    const out = [];
    for (const url of urls) {
      try {
        const response = await fetch(url, { credentials: "include" });
        const text = await response.text();
        out.push({ url, status: response.status, text });
      } catch (error) {
        out.push({ url, error: String(error) });
      }
    }
    return out;
  })()`,
  returnByValue: true,
  awaitPromise: true,
}, { sessionId: page.sessionId, timeoutMs: 20000 });
console.log(JSON.stringify(result.result.value, null, 2));
cdp.close();
