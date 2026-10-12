import { BusinessError, type Data } from '../core/types.js';

function localParts(time: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(time);
  return Object.fromEntries(parts.filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
}

function midnight(localDate: Date, timezone: string): string {
  const target = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate());
  let candidate = target;
  for (let i = 0; i < 5; i += 1) {
    const p = localParts(new Date(candidate), timezone);
    const represented = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
    const delta = target - represented;
    if (delta === 0) return new Date(candidate).toISOString();
    candidate += delta;
  }
  throw new BusinessError('SCHEDULE_TIME_AMBIGUOUS', '当前时区周期边界不存在或无法确定；请提供明确周期时间');
}

export function scheduleCommand(
  type: string,
  input: Data,
  scheduledAt: string,
  timezone: string,
): { name: string; input: Data } | null {
  if (type === 'collect') {
    if (typeof input.content !== 'string' || !input.content.trim()) return null;
    return { name: 'information.ingest', input };
  }
  if (type === 'analysis')
    return { name: 'analysis.start', input: { ...input, snapshot_time: input.snapshot_time || scheduledAt } };
  if (type !== 'report') throw new BusinessError('INVALID_PLAN', '计划类型无效');
  if (input.period_start && input.period_end)
    return { name: 'publication.generate', input: { ...input, cutoff: input.cutoff || scheduledAt } };
  const reportType = String(input.type || 'daily');
  if (!['daily', 'weekly', 'monthly'].includes(reportType))
    throw new BusinessError('INVALID_REPORT_TYPE', '计划报告类型无效');
  const parts = localParts(new Date(scheduledAt), timezone);
  const end = new Date(Date.UTC(parts.year!, parts.month! - 1, parts.day!));
  if (reportType === 'weekly') end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7));
  if (reportType === 'monthly') end.setUTCDate(1);
  const start = new Date(end);
  if (reportType === 'monthly') start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCDate(start.getUTCDate() - (reportType === 'weekly' ? 7 : 1));
  return {
    name: 'publication.generate',
    input: {
      type: reportType,
      scope: input.scope || '宏观风险',
      period_start: midnight(start, timezone),
      period_end: midnight(end, timezone),
      cutoff: scheduledAt,
    },
  };
}
