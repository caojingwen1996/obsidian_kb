import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compile, type JSONSchema } from 'json-schema-to-typescript';
const raw = await readFile(new URL('../packages/contracts/commands.json', import.meta.url), 'utf8');
const schemas = JSON.parse(raw) as Record<string, JSONSchema>;
await mkdir(new URL('../packages/generated/', import.meta.url), { recursive: true });
function withoutTitles(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTitles);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'title')
        .map(([key, v]) => [key, withoutTitles(v)]),
    );
  return value;
}
let types = '/* Generated from contracts/commands.json. Do not edit. */\n';
const names: Record<string, string> = {};
for (const [name, schema] of Object.entries(schemas)) {
  const typeName =
    name
      .split(/[._]/)
      .map((s) => s[0]!.toUpperCase() + s.slice(1))
      .join('') + 'Input';
  names[name] = typeName;
  types += await compile({ ...(withoutTitles(schema) as JSONSchema), title: typeName }, typeName, {
    bannerComment: '',
    additionalProperties: false,
  });
}
types +=
  '\nexport interface CommandInputs {\n' +
  Object.entries(names)
    .map(([name, type]) => `  '${name}': ${type};`)
    .join('\n') +
  '\n}\n';
types += 'export type CommandName = keyof CommandInputs;\n';
await writeFile(new URL('../packages/generated/commands.ts', import.meta.url), types);
const sdk = `// Generated API client; the server remains the authorization authority.\nimport type { CommandInputs, CommandName } from './commands.js';\nexport class ApiError extends Error { constructor(public code:string,message:string,public status:number){super(message);} }\nexport async function query<T>(path:string):Promise<T>{const r=await fetch('/api/v1'+path,{credentials:'include'});const d=await r.json();if(!r.ok)throw new ApiError(d.code??'HTTP_ERROR',d.detail??'请求失败',r.status);return d as T;}\nexport async function command<K extends CommandName>(name:K,input:CommandInputs[K],csrf:string,key=crypto.randomUUID()):Promise<unknown>{const r=await fetch('/api/v1/commands/'+name,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':key},body:JSON.stringify(input)});const d=await r.json();if(!r.ok)throw new ApiError(d.code??'HTTP_ERROR',d.detail??'操作失败',r.status);return d;}\n`;
await writeFile(new URL('../packages/generated/client.ts', import.meta.url), sdk);
const paths = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [
    '/api/v1/commands/' + name,
    {
      post: {
        operationId: name,
        summary: schema.title,
        requestBody: { required: true, content: { 'application/json': { schema } } },
        responses: {
          200: { description: '操作结果或既有幂等回执' },
          202: { description: '持久任务已受理' },
          403: { description: '无权限' },
          409: { description: '版本或幂等冲突' },
          422: { description: '业务校验失败' },
        },
      },
    },
  ]),
);
await writeFile(
  new URL('../packages/contracts/openapi.json', import.meta.url),
  JSON.stringify({ openapi: '3.1.2', info: { title: 'RiskHot API', version: '1.0.0' }, paths }, null, 2) +
    '\n',
);
await writeFile(
  new URL('../packages/generated/contract-digest.json', import.meta.url),
  JSON.stringify(
    { sha256: createHash('sha256').update(raw).digest('hex'), commands: Object.keys(schemas).length },
    null,
    2,
  ) + '\n',
);
console.log('Generated', Object.keys(schemas).length, 'command contracts and SDK.');
