import { Pool, type PoolClient } from 'pg';
import { DomainError } from './types.js';

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new DomainError(`CONFIG_MISSING_${name}`, 503);
  return value;
}
export function database(name = 'DATABASE_URL'): Pool {
  return new Pool({ connectionString: required(name), max: 8, connectionTimeoutMillis: 5000 });
}
export async function transaction<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
