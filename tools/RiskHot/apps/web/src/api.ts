export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Data = { [key: string]: Json };
export type Role = 'reader' | 'researcher' | 'reviewer' | 'admin';
export type Domain =
  | 'reference'
  | 'observations'
  | 'information'
  | 'registry'
  | 'analysis'
  | 'publication'
  | 'operations'
  | 'identity';
export interface User {
  id: string;
  name: string;
  roles: Role[];
  active: boolean;
  evidence_access: boolean;
}
export interface RecordRow {
  id: string;
  kind: string;
  version: number;
  status: string;
  data: Data;
  created_at: string;
  updated_at: string;
}
export interface Schema {
  type: string | string[];
  title?: string;
  enum?: string[];
  format?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  minimum?: number;
  minLength?: number;
  items?: Schema;
  'x-roles'?: Role[];
  'x-domain'?: Domain;
}
export type Contracts = Record<string, Schema>;
export interface Session {
  user: User;
  csrf: string;
}
export interface RiskItem extends Data {
  id: string;
  version: number;
  name: string;
  snapshot: Data | null;
  unranked_reason: string | null;
  market: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      credentials: 'include',
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', '暂时无法连接服务。请检查连接后重试；已填写内容会保留。', 0);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const result: unknown = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const detail = result as { code?: string; detail?: string; message?: string } | null;
    throw new ApiError(
      detail?.code ?? `HTTP_${response.status}`,
      detail?.detail ?? detail?.message ?? '请求未完成，请稍后重试。',
      response.status,
    );
  }
  return result as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, value: unknown, headers: Record<string, string> = {}) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });

export function execute(name: string, input: Data, csrf: string, idempotencyKey: string) {
  return post<Json>(`/commands/${encodeURIComponent(name)}`, input, {
    'X-CSRF-Token': csrf,
    'Idempotency-Key': idempotencyKey,
  });
}

export const str = (value: Json | undefined, fallback = '—'): string =>
  value === null || value === undefined || value === ''
    ? fallback
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
export const asData = (value: Json | undefined): Data =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const rowTitle = (row: RecordRow) =>
  str(row.data.name ?? row.data.title ?? row.data.type ?? row.data.code, row.kind);
export function formatTime(value: Json | undefined, short = false) {
  if (typeof value !== 'string' || !value) return '时间待确认';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: short ? undefined : 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
