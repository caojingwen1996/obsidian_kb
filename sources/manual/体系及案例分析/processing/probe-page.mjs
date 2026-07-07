#!/usr/bin/env node

import {
  CdpConnection,
  openPageSession,
  waitForChromeDebugPort,
} from "../../../.codex/skills/cjw-xueqiu-daily-monitor/scripts/vendor/baoyu-chrome-cdp/src/index.mjs";

const url = process.argv[2] || "https://xueqiu.com/7052186871/372290338";
const port = 9333;

async function main() {
  const endpoint = await waitForChromeDebugPort(port, 1000);
  const cdp = await CdpConnection.connect(endpoint, 5000);
  const page = await openPageSession({
    cdp,
    reusing: true,
    url: "about:blank",
  });
  await cdp.send("Page.navigate", { url }, { sessionId: page.sessionId });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const text = document.body.innerText;
      const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        text: (a.innerText || a.textContent || '').trim(),
        href: a.href,
      })).filter((item) => /xueqiu\\.com\\/\\d+\\/\\d+/.test(item.href));
      const lines = text.split(/\\n+/).map((line) => line.trim()).filter(Boolean);
      return { title: document.title, url: location.href, text: text.slice(0, 12000), lines: lines.slice(0, 240), links };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, { sessionId: page.sessionId });
  console.log(JSON.stringify(result.result.value, null, 2));
  await cdp.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
