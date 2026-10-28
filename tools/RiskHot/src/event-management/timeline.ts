export type TimePrecision = 'instant' | 'day' | 'month' | 'year' | 'unknown';
export interface TimelineEvidence {
 material_id: string; version_id: string; source_id: string; catalog_key: string; name: string;
 published_at_text: string | null; first_collected_at: string | null; relation_created_at: string;
}
interface Publication { value: string; precision: Exclude<TimePrecision, 'unknown'>; start: number; end: number }
const windowMs = 72 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

// Partial dates retain their precision. Shanghai is the list's calendar; a timestamp
// without an explicit offset is deliberately not interpreted as a local instant.
export function parsePublication(text: string | null): Publication | null {
 if (!text) return null;
 const value = text.trim();
 const partial = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
 if (partial) {
  const year = Number(partial[1]), month = Number(partial[2] ?? 1), day = Number(partial[3] ?? 1);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const precision = partial[3] ? 'day' : partial[2] ? 'month' : 'year';
  const start = Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  const end = precision === 'day' ? start + dayMs : (precision === 'month' ? Date.UTC(year, month, 1) : Date.UTC(year + 1, 0, 1)) - 8 * 60 * 60 * 1000;
  return {value, precision, start, end: end - 1};
 }
 const instant = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if (!instant) return null;
 const [, y, m, d, h, min, sec, , zone] = instant;
 if (!parsePublication(`${y}-${m}-${d}`) || Number(h) > 23 || Number(min) > 59 || Number(sec ?? 0) > 59) return null;
 if (zone !== 'Z' && (Number(zone!.slice(1,3)) > 14 || Number(zone!.slice(4)) > 59 || (Number(zone!.slice(1,3)) === 14 && Number(zone!.slice(4)) !== 0))) return null;
 const parsed = Date.parse(value.replace(' ', 'T'));
 return Number.isFinite(parsed) ? {value: new Date(parsed).toISOString(), precision:'instant', start:parsed, end:parsed} : null;
}
function collected(value: string | null) { const parsed = value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }

export function chooseDisplayTime(evidence: TimelineEvidence[]) {
 // Only evidence versions enter this set. An earlier, unrelated material revision
 // must never donate its collection time to a later version's publication time.
 const versions = [...new Map(evidence.map(x => [x.version_id, x])).values()];
 versions.sort((a,b) => Number(collected(a.first_collected_at) === null && !parsePublication(a.published_at_text)) - Number(collected(b.first_collected_at) === null && !parsePublication(b.published_at_text)) || (collected(a.first_collected_at) ?? Infinity) - (collected(b.first_collected_at) ?? Infinity) || a.material_id.localeCompare(b.material_id) || a.version_id.localeCompare(b.version_id));
 const basis = versions[0];
 const c = basis ? collected(basis.first_collected_at) : null, p = parsePublication(basis?.published_at_text ?? null);
 let display_time: string | null = null, display_time_precision: TimePrecision = 'unknown';
 let display_time_basis: 'first_collected' | 'published' | 'unknown' = 'unknown';
 let display_time_reason = '原文发布时间与首次收录时间均待核实';
 if (c !== null) {
  display_time = new Date(c).toISOString(); display_time_precision = 'instant'; display_time_basis = 'first_collected';
  if (!p) display_time_reason = basis?.published_at_text ? '发布时间无法可靠解析，按首次收录展示，发布时间待核实' : '发布时间缺失，按首次收录展示，发布时间待核实';
  else if (c < p.start) display_time_reason = '发布时间晚于收录，按首次收录展示，发布时间待核实';
  else if (c - p.start <= windowMs) display_time_reason = '原文发布至首次收录在0～72小时内（含）';
  else if (c - Math.min(c, p.end) > windowMs) { display_time = p.value; display_time_precision = p.precision; display_time_basis = 'published'; display_time_reason = '原文发布至首次收录超过72小时'; }
  else display_time_reason = '发布时间精度不足，范围跨越72小时阈值，按首次收录展示，发布时间待核实';
 } else if (p) { display_time = p.value; display_time_precision = p.precision; display_time_basis = 'published'; display_time_reason = '首次收录时间待核实，按原文发布时间展示'; }
 return {display_time, display_time_precision, display_time_basis, display_time_reason,
  first_collected_at:c === null ? null : new Date(c).toISOString(), published_at:p?.value ?? null,
  published_at_text:basis?.published_at_text ?? null, published_at_precision:p?.precision ?? 'unknown',
  time_material_id:basis?.material_id ?? null, time_version_id:basis?.version_id ?? null, time_source_id:basis?.source_id ?? null};
}
export function displayTimeRank(item: {display_time_precision: TimePrecision}) { return item.display_time_precision === 'unknown' ? 2 : ['month','year'].includes(item.display_time_precision) ? 1 : 0; }
export function displaySortValue(item: {display_time: string | null}) { return parsePublication(item.display_time)?.start ?? -Infinity; }
export function timelineSources(evidence: TimelineEvidence[], basisSource: string | null) {
 const ordered = [...evidence].sort((a,b) => a.relation_created_at.localeCompare(b.relation_created_at) || a.source_id.localeCompare(b.source_id));
 const sources = [...new Map(ordered.map(x => [x.source_id, {id:x.source_id,catalog_key:x.catalog_key,name:x.name}])).values()];
 return sources.sort((a,b) => Number(b.id === basisSource) - Number(a.id === basisSource));
}
