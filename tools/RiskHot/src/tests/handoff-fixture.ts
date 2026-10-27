import { openFixture } from './fixture.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { InformationDelivery } from '../information-ingestion/processing/handoff.js';

export async function savedFixture() {
  const c = await openFixture();
  const [child] = await c.repo.recordDiscovery(c.parent.id, 1, [{ url: c.url, title: '' }], Buffer.from('list'));
  await c.repo.recordRaw(child!, 1, c.raw); const material = parsePbc(c.raw, c.url);
  await c.repo.recordNormalized(child!, 1, material); const version = await c.repo.saveMaterial(child!, 1);
  const delivery = new InformationDelivery(c.repo);
  const message = (await c.db.query('SELECT id FROM platform.messages WHERE version_id=$1', [version])).rows[0].id as string;
  return { ...c, child:child!, material, version, delivery, message };
}

