export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Data = { [key: string]: Json };
export type Domain =
  | 'reference'
  | 'observations'
  | 'information'
  | 'registry'
  | 'analysis'
  | 'publication'
  | 'operations'
  | 'identity';
export type Role = 'reader' | 'researcher' | 'reviewer' | 'admin';
export interface Actor {
  id: string;
  name: string;
  roles: Role[];
  active: boolean;
  evidence_access: boolean;
}
export interface RecordRow<T extends Data = Data> {
  id: string;
  kind: string;
  version: number;
  status: string;
  data: T;
  created_at: string;
  updated_at: string;
}
export interface DomainStore {
  get(domain: Domain, id: string, lock?: boolean): Promise<RecordRow>;
  maybe(domain: Domain, id: string): Promise<RecordRow | undefined>;
  list(domain: Domain, kind: string, limit?: number): Promise<RecordRow[]>;
  create(domain: Domain, kind: string, data: Data, status?: string, id?: string): Promise<RecordRow>;
  update(
    domain: Domain,
    id: string,
    expectedVersion: number,
    data: Data,
    status?: string,
  ): Promise<RecordRow>;
  history(domain: Domain, id: string): Promise<RecordRow[]>;
  audit(actor: Actor, action: string, domain: Domain, id: string, detail: Data): Promise<void>;
  emit(type: string, aggregateId: string, payload: Data): Promise<void>;
  claim(key: string, value: string): Promise<boolean>;
  findClaim(key: string): Promise<string | undefined>;
  relate(riskId: string, eventId: string, updateId: string | null, reason: string): Promise<Data>;
  relations(riskId: string): Promise<Data[]>;
}
export interface Context {
  db: DomainStore;
  actor: Actor;
  now: string;
  operationId: string;
  enqueue(type: string, input: Data): Promise<RecordRow>;
}
export type CommandHandler = (ctx: Context, input: Data) => Promise<Json>;
export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    public details: Data = {},
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
export function ensure(condition: unknown, code: string, message: string, status = 422): asserts condition {
  if (!condition) throw new BusinessError(code, message, status);
}
export function text(data: Data, key: string, fallback?: string): string {
  const value = data[key];
  if (value === undefined && fallback !== undefined) return fallback;
  ensure(typeof value === 'string' && value.trim().length > 0, 'INVALID_FIELD', `${key} 必须填写`);
  return value.trim();
}
export function number(data: Data, key: string, fallback?: number): number {
  const value = data[key];
  if (value === undefined && fallback !== undefined) return fallback;
  ensure(typeof value === 'number' && Number.isFinite(value), 'INVALID_FIELD', `${key} 必须为有效数值`);
  return value;
}
export function object(data: Data, key: string): Data {
  const value = data[key];
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_FIELD', `${key} 必须为对象`);
  return value;
}
export function array(data: Data, key: string): Json[] {
  const value = data[key];
  ensure(Array.isArray(value), 'INVALID_FIELD', `${key} 必须为数组`);
  return value;
}
export function strings(data: Data, key: string): string[] {
  const values = array(data, key);
  ensure(
    values.every((x) => typeof x === 'string'),
    'INVALID_FIELD',
    `${key} 必须为字符串数组`,
  );
  return values as string[];
}
export function records(data: Data, key: string): Data[] {
  const values = array(data, key);
  ensure(
    values.every((x) => x && typeof x === 'object' && !Array.isArray(x)),
    'INVALID_FIELD',
    `${key} 必须为对象数组`,
  );
  return values as Data[];
}
export function permit(ctx: Context, ...roles: Role[]): void {
  ensure(
    ctx.actor.active && roles.some((r) => ctx.actor.roles.includes(r)),
    'FORBIDDEN',
    '当前账号没有此操作权限',
    403,
  );
}
export function iso(value: string): string {
  ensure(Number.isFinite(Date.parse(value)), 'INVALID_TIME', '时间格式无效');
  return new Date(value).toISOString();
}
export function active(row: RecordRow): void {
  ensure(
    row.status === 'approved' || row.status === 'active',
    'REFERENCE_INACTIVE',
    `${row.kind} 尚未批准或已停用`,
  );
}
export function expected(input: Data): number {
  return number(input, 'expected_version');
}
export function safe(data: Json): Json {
  return JSON.parse(JSON.stringify(data)) as Json;
}
