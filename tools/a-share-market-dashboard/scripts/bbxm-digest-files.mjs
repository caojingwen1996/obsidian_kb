import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function findBbxmDigestGroups(baseDir) {
  const groups = new Map();
  async function visit(directory, inheritedDate = '') {
    const files = await readdir(directory, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const file of files) {
      if (file.name.startsWith('.') || file.name === 'processing') continue;
      const path = join(directory, file.name);
      if (file.isDirectory()) {
        await visit(path, /^\d{4}-\d{2}-\d{2}$/.test(file.name) ? file.name : inheritedDate);
        continue;
      }
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const prefix = file.name.match(/^(\d{4}-\d{2}-\d{2})_/);
      const date = prefix?.[1] || inheritedDate;
      const name = prefix ? file.name.slice(prefix[0].length) : file.name;
      if (!date || name.includes('_解读') || (name !== 'summary.md' && !/^\d{6}_/.test(name))) continue;
      if (!groups.has(date)) groups.set(date, { date, files: [], summaryPath: '' });
      const group = groups.get(date);
      if (name === 'summary.md') group.summaryPath = path;
      else group.files.push({ path, name });
    }
  }
  await visit(baseDir);
  return [...groups.values()];
}
