import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from './db.js';
export async function applyHandoffMigration(db: Pool): Promise<void> {
  const sql = await readFile(new URL('../db/002-information-handoff.sql', import.meta.url), 'utf8');
  await transaction(db, async tx => { await tx.query(sql); });
}
