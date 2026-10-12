import { ensure, permit, type Context, type Domain } from './types.js';

/** Domain modules export a bound transition; callers cannot choose an arbitrary schema. */
export async function returnOrReject(
  c: Context,
  domain: Domain,
  id: string,
  version: number,
  decision: string,
  reason: string,
  allowedKinds: string[],
  allowedStates: string[],
) {
  permit(c, 'reviewer');
  ensure(['return', 'reject'].includes(decision), 'INVALID_DECISION', '审核决定无效');
  const row = await c.db.get(domain, id, true);
  ensure(row.version === version, 'VERSION_CONFLICT', '审核内容已变化，请刷新后重新决定', 409);
  ensure(
    allowedKinds.includes(row.kind) && allowedStates.includes(row.status),
    'INVALID_STATE',
    '仅待审核内容可退回或驳回；正式内容请使用撤回流程',
  );
  return c.db.update(
    domain,
    id,
    version,
    { ...row.data, review_reason: reason, reviewed_by: c.actor.id, reviewed_at: c.now },
    decision === 'return' ? 'draft' : 'rejected',
  );
}
