import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { extractionSchema } from './extraction.js';
import { DomainError } from '../platform/types.js';
import type { TaskInput, TransportResponse } from './model.js';

const MAX_OUTPUT = 2_097_152;
export function codexEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'CODEX_HOME', 'SSL_CERT_FILE', 'CODEX_CA_CERTIFICATE'].filter(k => base[k] !== undefined).map(k => [k, base[k]]));
}
function failureCode(text: string): string {
  if (/usage.limit|quota.exceed|rate.limit|limit.reached|too many requests|429/i.test(text)) return 'MODEL_QUOTA_EXHAUSTED';
  if (/unauthorized|authentication|log.?in|sign.?in|401|token.expired/i.test(text)) return 'MODEL_LOGIN_REQUIRED';
  if (/connection|network|timed?.?out|502|503|504/i.test(text)) return 'MODEL_NETWORK_ERROR';
  return 'MODEL_CODEX_FAILED';
}

export class CodexModelClient {
  constructor(private executable = process.env.CODEX_EXECUTABLE || 'codex') {}
  private run(args: string[], cwd: string, stdin: string, timeout: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, args, { cwd, env: codexEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
      let stdout = '', stderr = '', size = 0, settled = false;
      const stop = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* Already exited. */ } };
      const fail = (code: string) => { if (settled) return; settled = true; clearTimeout(timer); stop(); reject(new DomainError(code, 503, code === 'MODEL_NETWORK_ERROR')); };
      const timer = setTimeout(() => fail('MODEL_BUDGET_EXHAUSTED'), Math.max(1, timeout));
      child.once('error', () => fail('MODEL_CODEX_UNAVAILABLE'));
      child.stdin.on('error', () => { /* Early exit is handled by close. */ });
      const collect = (stream: 'stdout' | 'stderr', chunk: Buffer) => { size += chunk.length; if (size > MAX_OUTPUT) return fail('MODEL_RESPONSE_TOO_LARGE'); if (stream === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8'); };
      child.stdout.on('data', chunk => collect('stdout', chunk)); child.stderr.on('data', chunk => collect('stderr', chunk));
      child.once('close', code => { if (settled) return; settled = true; clearTimeout(timer); resolve({ code, stdout, stderr }); });
      child.stdin.end(stdin);
    });
  }
  async authenticated(): Promise<boolean> {
    const result = await this.run(['login', 'status'], tmpdir(), '', 10_000);
    if (result.code !== 0) throw new DomainError('MODEL_LOGIN_REQUIRED', 503);
    if (!/Logged in using ChatGPT/i.test(result.stdout + result.stderr)) throw new DomainError('MODEL_SUBSCRIPTION_REQUIRED', 503);
    return true;
  }
  async execute(input: TaskInput, options: { deadlineMs: number }): Promise<TransportResponse> {
    if (input.manifest.provider.protocol !== 'codex-exec' || input.manifest.provider.endpoint !== 'codex://local') throw new DomainError('MODEL_PROTOCOL_UNSUPPORTED', 503);
    if (options.deadlineMs <= Date.now()) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
    await this.authenticated();
    const folder = await mkdtemp(join(tmpdir(), 'riskhot-extraction-'));
    try {
      const schema = join(folder, 'schema.json'); await writeFile(schema, JSON.stringify(extractionSchema), { mode: 0o600 });
      const args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never', '-C', folder, '-m', input.manifest.provider.model,
        '-c', 'approval_policy="never"', '-c', 'web_search="disabled"', '-c', 'project_doc_max_bytes=0', '-c', 'model_reasoning_effort="low"'];
      for (const feature of ['shell_tool', 'apps', 'plugins', 'multi_agent', 'browser_use', 'computer_use', 'image_generation', 'hooks', 'skill_search', 'sleep_tool', 'workspace_dependencies', 'tool_suggest', 'view_image']) args.push('--disable', feature);
      args.push('--enable', 'skip_host_skill_discovery', '--output-schema', schema, '-');
      const prompt = `${input.manifest.prompt}\n\n不得调用工具、读取文件、访问网络或执行命令；仅处理以下固定输入。\n${JSON.stringify({ version_id: input.version_id, material: input.material })}`;
      const result = await this.run(args, folder, prompt, Math.min(150_000, options.deadlineMs - Date.now()));
      const events: { type?: string; item?: { type?: string; text?: string }; usage?: Record<string, number>; error?: { message?: string } }[] = [];
      try { for (const line of result.stdout.split('\n').filter(x => x.trim())) events.push(JSON.parse(line)); }
      catch { throw new DomainError(result.code === 0 ? 'MODEL_RESPONSE_INVALID' : failureCode(result.stderr), 502); }
      const failed = events.find(e => e.type === 'turn.failed' || e.type === 'error');
      if (result.code !== 0 || failed) throw new DomainError(failureCode(`${result.stderr} ${JSON.stringify(failed ?? {})}`), 503);
      const turns = events.filter(e => e.type === 'turn.completed');
      if (!turns.length) throw new DomainError('MODEL_INCOMPLETE');
      const messages = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message');
      if (!messages.length) throw new DomainError('MODEL_EMPTY_RESPONSE');
      if (turns.length !== 1 || messages.length !== 1 || typeof messages[0]!.item?.text !== 'string') throw new DomainError('MODEL_RESPONSE_INVALID');
      if (events.some(e => e.type === 'item.completed' && !['agent_message', 'reasoning'].includes(e.item?.type ?? ''))) throw new DomainError('MODEL_UNEXPECTED_TOOL_USE');
      return { status: 200, protocol: 'codex-exec', body: JSON.stringify({ complete: true, model: input.manifest.provider.model, output: messages[0]!.item!.text, usage: turns[0]!.usage }) };
    } finally { await rm(folder, { recursive: true, force: true }); }
  }
}
