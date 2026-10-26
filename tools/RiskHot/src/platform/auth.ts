import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Pool } from 'pg';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { DomainError } from './types.js';
import { required } from './db.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
interface Discovery { issuer: string; jwks_uri: string; authorization_endpoint: string; token_endpoint: string }
export const LOCAL_OPERATOR = 'riskhot-local-operator';
export type AuthenticationMode = 'local' | 'oidc';
export interface AuthenticationOptions { mode?: AuthenticationMode; origin?: string }
export function authenticationMode(): AuthenticationMode {
  const mode = process.env.AUTH_MODE ?? 'local';
  if (mode !== 'local' && mode !== 'oidc') throw new DomainError('AUTH_MODE_INVALID', 503);
  return mode;
}
export class Authentication {
  private discovery!: Discovery;
  private jwks!: ReturnType<typeof createRemoteJWKSet>;
  private issuer = '';
  private clientId = '';
  private origin: string;
  readonly mode: AuthenticationMode;
  constructor(private db: Pool, options: AuthenticationOptions = {}) {
    this.mode = options.mode ?? authenticationMode();
    this.origin = options.origin ?? required('API_ORIGIN');
  }
  async initialize(): Promise<void> {
    if (this.mode === 'local') {
      const origin = new URL(this.origin);
      if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.origin !== this.origin) throw new DomainError('LOCAL_ORIGIN_REQUIRED', 503);
      return;
    }
    this.issuer = required('OIDC_ISSUER'); this.clientId = required('OIDC_CLIENT_ID');
    const response = await fetch(`${this.issuer}/.well-known/openid-configuration`, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new DomainError('IDENTITY_UNAVAILABLE', 503);
    this.discovery = await response.json() as Discovery;
    if (this.discovery.issuer !== this.issuer || [this.discovery.jwks_uri, this.discovery.authorization_endpoint, this.discovery.token_endpoint].some(url => new URL(url).origin !== new URL(this.issuer).origin)) throw new DomainError('IDENTITY_CONFIGURATION_INVALID', 503);
    this.jwks = createRemoteJWKSet(new URL(this.discovery.jwks_uri));
  }
  private cookieOptions() { return { httpOnly: true, sameSite: 'lax' as const, secure: this.origin.startsWith('https:'), path: '/' }; }
  async subject(request: FastifyRequest): Promise<string> {
    if (this.mode === 'local') {
      const origin = request.headers.origin;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip) || request.headers.host !== new URL(this.origin).host || (origin !== undefined && origin !== this.origin)) throw new DomainError('LOCAL_ORIGIN_REQUIRED', 403);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin !== this.origin) throw new DomainError('ORIGIN_REQUIRED', 403);
      return LOCAL_OPERATOR;
    }
    const bearer = request.headers.authorization;
    try {
      if (bearer) {
        if (!bearer.startsWith('Bearer ')) throw new Error();
        const { payload } = await jwtVerify(bearer.slice(7), this.jwks, { issuer: this.issuer, audience: this.clientId, algorithms: ['RS256'] });
        if (!payload.sub || payload.typ !== 'Bearer' || typeof payload.exp !== 'number') throw new Error();
        return payload.sub;
      }
      const session = request.cookies.riskhot_session;
      if (session) {
        const record = (await this.db.query<{ subject: string }>('SELECT subject FROM platform.auth_sessions WHERE token_hash=$1 AND expires_at>now()', [hash(session)])).rows[0];
        if (record) {
          if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== this.origin) throw new DomainError('ORIGIN_REQUIRED', 403);
          return record.subject;
        }
      }
    } catch (error) { if (error instanceof DomainError) throw error; }
    throw new DomainError('UNAUTHENTICATED', 401);
  }
  async login(reply: FastifyReply): Promise<void> {
    if (this.mode === 'local') { await reply.redirect('/m1'); return; }
    const state = random(), nonce = random(), verifier = random();
    await this.db.query('INSERT INTO platform.auth_states(state_hash,verifier,nonce,expires_at) VALUES($1,$2,$3,now()+interval \'10 minutes\')', [hash(state), verifier, nonce]);
    const url = new URL(this.discovery.authorization_endpoint);
    url.search = new URLSearchParams({ client_id: this.clientId, redirect_uri: `${this.origin}/auth/callback`, response_type: 'code', scope: 'openid profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    reply.setCookie('riskhot_login_state', state, { ...this.cookieOptions(), maxAge: 600 });
    await reply.redirect(url.href);
  }
  async callback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (this.mode === 'local') { await reply.redirect('/m1'); return; }
    const { state, code } = request.query as { state?: string; code?: string };
    if (!state || !code || request.cookies.riskhot_login_state !== state) throw new DomainError('LOGIN_STATE_INVALID', 401);
    const record = (await this.db.query<{ verifier: string; nonce: string }>('DELETE FROM platform.auth_states WHERE state_hash=$1 AND expires_at>now() RETURNING verifier,nonce', [hash(state)])).rows[0];
    if (!record) throw new DomainError('LOGIN_STATE_INVALID', 401);
    const response = await fetch(this.discovery.token_endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ grant_type: 'authorization_code', client_id: this.clientId, client_secret: required('OIDC_CLIENT_SECRET'), redirect_uri: `${this.origin}/auth/callback`, code, code_verifier: record.verifier }) });
    if (!response.ok) throw new DomainError('LOGIN_EXCHANGE_FAILED', 401);
    const tokens = await response.json() as { id_token?: string };
    if (!tokens.id_token) throw new DomainError('LOGIN_IDENTITY_MISSING', 401);
    const { payload } = await jwtVerify(tokens.id_token, this.jwks, { issuer: this.issuer, audience: this.clientId, algorithms: ['RS256'] });
    if (!payload.sub || payload.nonce !== record.nonce || typeof payload.exp !== 'number') throw new DomainError('LOGIN_IDENTITY_INVALID', 401);
    const session = random();
    await this.db.query('INSERT INTO platform.auth_sessions(token_hash,subject,expires_at) VALUES($1,$2,now()+interval \'2 hours\')', [hash(session), payload.sub]);
    reply.clearCookie('riskhot_login_state', this.cookieOptions());
    reply.setCookie('riskhot_session', session, { ...this.cookieOptions(), maxAge: 7200 });
    await reply.redirect('/');
  }
  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.subject(request);
    if (request.cookies.riskhot_session) await this.db.query('DELETE FROM platform.auth_sessions WHERE token_hash=$1', [hash(request.cookies.riskhot_session)]);
    reply.clearCookie('riskhot_session', this.cookieOptions());
    await reply.code(204).send();
  }
}
