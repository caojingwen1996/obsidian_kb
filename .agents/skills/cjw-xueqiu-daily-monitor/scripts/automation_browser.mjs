import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function executable(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.realpathSync(candidate);
  } catch {
    return undefined;
  }
}

export function rejectPersonalChrome(candidate) {
  const resolved = executable(candidate) ?? path.resolve(candidate);
  if (/\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome$/.test(resolved)) {
    throw new Error("Personal Google Chrome cannot be used for automation on macOS. Use Chrome for Testing or Chromium instead.");
  }
  return resolved;
}

export function findMacAutomationChrome({
  env = process.env,
  envNames = ["CHROME_PATH"],
  cacheRoot = env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), "Library/Caches/ms-playwright"),
  applicationRoots = ["/Applications", path.join(os.homedir(), "Applications")],
} = {}) {
  for (const name of envNames) {
    const override = env[name]?.trim();
    if (override) {
      const resolved = rejectPersonalChrome(override);
      if (!executable(resolved)) throw new Error(`Automation browser is not executable: ${resolved}`);
      return resolved;
    }
  }

  const candidates = applicationRoots.flatMap((root) => [
    path.join(root, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    path.join(root, "Chromium.app/Contents/MacOS/Chromium"),
  ]);
  if (fs.existsSync(cacheRoot)) {
    const revisions = fs.readdirSync(cacheRoot)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const revision of revisions) {
      for (const directory of ["chrome-mac-arm64", "chrome-mac-x64", "chrome-mac"]) {
        candidates.push(
          path.join(cacheRoot, revision, directory, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
          path.join(cacheRoot, revision, directory, "Chromium.app/Contents/MacOS/Chromium"),
        );
      }
    }
  }
  const selected = candidates.map(executable).find(Boolean);
  return selected ? rejectPersonalChrome(selected) : undefined;
}

export function assertAutomationProfile(chromePath, profileDir, platform = process.platform) {
  if (platform !== "darwin") return;
  rejectPersonalChrome(chromePath);
  const resolved = fs.existsSync(profileDir) ? fs.realpathSync(profileDir) : path.resolve(profileDir);
  const personalRoot = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
  if (resolved === personalRoot || resolved.startsWith(personalRoot + path.sep)) {
    throw new Error("Automation must not use the personal Google Chrome profile.");
  }
  const lastVersion = path.join(resolved, "Last Version");
  if (!fs.existsSync(lastVersion)) return;
  const profileMajor = Number.parseInt(fs.readFileSync(lastVersion, "utf-8"), 10);
  const result = spawnSync(chromePath, ["--version"], { encoding: "utf-8", timeout: 5_000 });
  const browserMajor = Number(/\b(\d+)\./.exec(result.stdout ?? "")?.[1]);
  if (result.status !== 0 || !browserMajor || !Number.isFinite(profileMajor)) {
    throw new Error("Cannot verify automation profile compatibility; use a new dedicated profile directory.");
  }
  if (profileMajor > browserMajor) {
    throw new Error(`Profile was used by Chrome ${profileMajor}; automation browser is ${browserMajor}. Keep the old profile and use a new directory; profile downgrade is not allowed.`);
  }
}

function main() {
  let chromePath;
  if (process.platform === "darwin") {
    chromePath = findMacAutomationChrome();
  } else if (process.env.CHROME_PATH) {
    chromePath = executable(process.env.CHROME_PATH);
  } else {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const result = spawnSync("which", [name], { encoding: "utf-8", timeout: 3_000 });
      if (result.status === 0) {
        chromePath = executable(result.stdout.trim());
        if (chromePath) break;
      }
    }
  }
  if (!chromePath) throw new Error("Automation browser not found. Install Playwright Chromium or set CHROME_PATH to Chrome for Testing / Chromium.");
  assertAutomationProfile(chromePath, process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".xueqiu-automation-profile"));
  process.stdout.write(chromePath + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error.message ?? error) + "\n");
    process.exitCode = 1;
  }
}
