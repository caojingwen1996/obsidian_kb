import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  ensure,
  expected,
  object,
  permit,
  strings,
  text,
  type Actor,
  type CommandHandler,
  type Data,
  type RecordRow,
  type Role,
} from '../../platform/core/types.js';
export function passwordHash(password: string) {
  ensure(password.length >= 12 && password.length <= 128, 'WEAK_PASSWORD', '密码长度为12到128位');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function passwordMatches(password: string, stored: string) {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function actorFrom(r: RecordRow): Actor {
  return {
    id: r.id,
    name: text(r.data, 'name'),
    roles: strings(r.data, 'roles') as Role[],
    active: r.status === 'active',
    evidence_access: r.data.evidence_access === true,
  };
}
export function publicUser(r: RecordRow) {
  const { password_hash, ...data } = r.data;
  return { ...r, data };
}
const user: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const d = object(i, 'data');
  text(d, 'name');
  text(d, 'username');
  ensure(
    strings(d, 'roles').every((x) => ['reader', 'researcher', 'reviewer', 'admin'].includes(x)),
    'INVALID_ROLE',
    '账号角色无效',
  );
  ensure(typeof d.evidence_access === 'boolean', 'INVALID_PERMISSION', '需要明确原文读取权限');
  ensure(
    !(await c.db.list('identity', 'user')).some((u) => u.id !== i.id && u.data.username === d.username),
    'USERNAME_EXISTS',
    '账号名称已存在',
    409,
  );
  if (i.id) {
    const old = await c.db.get('identity', text(i, 'id'), true);
    const state = d.active === false ? 'disabled' : 'active';
    if (old.id === c.actor.id)
      ensure(
        state === 'active' && strings(d, 'roles').includes('admin'),
        'SELF_LOCKOUT',
        '不能撤销自己的管理员权限',
      );
    const result = await c.db.update(
      'identity',
      old.id,
      expected(i),
      {
        name: d.name!,
        username: d.username!,
        roles: d.roles!,
        evidence_access: d.evidence_access!,
        password_hash: typeof i.password === 'string' ? passwordHash(i.password) : old.data.password_hash!,
      },
      state,
    );
    return JSON.parse(JSON.stringify(publicUser(result)));
  }
  const row = await c.db.create(
    'identity',
    'user',
    {
      name: d.name!,
      username: d.username!,
      roles: d.roles!,
      evidence_access: d.evidence_access!,
      password_hash: passwordHash(text(i, 'password')),
    },
    'active',
  );
  return JSON.parse(JSON.stringify(publicUser(row)));
};
export const identityCommands: Record<string, CommandHandler> = { 'identity.user': user };
