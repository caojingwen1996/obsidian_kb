export const promptDirectory = 'docs/system-design/03-系统功能架构/AI任务与提示词';

export function parsePromptDocument(document: string, path: string) {
  const metadata = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(document)?.[1];
  if (!metadata) throw new Error(`提示词缺少元数据：${path}`);
  const fields = Object.fromEntries([...metadata.matchAll(/^([a-z_]+):[^\S\r\n]*(.+)$/gm)].map(match => [match[1], match[2]!.trim()]));
  const { task_id, title, version, status } = fields;
  if (!task_id || !title || !version || !status) throw new Error(`提示词元数据无效：${path}`);
  return { task_id, title, version, status, body: extractPromptBody(document, path) };
}

export function extractPromptBody(document: string, path: string): string {
  const blocks: string[] = [];
  let inSection = false;
  let fence: { marker: string; capture: boolean; lines: string[] } | undefined;
  for (const line of document.split(/\r?\n/)) {
    if (!inSection) {
      if (/^## \d+\. (?:提示词正文|完整四层提示词)\s*$/.test(line)) inSection = true;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      // Shorter JSON fences and Markdown headings belong to the prompt itself.
      if (marker && marker[1]![0] === fence.marker[0] && marker[1]!.length >= fence.marker.length && !marker[2]!.trim()) {
        if (fence.capture) blocks.push(fence.lines.join('\n'));
        fence = undefined;
      } else if (fence.capture) fence.lines.push(line);
      continue;
    }
    if (/^##\s/.test(line)) break;
    if (marker) fence = { marker: marker[1]!, capture: /^(text|markdown)$/.test(marker[2]!.trim()), lines: [] };
  }
  if (fence) throw new Error(`提示词正文代码块未闭合：${path}`);
  if (blocks.length !== 1 || !blocks[0]!.trim()) throw new Error(`提示词正文必须有一个非空 text 或 markdown 代码块：${path}`);
  return blocks[0]!;
}
