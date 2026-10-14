import { readdir, readFile } from 'node:fs/promises';

export function extractRequirementIds(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6}[\t ]+(FR-[A-Z0-9]+-\d{2})(?:[\t ]+|$)/gm)].map(
    (match) => match[1]!,
  );
}

export async function readRequirementIds(directory: URL): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  const contents = await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')));
  const ids = contents.flatMap(extractRequirementIds);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate functional requirement definition: ${id}`);
    seen.add(id);
  }
  return ids;
}
