// Independent homepage coverage verification for 2026-09-28.
// Self-launches Chrome (CDP 9333 is not persistent across runs).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SCRIPTS = "file:///E:/caojingwen/obsidian/llmwiki/.agents/skills/cjw-xueqiu-daily-monitor/scripts";
const VENDOR = `${SKILL_SCRIPTS}/vendor/baoyu-chrome-cdp/src/index.mjs`;

const { launchChrome, waitForChromeDebugPort, openPageSession, CdpConnection, sleep } = await import(VENDOR);
const { evaluateJson, waitForDocumentReady } = await import(`${SKILL_SCRIPTS}/extract_xueqiu_posts.mjs`);

const PROFILE_DIR = "E:\\caojingwen\\obsidian\\llmwiki\\.agents\\skills\\cjw-xueqiu-daily-monitor\\scripts\\.xueqiu-chrome-profile";
const CHROME_PATH = "C:\\Users\\lenovo\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe";
const PORT = 9333;
const ACCOUNT_URL = "https://xueqiu.com/u/7143769715";

let chrome = null;
try {
  let reusing = true;
  try {
    await waitForChromeDebugPort(PORT, 1_500);
    console.log("reusing existing CDP instance");
  } catch {
    reusing = false;
    chrome = await launchChrome({
      chromePath: CHROME_PATH,
      profileDir: PROFILE_DIR,
      port: PORT,
      url: ACCOUNT_URL,
      headless: false,
    });
    console.log("launched new Chrome");
  }

  const wsUrl = await waitForChromeDebugPort(PORT, 20_000);
  const cdp = await CdpConnection.connect(wsUrl, 10_000);

  const page = await openPageSession({
    cdp,
    reusing,
    url: ACCOUNT_URL,
    matchTarget: (t) => t.url && t.url.startsWith("https://xueqiu.com/u/7143769715"),
    enablePage: true,
    enableRuntime: true,
    activateTarget: true,
  });

  await cdp.send("Page.navigate", { url: ACCOUNT_URL }, { sessionId: page.sessionId });
  await waitForDocumentReady(cdp, page.sessionId, 30_000);
  await sleep(3_000);

  const payload = await evaluateJson(
    cdp,
    page.sessionId,
    `(async () => {
      const out = { title: document.title, url: location.href, items: [], markers: [], bodyLen: (document.body && document.body.innerText || "").length };
      const seen = new Set();
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const abs = a.href || '';
        if (!/^https?:\\/\\/(?:www\\.)?xueqiu\\.com\\/\\d+\\/\\d+/.test(abs)) continue;
        if (seen.has(abs)) continue;
        seen.add(abs);
        const container = a.closest('article, .timeline__item, .card, .feed__item, .status__item, li') || a.parentElement;
        const text = (container ? container.innerText : a.innerText) || '';
        out.items.push({ href: abs, text: text.replace(/\\s+/g, ' ').trim().slice(0, 160) });
      }
      const body = document.body ? document.body.innerText : '';
      const rx = /冰冰小美[\\s\\S]{0,4}?(今天|昨天|\\d{2}-\\d{2}|\\d{4}-\\d{2}-\\d{2})\\s*\\d{2}:\\d{2}/g;
      let m;
      while ((m = rx.exec(body)) !== null) out.markers.push(m[0].replace(/\\s+/g, ' '));
      return out;
    })()`,
    true
  );

  const result = { verified_at: new Date().toISOString(), ...payload };
  await writeFile(path.join(__dirname, "verify-homepage.json"), JSON.stringify(result, null, 2), "utf-8");
  console.log(JSON.stringify({ title: payload.title, itemCount: payload.items.length, markers: payload.markers.slice(0, 12), bodyLen: payload.bodyLen }, null, 2));
} finally {
  if (chrome) {
    try { chrome.kill(); } catch {}
  }
}
process.exit(0);
