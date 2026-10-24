import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { required } from '../src/platform/db.js';

const flags = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index], value = process.argv[index + 1];
  if (!key || !['--key', '--source', '--url', '--watch', '--retry', '--reason', '--open-budget'].includes(key) || !value) throw new Error('Use --source SOURCE_KEY, --key VALUE, --url URL, --watch OPERATION_ID, --retry PROCESSING_ID, --reason TEXT, or --open-budget true');
  flags.set(key, value);
}
if (flags.has('--retry') && (!flags.has('--watch') || !flags.has('--reason'))) throw new Error('Retry requires --watch OPERATION_ID and --reason TEXT');
if (flags.has('--open-budget') && !['true', 'false'].includes(flags.get('--open-budget')!)) throw new Error('Open budget must be true or false');
const response = await fetch(`${required('OIDC_ISSUER')}/protocol/openid-connect/token`, { method: 'POST', redirect: 'error', body: new URLSearchParams({ grant_type: 'password', client_id: required('OIDC_CLIENT_ID'), client_secret: required('OIDC_CLIENT_SECRET'), username: required('OPERATOR_USERNAME'), password: required('OPERATOR_PASSWORD') }) });
if (!response.ok) throw new Error('CLI_LOGIN_FAILED');
const tokens = await response.json() as { access_token: string };
const headers = { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json' };
const origin = required('API_ORIGIN');
let id = flags.get('--watch');
const requestKey = flags.get('--key') || randomUUID();
if (flags.has('--retry')) {
  const processingResponse = await fetch(`${origin}/api/v1/l0/processings/${flags.get('--retry')}`, { headers });
  if (!processingResponse.ok) throw new Error(`PROCESSING_HTTP_${processingResponse.status}`);
  const processing = await processingResponse.json() as { generation: string };
  const retried = await fetch(`${origin}/api/v1/l0/processings/${flags.get('--retry')}/retry`, { method: 'POST', headers: { ...headers, 'idempotency-key': requestKey }, body: JSON.stringify({ expected_generation: Number(processing.generation), reason: flags.get('--reason'), open_budget: flags.get('--open-budget') === 'true' }) });
  if (!retried.ok) throw new Error(`RETRY_HTTP_${retried.status}`);
}
if (!id) {
  const submitted = await fetch(`${origin}/api/v1/l0/source-fetches`, { method: 'POST', headers: { ...headers, 'idempotency-key': requestKey }, body: JSON.stringify({ source_key: flags.get('--source') ?? 'wiki-source-001', limit: 1, ...(flags.get('--url') ? { url: flags.get('--url') } : {}) }) });
  if (!submitted.ok) throw new Error(`SUBMISSION_HTTP_${submitted.status}`);
  id = (await submitted.json() as { operation_id: string }).operation_id;
}
await mkdir('.riskhot/runs', { recursive: true, mode: 0o700 });
const deadline = Date.now() + 660_000;
let previous = '';
while (Date.now() < deadline) {
  const result = await fetch(`${origin}/api/v1/l0/operations/${id}`, { headers });
  if (!result.ok) throw new Error(`STATUS_HTTP_${result.status}`);
  const operation = await result.json() as { id: string; slice_status: string; reason_code: string | null; children?: { id: string; stage: string; status: string; reason_code: string | null; processing_id: string | null; version_id: string | null }[] };
  const summary = JSON.stringify({ operation_id: id, slice_status: operation.slice_status, reason: operation.reason_code, children: operation.children?.map(item => ({ id: item.id, stage: item.stage, status: item.status, reason: item.reason_code, processing_id: item.processing_id, version_id: item.version_id })) });
  if (summary !== previous) { console.log(summary); previous = summary; }
  await writeFile(`.riskhot/runs/${id}.json`, JSON.stringify({ request_key: requestKey, checked_at: new Date().toISOString(), operation }, null, 2) + '\n', { mode: 0o600 });
  if (['completed', 'recoverable', 'waiting_config', 'partial', 'review'].includes(operation.slice_status)) {
    if (operation.slice_status !== 'completed') process.exitCode = 2;
    break;
  }
  await setTimeout(5000);
}
if (Date.now() >= deadline) { console.error('Polling ended; durable processing continues.'); process.exitCode = 2; }
