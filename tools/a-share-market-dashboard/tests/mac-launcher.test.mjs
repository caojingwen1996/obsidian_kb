import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const buildFails of [false, true]) {
  test(`Mac launcher ${buildFails ? 'stops after build failure' : 'builds before serving from its own directory'}`, { skip: process.platform === 'win32' }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'dashboard-launcher-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const dashboard = join(root, '中文 面板');
    const bin = join(root, 'bin');
    const trace = join(root, 'trace');
    await mkdir(dashboard);
    await mkdir(bin);
    await copyFile(new URL('../启动面板.command', import.meta.url), join(dashboard, '启动面板.command'));
    await writeFile(join(bin, 'node'), '#!/bin/bash\nprintf "build:%s:%s\\n" "$PWD" "$*" >> "$TRACE"\nexit "$BUILD_STATUS"\n', { mode: 0o755 });
    await writeFile(join(bin, 'python3'), '#!/bin/bash\n[ "$1" = "-c" ] && exit 0\nprintf "serve:%s:%s\\n" "$PWD" "$*" >> "$TRACE"\n', { mode: 0o755 });
    const result = spawnSync('/bin/bash', [join(dashboard, '启动面板.command')], {
      cwd: root, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, TRACE: trace, BUILD_STATUS: buildFails ? '1' : '0' },
    });
    assert.equal(result.status, buildFails ? 1 : 0, result.stderr);
    const lines = (await readFile(trace, 'utf8')).trim().split('\n');
    assert.equal(lines[0], `build:${dashboard}:scripts/build.mjs`);
    assert.equal(lines.length, buildFails ? 1 : 2);
    if (!buildFails) assert.equal(lines[1], `serve:${dashboard}:-u scripts/local_proxy.py`);
  });
}
