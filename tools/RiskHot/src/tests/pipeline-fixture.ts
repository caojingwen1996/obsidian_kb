import { readFileSync } from 'node:fs';

type PipelineNode = {
  id: string;
  name: string;
  module: string;
  type: string;
  task?: string | null;
};
const generated = readFileSync(new URL('../web/pipeline-data.js', import.meta.url), 'utf8');
const payload = /^\/\/[^\n]*\nexport default ([\s\S]*);\s*$/.exec(generated)?.[1];
if (!payload) throw new Error('Invalid generated pipeline data');
export const pipelineGraph = JSON.parse(payload) as {
  system: { nodes: PipelineNode[] };
  sources: Record<string, { path: string; title: string }>;
};
