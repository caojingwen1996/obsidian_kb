import { database, required } from '../src/platform/db.js';

const origin = new URL(required('OIDC_ISSUER')).origin;
const tokenResponse = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'riskhot-bootstrap', password: required('OIDC_ADMIN_PASSWORD') }) });
if (!tokenResponse.ok) throw new Error('IDENTITY_BOOTSTRAP_LOGIN_FAILED');
const token = await tokenResponse.json() as { access_token: string };
async function admin(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const response = await fetch(`${origin}/admin/${path}`, { method, headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok && ![404, 409].includes(response.status)) throw new Error(`IDENTITY_SETUP_${response.status}`);
  return response;
}
if ((await admin('realms/riskhot')).status === 404) await admin('realms', 'POST', { realm: 'riskhot', enabled: true, registrationAllowed: false, accessTokenLifespan: 600 });
const clientId = required('OIDC_CLIENT_ID');
const clients = await (await admin(`realms/riskhot/clients?clientId=${encodeURIComponent(clientId)}`)).json() as { id: string }[];
const client = { clientId, enabled: true, protocol: 'openid-connect', publicClient: false, secret: required('OIDC_CLIENT_SECRET'), standardFlowEnabled: true, directAccessGrantsEnabled: true, redirectUris: [`${required('API_ORIGIN')}/auth/callback`], webOrigins: [required('API_ORIGIN')], protocolMappers: [{ name: 'riskhot-api-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.client.audience': clientId, 'id.token.claim': 'false', 'access.token.claim': 'true' } }] };
if (clients[0]) await admin(`realms/riskhot/clients/${clients[0].id}`, 'PUT', client);
else await admin('realms/riskhot/clients', 'POST', client);
const username = required('OPERATOR_USERNAME');
let users = await (await admin(`realms/riskhot/users?username=${encodeURIComponent(username)}&exact=true`)).json() as { id: string }[];
if (!users[0]) {
  await admin('realms/riskhot/users', 'POST', { username, enabled: true, emailVerified: true, firstName: 'Local', lastName: 'Operator', email: 'operator@localhost.invalid', credentials: [{ type: 'password', value: required('OPERATOR_PASSWORD'), temporary: false }] });
  users = await (await admin(`realms/riskhot/users?username=${encodeURIComponent(username)}&exact=true`)).json() as { id: string }[];
}
if (!users[0]) throw new Error('IDENTITY_OPERATOR_MISSING');
const db = database('ADMIN_DATABASE_URL');
try {
  await db.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES($1,ARRAY['read','submit','source_admin','retry','model_budget'],ARRAY['*']) ON CONFLICT(subject) DO UPDATE SET permissions=EXCLUDED.permissions,source_keys=EXCLUDED.source_keys", [users[0].id]);
  console.log('Dedicated local identity realm and explicitly authorized operator initialized.');
} finally { await db.end(); }
