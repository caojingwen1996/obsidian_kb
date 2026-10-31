import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

type TaskDetail = { task: { id: string; status: string; reason_code: string | null }; materials: { material_id: string }[] };
export async function runCurrentCommand(origin: string, headers: Record<string, string>, flags: Map<string, string>, key: string): Promise<number> {
  async function request(path: string, body?: unknown) {
    const response = await fetch(origin + path, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { ...headers, 'idempotency-key': key }, signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`COMMAND_HTTP_${response.status}`);
    return response.json();
  }
  if (flags.has('--retry')) {
    const id = flags.get('--retry')!;
    const material = await request(`/api/v1/l0/material/${encodeURIComponent(id)}`);
    await request(`/api/v1/l0/material/${encodeURIComponent(id)}/extraction/retry`, { version: material.version, content_digest: material.content_digest, reason: flags.get('--reason'), open_budget: flags.get('--open-budget') === 'true' });
  }
  let id = flags.get('--watch');
  if (!id) {
    const result = await request('/api/v1/l0/tasks', { source_keys: [flags.get('--source') ?? 'wiki-source-001'], limit: 1, ...(flags.has('--url') ? { url: flags.get('--url') } : {}) });
    const accepted = result.items[0];
    if (!accepted?.accepted) throw new Error(accepted?.error?.code ?? 'TASK_NOT_ACCEPTED');
    id = accepted.task.id;
  }
  await mkdir('.riskhot/runs', { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 660_000;
  let previous = '';
  while (Date.now() < deadline) {
    const detail = await request(`/api/v1/l0/tasks/${encodeURIComponent(id!)}`) as TaskDetail;
    const summary = JSON.stringify({ task_id: id, status: detail.task.status, reason: detail.task.reason_code, material_ids: detail.materials.map(m => m.material_id) });
    if (summary !== previous) { console.log(summary); previous = summary; }
    await writeFile(`.riskhot/runs/${id}.json`, JSON.stringify({ request_key: key, checked_at: new Date().toISOString(), ...detail }, null, 2) + '\n', { mode: 0o600 });
    if (['completed', 'recoverable', 'partial', 'review', 'blocked', 'failed'].includes(detail.task.status)) return detail.task.status === 'completed' ? 0 : 2;
    await setTimeout(5000);
  }
  console.error('查询超时，任务仍由后台持久执行。');
  return 2;
}
