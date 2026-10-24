import { DomainError, type ModelResponse, type NormalizedMaterial } from '../platform/types.js';

export interface ModelConfig { protocol: string; endpoint: string; model: string }
export interface TaskInput { version_id: string; material: NormalizedMaterial; manifest: { provider: ModelConfig; prompt: string } }
export interface TransportResponse { status: number; body: string }

export function modelConfig(): ModelConfig {
  const { MODEL_PROTOCOL: protocol, MODEL_ENDPOINT: endpoint, MODEL_NAME: model, MODEL_API_KEY: key } = process.env;
  if (!protocol || !endpoint || !model || !key) throw new DomainError('MODEL_NOT_CONFIGURED', 503);
  if (protocol !== 'openai-chat') throw new DomainError('MODEL_PROTOCOL_UNSUPPORTED', 503);
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new DomainError('MODEL_ENDPOINT_INVALID', 503);
  return { protocol, endpoint, model };
}

export class HttpModelClient {
  async execute(input: TaskInput, key: string): Promise<TransportResponse> {
    if (input.manifest.provider.protocol !== 'openai-chat') throw new DomainError('MODEL_PROTOCOL_UNSUPPORTED', 503);
    let response: Response;
    try {
      response = await fetch(input.manifest.provider.endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120_000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: input.manifest.provider.model, max_completion_tokens: 8192,
          messages: [{ role: 'system', content: input.manifest.prompt }, { role: 'user', content: JSON.stringify({ version_id: input.version_id, material: input.material }) }],
        }),
      });
    } catch { throw new DomainError('MODEL_NETWORK_ERROR', 502, true); }
    if (!response.body) throw new DomainError('MODEL_EMPTY_RESPONSE', 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 1_048_576) throw new DomainError('MODEL_RESPONSE_TOO_LARGE', 502);
      chunks.push(chunk);
    }
    return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
  }
}

export function decodeModelResponse(transport: TransportResponse): ModelResponse {
  if (transport.status !== 200) throw new DomainError(`MODEL_HTTP_${transport.status}`, 502, transport.status === 429 || transport.status >= 500);
  let raw: unknown;
  try { raw = JSON.parse(transport.body); } catch { throw new DomainError('MODEL_JSON_INVALID'); }
  const record = raw as { choices?: { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown; tool_calls?: unknown } }[]; usage?: Record<string, number> };
  const choice = Array.isArray(record?.choices) && record.choices.length === 1 ? record.choices[0] : undefined;
  if (!choice || typeof choice.message?.content !== 'string' || choice.message.refusal || choice.message.tool_calls) throw new DomainError('MODEL_RESPONSE_INVALID');
  let data: unknown;
  try { data = JSON.parse(choice.message.content); } catch { throw new DomainError('MODEL_JSON_INVALID'); }
  return { complete: choice.finish_reason === 'stop', finishReason: String(choice.finish_reason ?? 'unknown'), data, usage: record.usage };
}
