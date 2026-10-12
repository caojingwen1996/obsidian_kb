import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve('.');
async function files(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((e) => !['node_modules', 'dist', '.data'].includes(e.name))
        .map((e) =>
          e.isDirectory()
            ? files(resolve(path, e.name))
            : Promise.resolve(/\.tsx?$/.test(e.name) ? [resolve(path, e.name)] : []),
        ),
    )
  ).flat();
}
const violations: string[] = [];
for (const path of [...(await files('apps')), ...(await files('packages'))]) {
  const owner = relative(root, path).replaceAll('\\', '/');
  const source = await readFile(path, 'utf8');
  for (const matchImport of source.matchAll(
    /^\s*import(\s+type)?\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm,
  )) {
    const spec = matchImport[2]!;
    const target = spec.startsWith('.')
      ? relative(root, resolve(path, '..', spec)).replaceAll('\\', '/')
      : spec;
    if (
      owner.startsWith('apps/web/') &&
      (target.includes('packages/domains/') ||
        target.includes('packages/platform/') ||
        target.includes('packages/application/') ||
        ['pg', '@temporalio/worker', 'fastify'].includes(spec))
    )
      violations.push(`${owner}: frontend imports server implementation ${spec}`);
    const match = owner.match(/^packages\/domains\/([^/]+)\//);
    if (
      match &&
      target.startsWith('packages/domains/') &&
      !target.startsWith(`packages/domains/${match[1]}/`)
    )
      violations.push(`${owner}: cross-domain implementation import ${spec}`);
    if (owner.startsWith('packages/platform/') && target.startsWith('packages/domains/'))
      violations.push(`${owner}: platform depends on domain ${spec}`);
    if (
      owner.endsWith('/workflows.ts') &&
      !matchImport[1] &&
      !spec.includes('contracts') &&
      spec !== '@temporalio/workflow'
    )
      violations.push(`${owner}: non-deterministic workflow dependency ${spec}`);
  }
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'PASS: frontend/server separation, domain imports, platform direction, workflow deterministic dependencies',
  );
