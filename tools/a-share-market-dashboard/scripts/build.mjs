import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src');
const outputPath = join(root, 'a-share-market-dashboard.html');
const moduleOrder = ['core.mjs', 'adapters.mjs', 'data-service.mjs', 'app.mjs'];

function stripModuleSyntax(source, filename) {
  const withoutImports = source.replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm, '');
  const withoutExports = withoutImports.replace(/\bexport\s+(?=(?:async\s+)?function|const|class)/g, '');
  if (/\b(?:import|export)\s/.test(withoutExports)) {
    throw new Error(`Unsupported module syntax remains in ${filename}`);
  }
  return `\n// ---- ${filename} ----\n${withoutExports.trim()}\n`;
}

const [template, styles, ...modules] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  ...moduleOrder.map(filename => readFile(join(sourceDir, filename), 'utf8')),
]);

const bundle = modules
  .map((source, index) => stripModuleSyntax(source, moduleOrder[index]))
  .join('')
  .replaceAll('</script', '<\\/script');

// Parse the generated runtime before writing it. The function is not executed.
new Function(bundle);

const output = template
  .replace('<!-- DASHBOARD_STYLES -->', `<style>${styles.trim()}</style>`)
  .replace('<!-- DASHBOARD_SCRIPT -->', `<script type="module">${bundle}</script>`);

if (output.includes('DASHBOARD_STYLES') || output.includes('DASHBOARD_SCRIPT')) {
  throw new Error('Build placeholders were not fully replaced');
}
if (/from\s+['"]\.\//.test(output)) {
  throw new Error('Local module imports remain in the standalone artifact');
}

await writeFile(outputPath, output, 'utf8');
console.log(`Built ${outputPath} (${Buffer.byteLength(output, 'utf8')} bytes)`);
