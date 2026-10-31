import { database, required } from '../platform/db.js';

// 首次安装时显式准备Temporal独立数据库身份；应用setup不操作其他数据库。
const db = database('ADMIN_DATABASE_URL');
try {
  const role = (await db.query("SELECT 1 FROM pg_roles WHERE rolname='temporal'")).rowCount;
  const statement = (await db.query<{ sql: string }>(`SELECT format('${role ? 'ALTER' : 'CREATE'} ROLE %I WITH LOGIN CREATEDB PASSWORD %L', 'temporal', $1::text) AS sql`, [required('TEMPORAL_DB_PASSWORD')])).rows[0]!.sql;
  await db.query(statement);
  if (!(await db.query("SELECT 1 FROM pg_database WHERE datname='temporal'")).rowCount) await db.query('CREATE DATABASE temporal OWNER temporal');
  console.log('Temporal独立数据库身份准备完成；既有数据库内容未修改。');
} finally { await db.end(); }
