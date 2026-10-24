import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

if (process.platform !== 'darwin') throw new Error('MACOS_SERVICE_ONLY');
const command = process.argv[2];
if (!['install','uninstall','status'].includes(command ?? '')) throw new Error('Use npm run service -- install|uninstall|status');
const root = resolve('.');
await readFile(join(root, 'package.json'), 'utf8');
const label = `local.riskhot.source-candidates.${createHash('sha256').update(root).digest('hex').slice(0, 10)}`;
const domain = `gui/${process.getuid!()}`; const folder = join(homedir(), 'Library/LaunchAgents'); const path = join(folder, `${label}.plist`);
const run = promisify(execFile);
const xml = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
if (command === 'install') {
  await mkdir(folder, { recursive: true }); await mkdir(join(root,'.riskhot/logs'), { recursive: true, mode: 0o700 });
  const args = [process.execPath, `--env-file=${join(root,'.env')}`, '--import', 'tsx', join(root,'scripts/dev.ts')];
  const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(a=>`<string>${xml(a)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(root)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH ?? '/usr/bin:/bin')}</string><key>HOME</key><string>${xml(homedir())}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${xml(join(root,'.riskhot/logs/service.log'))}</string><key>StandardErrorPath</key><string>${xml(join(root,'.riskhot/logs/service-error.log'))}</string></dict></plist>`;
  await writeFile(path, plist, { mode: 0o600 });
  await run('/usr/bin/plutil', ['-lint', path]);
  try { await run('/bin/launchctl', ['bootout', `${domain}/${label}`]); } catch { /* Not loaded yet. */ }
  await run('/bin/launchctl', ['bootstrap', domain, path]);
  console.log(JSON.stringify({ installed: true, label, path, workspace: root }));
} else if (command === 'uninstall') {
  try { await run('/bin/launchctl', ['bootout', `${domain}/${label}`]); } catch { /* Already stopped. */ }
  await rm(path, { force: true }); console.log(JSON.stringify({ installed: false, label }));
} else {
  try { const result = await run('/bin/launchctl', ['print', `${domain}/${label}`]); console.log(result.stdout); }
  catch { console.log(JSON.stringify({ installed: false, label })); process.exitCode = 2; }
}
