import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import { transaction } from './db.js';
import { mkdir, readFile, writeFile, rename, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface RuntimeIssue { key: string; code: string; owner: string | null }
export type Notifier = (issue: RuntimeIssue) => Promise<void>;
const messages: Record<string, string> = {
  MODEL_LOGIN_REQUIRED: '模型登录已失效，请重新登录 Codex。',
  MODEL_SUBSCRIPTION_REQUIRED: '请使用 ChatGPT 订阅账号登录 Codex。',
  MODEL_QUOTA_EXHAUSTED: '订阅额度暂不可用，资料已保留，系统将等待后重试。',
  BACKGROUND_SERVICE_FAILED: '后台服务发生异常，系统正在尝试恢复。',
  OUTPUT_REVIEW_REQUIRED: '部分抽取结果需要复核，已保留原文与结果。',
};
export const systemNotification: Notifier = async issue => {
  if (process.platform !== 'darwin') throw new Error('SYSTEM_NOTIFICATION_UNAVAILABLE');
  await promisify(execFile)('/usr/bin/osascript', ['-e', 'on run argv\ndisplay notification (item 1 of argv) with title (item 2 of argv)\nend run', messages[issue.code] ?? '信息处理遇到异常，请查看 RiskHot 运行状态。', 'RiskHot · 需要关注'], { timeout: 10_000, maxBuffer: 8192 });
};

export class AlertStore {
  constructor(private db: Pool, private notify: Notifier = systemNotification) {}
  async reconcile(issues: RuntimeIssue[], now = new Date()): Promise<void> {
    await transaction(this.db, async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-alert-reconcile',0))");
      for (const issue of issues) await tx.query(`INSERT INTO platform.runtime_alerts(issue_key,code,owner_id,opened_at,last_seen_at,next_delivery_at)
        VALUES($1,$2,$3,$4,$4,$4) ON CONFLICT(issue_key) WHERE resolved_at IS NULL DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`, [issue.key, issue.code, issue.owner, now]);
      await tx.query('UPDATE platform.runtime_alerts SET resolved_at=$2 WHERE resolved_at IS NULL AND NOT(issue_key=ANY($1::text[]))', [issues.map(x => x.key), now]);
    });
    const rows = (await this.db.query<{ id: string; issue_key: string; code: string; owner_id: string | null }>(`UPDATE platform.runtime_alerts SET delivery_status='delivering',delivery_attempts=delivery_attempts+1,next_delivery_at=$1+interval '5 minutes'
      WHERE id IN (SELECT id FROM platform.runtime_alerts WHERE resolved_at IS NULL AND delivery_status<>'submitted' AND delivery_attempts<3 AND next_delivery_at<=$1 FOR UPDATE SKIP LOCKED)
      RETURNING id,issue_key,code,owner_id`, [now])).rows;
    for (const row of rows) {
      try {
        await this.notify({ key: row.issue_key, code: row.code, owner: row.owner_id });
        await this.db.query("UPDATE platform.runtime_alerts SET delivery_status='submitted',delivered_at=$2 WHERE id=$1", [row.id, now]);
      } catch { await this.db.query("UPDATE platform.runtime_alerts SET delivery_status='failed' WHERE id=$1", [row.id]); }
    }
  }
}

// This file survives supervisor restarts even when PostgreSQL is unavailable.
export async function serviceFailure(root: string, component: string, notify: Notifier = systemNotification): Promise<void> {
  const folder = join(root, '.riskhot'); const path = join(folder, 'service-alert.json');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const fresh = () => ({ code: 'BACKGROUND_SERVICE_FAILED', component, opened_at: new Date().toISOString(), attempts: 0, submitted: false, next_at: 0, resolved_at:null as string|null });
  let state = fresh();
  try { state = JSON.parse(await readFile(path, 'utf8')); } catch { /* First failure. */ }
  if(state.resolved_at){await appendFile(join(folder,'service-alert-history.jsonl'),JSON.stringify(state)+'\n',{mode:0o600});state=fresh();}
  if (state.submitted || state.attempts >= 3 || state.next_at > Date.now()) return;
  state.attempts++; state.next_at = Date.now() + 300_000;
  const save = async () => { await writeFile(`${path}.tmp`, JSON.stringify(state), { mode: 0o600 }); await rename(`${path}.tmp`, path); };
  await save();
  try { await notify({ key: 'background-service', code: state.code, owner: null }); state.submitted = true; } catch { /* Delivery failure remains visible. */ }
  await save();
}
export async function serviceStatus(root:string):Promise<Record<string,unknown>|null>{
  try{return JSON.parse(await readFile(join(root,'.riskhot/service-alert.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export async function serviceHealthy(root: string): Promise<void> {
  const state=await serviceStatus(root);if(!state||state.resolved_at)return;
  state.resolved_at=new Date().toISOString();const path=join(root,'.riskhot/service-alert.json');await writeFile(`${path}.tmp`,JSON.stringify(state),{mode:0o600});await rename(`${path}.tmp`,path);
}
