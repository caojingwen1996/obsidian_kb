import { required } from '../src/platform/db.js';

const response = await fetch(`${required('OIDC_ISSUER')}/protocol/openid-connect/token`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), body: new URLSearchParams({ grant_type: 'password', client_id: required('OIDC_CLIENT_ID'), client_secret: required('OIDC_CLIENT_SECRET'), username: required('OPERATOR_USERNAME'), password: required('OPERATOR_PASSWORD') }) });
if (!response.ok) throw new Error('CLI_LOGIN_FAILED');
const token = await response.json() as { access_token: string };
const result = await fetch(`${required('API_ORIGIN')}/api/v1/l0/monitor`, { headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000) });
if (!result.ok) throw new Error(`MONITOR_HTTP_${result.status}`);
console.log(JSON.stringify(await result.json(), null, 2));
