import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from '../packages/platform/database/index.js';
export async function migrate(url?: string) {
  const p = createPool(url);
  const c = await p.connect();
  try {
    await c.query('CREATE SCHEMA IF NOT EXISTS platform');
    await c.query(
      'CREATE TABLE IF NOT EXISTS platform.migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const name of (await readdir(new URL('../database/migrations/', import.meta.url))).sort()) {
      if (!name.endsWith('.sql')) continue;
      const done = await c.query('SELECT name FROM platform.migrations WHERE name=$1', [name]);
      if (done.rowCount) continue;
      await c.query('BEGIN');
      try {
        await c.query(await readFile(new URL('../database/migrations/' + name, import.meta.url), 'utf8'));
        await c.query('INSERT INTO platform.migrations(name) VALUES($1)', [name]);
        await c.query('COMMIT');
        console.log('Applied', name);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    c.release();
    await p.end();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await migrate();
