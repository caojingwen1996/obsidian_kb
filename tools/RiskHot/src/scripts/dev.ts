import { spawn, type ChildProcess } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { runtimeEnvironment, runtimeProcesses } from '../runtime/environment.js';
import { serviceFailure, serviceHealthy } from '../platform/notifications.js';

await mkdir('.riskhot/logs', { recursive: true, mode: 0o700 });
const children: ChildProcess[] = [];
let fault: Promise<void> | undefined;
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (const {name,file,argument:role} of runtimeProcesses()) {
  const fd = openSync(`.riskhot/logs/${name}.log`, 'a', 0o600);
  const child = spawn(process.execPath, ['--import', 'tsx', file, ...(role ? [role] : [])], { env: runtimeEnvironment(name), stdio: ['ignore', fd, fd] });
  closeSync(fd); children.push(child);
  child.once('exit', () => { if (!stopping) { console.error(`${name} exited; see .riskhot/logs/${name}.log`); fault = serviceFailure(process.cwd(), name).catch(() => undefined); process.exitCode = 1; stop(); } });
}
console.log('RiskHot local processes started. Logs: .riskhot/logs/');
const healthy = setTimeout(async () => {
  if (stopping) return;
  try { const response = await fetch(`${process.env.API_ORIGIN}/health/ready`, { signal: AbortSignal.timeout(5000) }); if (response.ok) await serviceHealthy(process.cwd()); } catch { /* A startup failure keeps its durable alert. */ }
}, 30_000);
await Promise.all(children.map(child => once(child, 'exit')));
clearTimeout(healthy); await fault;
