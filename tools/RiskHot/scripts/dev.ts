import { spawn, type ChildProcess } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';

await mkdir('.riskhot/logs', { recursive: true, mode: 0o700 });
const children: ChildProcess[] = [];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (const [name, file, role] of [
  ['workflow', 'src/runtime/worker.ts', 'workflow'], ['io', 'src/runtime/worker.ts', 'io'],
  ['model', 'src/runtime/worker.ts', 'model'], ['relay', 'src/runtime/relay.ts', ''], ['api', 'src/runtime/server.ts', ''],
]) {
  const fd = openSync(`.riskhot/logs/${name}.log`, 'a', 0o600);
  const child = spawn(process.execPath, ['--import', 'tsx', file!, ...(role ? [role] : [])], { env: process.env, stdio: ['ignore', fd, fd] });
  closeSync(fd); children.push(child);
  child.once('exit', () => { if (!stopping) { console.error(`${name} exited; see .riskhot/logs/${name}.log`); process.exitCode = 1; stop(); } });
}
console.log('RiskHot local processes started. Logs: .riskhot/logs/');
await Promise.all(children.map(child => once(child, 'exit')));
