import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readCatalog } from '../information-ingestion/sources/catalog.js';
import { parseSource } from '../information-ingestion/processing/sources.js';
import { openFixture } from './fixture.js';
import { connectorFor,sourceEntryUrl } from '../information-ingestion/sources/connectors.js';

test('sources execute with frozen connection versions and reseeding preserves an operator pause', async () => {
  const c = await openFixture();
  try {
    const rows = await readCatalog('src/data/source-catalog.js');
    await c.repo.seedCatalog(rows);
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['*'] WHERE subject='review-operator'");
    const key=randomUUID();
    const op=await c.repo.submit({source_key:'wiki-source-005',limit:1},'review-operator',key);
    const frozen=await c.repo.connectionFor(op);
    assert.equal(frozen.id,'catalog-005-v2');
    const original=(await c.db.query('SELECT config FROM m1.source_versions WHERE source_id=$1 AND version=$2',[op.source_id,op.source_version])).rows[0].config;
    await c.db.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,$2,$3)',[op.source_id,op.source_version+1,{...original,connection:{...frozen,scope:'新版范围'}}]);
    await c.db.query('UPDATE m1.sources SET version=version+1 WHERE id=$1',[op.source_id]);
    assert.equal((await c.repo.connectionFor(op)).scope,frozen.scope);
    assert.equal((await c.repo.submit({source_key:'wiki-source-005',limit:1},'review-operator',key)).id,op.id);
    await c.db.query("UPDATE m1.sources SET state='DISABLED' WHERE id=$1",[op.source_id]);
    await c.repo.seedCatalog(rows);
    assert.equal((await c.db.query('SELECT state FROM m1.sources WHERE id=$1',[op.source_id])).rows[0].state,'DISABLED');
    await assert.rejects(()=>c.repo.submit({source_key:'wiki-source-005',limit:1},'review-operator',randomUUID()),/SOURCE_DISABLED/);
    await assert.rejects(()=>c.repo.submit({source_key:'wiki-source-017',limit:1},'review-operator',randomUUID()),/SOURCE_URL_MISSING/);
    await assert.rejects(()=>c.repo.submit({source_key:'wiki-source-035',limit:1},'review-operator',randomUUID()),/SOURCE_AUTH_REQUIRED/);
  } finally { await c.dispose(); }
});

test('distinct observation days at one data URL create separate identities without losing zeroes', async () => {
  const c = await openFixture();
  try {
    await c.repo.seedCatalog(await readCatalog('src/data/source-catalog.js'));
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['*'] WHERE subject='review-operator'");
    const saved:string[]=[];
    for(const day of ['23','24']){
      const op=await c.repo.submit({source_key:'wiki-source-005',limit:1},'review-operator',randomUUID());
      const profile=await c.repo.connectionFor(op);const url=profile.entryUrl!;
      const [id]=await c.repo.recordDiscovery(op.id,1,[{url,title:'DR007'}],Buffer.from('fixed URL descriptor'));
      const raw=Buffer.from(JSON.stringify({data:{showDateCN:`2026-10-${day} 17:00`},records:[{date:`26-10-${day}`,productCode:'DR007',weightedRate:'0',latestRate:'0',avgPrd:'7'}]}));
      await c.repo.recordRaw(id!,1,raw);const normalized=parseSource(profile,raw,url);
      await c.repo.recordNormalized(id!,1,normalized);saved.push(await c.repo.saveMaterial(id!,1));
      assert.match(normalized.segments[0]!.text,/weightedRate: 0/);
    }
    assert.notEqual(saved[0],saved[1]);
    assert.equal((await c.db.query("SELECT count(*)::int AS n FROM information.materials m JOIN m1.sources s ON s.id=m.source_id WHERE s.catalog_key='wiki-source-005'")).rows[0].n,2);
  } finally { await c.dispose(); }
});

test('repeated weekend windows for the same exchange observation reuse one material and version', async () => {
  const c=await openFixture();
  try{
    await c.repo.seedCatalog(await readCatalog('src/data/source-catalog.js'));
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['*'] WHERE subject='review-operator'");
    const p=connectorFor('wiki-source-013');const versions:string[]=[];
    for(const day of ['24','25']){
      const url=sourceEntryUrl(p,new Date(`2026-10-${day}T12:00:00Z`));
      const op=await c.repo.submit({source_key:p.key,limit:1,url},'review-operator',randomUUID());
      const [id]=await c.repo.recordDiscovery(op.id,1,[{url,title:'融资融券'}],Buffer.from('fixed descriptor'));
      const raw=Buffer.from(JSON.stringify({result:[{opDate:'20261023',rzye:0,rzmre:0,rzche:0,rqyl:0,rqylje:0,rqmcl:0,rzrqjyzl:0}]}));
      await c.repo.recordRaw(id!,1,raw);await c.repo.recordNormalized(id!,1,parseSource(p,raw,url));versions.push(await c.repo.saveMaterial(id!,1));
    }
    assert.equal(versions[0],versions[1]);
    assert.equal((await c.db.query("SELECT count(*)::int AS n FROM information.materials m JOIN m1.sources s ON s.id=m.source_id WHERE s.catalog_key='wiki-source-013'")).rows[0].n,1);
  }finally{await c.dispose();}
});
