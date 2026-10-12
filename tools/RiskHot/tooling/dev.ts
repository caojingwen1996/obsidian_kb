import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { migrate } from './migrate.js';
import { startTemporalDev } from './temporal-dev.js';
const children: ChildProcess[] = [];
let temporal: Awaited<ReturnType<typeof startTemporalDev>> | undefined;
let stopping = false;
async function reachable(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  await temporal?.teardown();
  process.exitCode = code;
}
function run(name: string, command: string, args: string[]) {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', (error) => {
    console.error(name, error.message);
    void stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${name} stopped (${code})`);
      void stop(code || 1);
    }
  });
}
await migrate();
if (!(await reachable(7233))) temporal = await startTemporalDev();
for (const port of [Number(process.env.API_PORT || 4310), Number(process.env.WEB_PORT || 4311)])
  if (await reachable(port)) {
    await temporal?.teardown();
    throw new Error(`Port ${port} is already in use. Stop the existing RiskHot process first.`);
  }
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
run('API', process.execPath, ['--import', 'tsx', 'apps/api/src/main.ts']);
run('Worker', process.execPath, ['--import', 'tsx', 'apps/worker/src/main.ts']);
run('Outbox Relay', process.execPath, ['--import', 'tsx', 'apps/outbox-relay/src/main.ts']);
run('Web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts']);
console.log('RiskHot local workspace: http://127.0.0.1:' + (process.env.WEB_PORT || 4311));
