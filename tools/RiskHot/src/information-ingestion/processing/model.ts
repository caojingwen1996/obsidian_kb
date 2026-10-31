import { DomainError, type ModelResponse, type NormalizedMaterial } from '../../platform/types.js';

export interface ModelConfig { protocol: string; endpoint: string; model: string }
export interface TaskInput { material_ref?: import('./current-repository.js').MaterialBasis; version_id: string; material: NormalizedMaterial; manifest: { provider: ModelConfig; prompt: string; task_id?: string; output_schema?: object; output_schema_digest?: string; task_package?: unknown }; context?: unknown }
export function modelInputEnvelope(input:TaskInput):unknown{
 const identity=input.material_ref?{...input.material_ref}:{version_id:input.version_id};
 return {...identity,material:input.material,...(input.context===undefined?{}:{context:input.context})};
}
export interface TransportResponse { status: number; body: string; protocol?: string }
export const modelCredentialsConfigured = () => process.env.MODEL_PROTOCOL === 'codex-exec' || Boolean(process.env.MODEL_API_KEY) || process.env.MODEL_CREDENTIAL_READY === 'true';

export function modelConfig(): ModelConfig {
  const { MODEL_PROTOCOL: protocol, MODEL_ENDPOINT: endpoint, MODEL_NAME: model } = process.env;
  if (protocol === 'codex-exec' && model && (!endpoint || endpoint === 'codex://local')) return { protocol, endpoint: 'codex://local', model };
  if (!protocol || !endpoint || !model || !modelCredentialsConfigured()) throw new DomainError('MODEL_NOT_CONFIGURED', 503);
  if (protocol !== 'openai-chat') throw new DomainError('MODEL_PROTOCOL_UNSUPPORTED', 503);
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new DomainError('MODEL_ENDPOINT_INVALID', 503);
  return { protocol, endpoint, model };
}

export class HttpModelClient {
  async execute(input: TaskInput, key: string, options?: { deadlineMs: number }): Promise<TransportResponse> {
    if (input.manifest.provider.protocol !== 'openai-chat') throw new DomainError('MODEL_PROTOCOL_UNSUPPORTED', 503);
    const remaining = options ? options.deadlineMs - Date.now() : 120_000;
    if (remaining <= 0) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
    const budgetLimited = remaining <= 120_000 && Boolean(options);
    const signal = AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(120_000, remaining))));
    try {
      const response = await fetch(input.manifest.provider.endpoint, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: input.manifest.provider.model, max_completion_tokens: 8192,
          messages: [{ role: 'system', content: input.manifest.prompt }, { role: 'user', content: JSON.stringify(modelInputEnvelope(input)) }],
        }),
      });
      if (!response.body) throw new DomainError('MODEL_EMPTY_RESPONSE', 502);
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 1_048_576) throw new DomainError('MODEL_RESPONSE_TOO_LARGE', 502);
        chunks.push(chunk);
      }
      return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (budgetLimited && signal.aborted) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
      throw new DomainError('MODEL_NETWORK_ERROR', 502, true);
    }
  }
}

export function decodeModelResponse(transport: TransportResponse): ModelResponse {
  if (transport.status !== 200) throw new DomainError(`MODEL_HTTP_${transport.status}`, 502, transport.status === 429 || transport.status >= 500);
  let raw: unknown;
  try { raw = JSON.parse(transport.body); } catch { throw new DomainError('MODEL_JSON_INVALID'); }
  if (transport.protocol === 'codex-exec') {
    const record = raw as { events?: {type?:string;item?:{type?:string;text?:string;message?:string};usage?:Record<string,number>}[] };
    if (!Array.isArray(record?.events)) throw new DomainError('MODEL_RESPONSE_INVALID');
    const turns=record.events.filter(e=>e.type==='turn.completed');
    if(!turns.length)throw new DomainError('MODEL_INCOMPLETE');
    const messages=record.events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message');
    if(!messages.length)throw new DomainError('MODEL_EMPTY_RESPONSE');
    if(turns.length!==1||messages.length!==1||typeof messages[0]!.item?.text!=='string')throw new DomainError('MODEL_RESPONSE_INVALID');
    const start=record.events.findIndex(e=>e.type==='turn.started');
    if(record.events.some((e,index)=>e.type==='item.completed'&&!['agent_message','reasoning'].includes(e.item?.type??'')&&!(index<start&&e.item?.type==='error'&&e.item.message?.startsWith('Under-development features enabled:'))))throw new DomainError('MODEL_UNEXPECTED_TOOL_USE');
    let data: unknown; try { data = JSON.parse(messages[0]!.item!.text!); } catch { throw new DomainError('MODEL_JSON_INVALID'); }
    return { complete: true, finishReason: 'turn.completed', data, usage: turns[0]!.usage };
  }
  const record = raw as { choices?: { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown; tool_calls?: unknown } }[]; usage?: Record<string, number> };
  const choice = Array.isArray(record?.choices) && record.choices.length === 1 ? record.choices[0] : undefined;
  if (!choice || typeof choice.message?.content !== 'string' || choice.message.refusal || choice.message.tool_calls) throw new DomainError('MODEL_RESPONSE_INVALID');
  let data: unknown;
  try { data = JSON.parse(choice.message.content); } catch { throw new DomainError('MODEL_JSON_INVALID'); }
  return { complete: choice.finish_reason === 'stop', finishReason: String(choice.finish_reason ?? 'unknown'), data, usage: record.usage };
}
