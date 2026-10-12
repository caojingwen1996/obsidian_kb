import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';

export async function startTemporalDev() {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)), '.data');
  await mkdir(resolve(root, 'bin'), { recursive: true });
  await mkdir(resolve(root, 'temporal'), { recursive: true });
  return TestWorkflowEnvironment.createLocal({
    server: {
      executable: process.env.TEMPORAL_CLI_PATH
        ? { type: 'existing-path', path: process.env.TEMPORAL_CLI_PATH }
        : { type: 'cached-download', downloadDir: resolve(root, 'bin'), version: 'default' },
      dbFilename: resolve(root, 'temporal', 'temporal.sqlite'),
      ip: '127.0.0.1',
      port: 7233,
      ui: true,
      uiPort: 8233,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      extraArgs: ['--ui-disable-news-fetch'],
      log: { level: 'warn', format: 'pretty' },
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environment = await startTemporalDev();
  console.log(
    'Temporal development server: 127.0.0.1:7233; UI: http://127.0.0.1:8233; persistent SQLite in .data/temporal (not production).',
  );
  const keepAlive = setInterval(() => undefined, 30_000);
  try {
    await new Promise<void>((resolveStop) => {
      process.once('SIGINT', resolveStop);
      process.once('SIGTERM', resolveStop);
    });
  } finally {
    clearInterval(keepAlive);
    await environment.teardown();
  }
}
