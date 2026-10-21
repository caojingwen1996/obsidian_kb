import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assertAutomationProfile, findMacAutomationChrome } from "../automation_browser.mjs";

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "automation-browser-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fakeBrowser(root, relative, version = "147.0.0.0") {
  const binary = path.join(root, relative);
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/bin/sh\necho 'Chromium ${version}'\n`, { mode: 0o755 });
  return binary;
}

test("chooses the newest installed isolated Playwright build", (t) => {
  const root = fixture(t);
  fakeBrowser(root, "chromium-99/chrome-mac/Chromium.app/Contents/MacOS/Chromium");
  const newest = fakeBrowser(root, "chromium-100/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
  assert.equal(findMacAutomationChrome({ env: {}, cacheRoot: root, applicationRoots: [] }), fs.realpathSync(newest));
});

test("does not fall back to personal Chrome when isolated browsers are missing", (t) => {
  const root = fixture(t);
  fakeBrowser(root, "Google Chrome.app/Contents/MacOS/Google Chrome");
  assert.equal(findMacAutomationChrome({ env: {}, cacheRoot: root, applicationRoots: [root] }), undefined);
});

test("rejects personal Chrome overrides and symlinks to it", (t) => {
  const root = fixture(t);
  const personal = fakeBrowser(root, "Google Chrome.app/Contents/MacOS/Google Chrome");
  const alias = path.join(root, "chrome-alias");
  fs.symlinkSync(personal, alias);
  for (const chromePath of [personal, alias]) {
    assert.throws(() => findMacAutomationChrome({ env: { CHROME_PATH: chromePath } }), /Personal Google Chrome/);
  }
});

test("accepts an explicit isolated executable and rejects a missing one", (t) => {
  const root = fixture(t);
  const browser = fakeBrowser(root, "Chromium.app/Contents/MacOS/Chromium");
  assert.equal(findMacAutomationChrome({ env: { CHROME_PATH: browser } }), fs.realpathSync(browser));
  assert.throws(() => findMacAutomationChrome({ env: { CHROME_PATH: path.join(root, "missing") } }), /not executable/);
});

test("rejects an installed automation executable that points to personal Chrome", (t) => {
  const root = fixture(t);
  const personal = fakeBrowser(root, "Google Chrome.app/Contents/MacOS/Google Chrome");
  const alias = path.join(root, "Chromium.app/Contents/MacOS/Chromium");
  fs.mkdirSync(path.dirname(alias), { recursive: true });
  fs.symlinkSync(personal, alias);
  assert.throws(() => findMacAutomationChrome({ env: {}, cacheRoot: root, applicationRoots: [root] }), /Personal Google Chrome/);
});

test("keeps an existing newer profile intact instead of downgrading it", (t) => {
  const root = fixture(t);
  const browser = fakeBrowser(root, "chromium");
  const profile = path.join(root, "old-profile");
  fs.mkdirSync(profile);
  const lastVersion = path.join(profile, "Last Version");
  fs.writeFileSync(lastVersion, "156.0.8078.36\n");
  assert.throws(() => assertAutomationProfile(browser, profile, "darwin"), /profile downgrade is not allowed/);
  assert.equal(fs.readFileSync(lastVersion, "utf-8"), "156.0.8078.36\n");
  assert.doesNotThrow(() => assertAutomationProfile(browser, path.join(root, "new-profile"), "darwin"));
});

test("never accepts the daily Chrome profile directory", (t) => {
  const root = fixture(t);
  const browser = fakeBrowser(root, "chromium");
  assert.throws(() => assertAutomationProfile(browser, path.join(os.homedir(), "Library/Application Support/Google/Chrome/Default"), "darwin"), /personal Google Chrome profile/);
});
