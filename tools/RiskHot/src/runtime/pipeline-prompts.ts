import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parsePromptDocument, promptDirectory } from '../platform/pipeline-prompt.js';

export const pipelineRoot = resolve(import.meta.dirname, '../..');
type PromptReference = { sourcePath: string; sourceHref: string };
type PipelineTasks = { tasks: unknown[]; definitions: unknown; usage: unknown; prompts: Record<string, PromptReference> };
type LivePrompt = PromptReference & { title: string; version: string; status: string; body: string; sourceSha256?: string };

export async function readPipelineTasks(root = pipelineRoot) {
  const module = await readFile(resolve(root, 'src/web/pipeline-tasks.js'), 'utf8');
  const json = /^\/\/[^\n]*\nexport default ([\s\S]*);\s*$/.exec(module)?.[1];
  if (!json) throw new Error('流水线任务引用不可读取');
  const data = JSON.parse(json) as PipelineTasks;
  const entries = await Promise.all(Object.entries(data.prompts).map(async ([taskId, reference]) => {
    try {
      const name = reference.sourcePath.slice(promptDirectory.length + 1);
      if (!reference.sourcePath.startsWith(promptDirectory + '/') || !name.endsWith('.md') || /[/\\]/.test(name) || name.includes('..')) throw new Error('INVALID_PROMPT_PATH');
      const directory = await realpath(resolve(root, promptDirectory));
      const path = await realpath(resolve(root, reference.sourcePath));
      if (!path.startsWith(directory + sep)) throw new Error('INVALID_PROMPT_PATH');
      const document = await readFile(path, 'utf8');
      const prompt = parsePromptDocument(document, reference.sourcePath);
      if (prompt.task_id !== taskId) throw new Error('PROMPT_TASK_MISMATCH');
      return [taskId, { ...reference, title: prompt.title, version: prompt.version, status: prompt.status,
        body: prompt.body, sourceSha256: createHash('sha256').update(document).digest('hex') }] as const;
    } catch {
      return [taskId, { ...reference, title: `${taskId} 提示词`, version: '暂不可用', status: '读取失败',
        body: '当前提示词文档无法读取或格式不正确。请检查来源文档后刷新页面。' }] as const;
    }
  }));
  return { ...data, prompts: Object.fromEntries<LivePrompt>(entries) };
}
