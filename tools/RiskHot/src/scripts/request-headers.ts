import { authenticationMode } from '../platform/auth.js';
import { required } from '../platform/db.js';

export async function requestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authenticationMode() === 'local') return { ...headers, origin: required('API_ORIGIN') };
  const response = await fetch(`${required('OIDC_ISSUER')}/protocol/openid-connect/token`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    body: new URLSearchParams({ grant_type: 'password', client_id: required('OIDC_CLIENT_ID'), client_secret: required('OIDC_CLIENT_SECRET'), username: required('OPERATOR_USERNAME'), password: required('OPERATOR_PASSWORD') }),
  });
  if (!response.ok) throw new Error('CLI_LOGIN_FAILED');
  const tokens = await response.json() as { access_token?: string };
  if (!tokens.access_token) throw new Error('CLI_LOGIN_FAILED');
  return { ...headers, authorization: `Bearer ${tokens.access_token}` };
}
