import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { transaction } from '../../platform/db.js';
import { DomainError, type NormalizedMaterial, type ExtractionResult } from '../../platform/types.js';
import { HandoffFiles, type HandoffFileName } from '../../platform/handoff-files.js';
import { digest, type Repository, type OperationRow } from './repository.js';
import { jsonBytes, validateInformationHandoff, type AcceptanceReceipt, type CandidateResultFile, type DeliveryView, type HandoffArtifact, type InformationHandoff } from './handoff-contract.js';
import { decodeModelResponse, type TaskInput, type TransportResponse } from './model.js';
import { validateExtraction } from './extraction.js';

const codeOf = (error: unknown) => error instanceof DomainError ? error.code : 'HANDOFF_IO_UNAVAILABLE';
export class InformationDelivery {
  readonly files: HandoffFiles;
  constructor(private repo: Repository) { this.files = new HandoffFiles(repo.artifacts); }
  private async record(version: string) {
    const row = (await this.repo.db.query(`SELECT d.*,m.state,m.receipt_processing_id,i.received_at,i.receipt,
      p.extraction_status,p.candidate_count,p.result_artifact_id
      FROM information.material_deliveries d JOIN platform.messages m ON m.id=d.message_id
      LEFT JOIN platform.inbox i ON i.message_id=m.id LEFT JOIN information.processing_runs p ON p.id=i.processing_id
      WHERE d.version_id=$1 AND d.consumer_id='F02'`, [version])).rows[0];
    if (!row) throw new DomainError('HANDOFF_NOT_FOUND', 404); return row;
  }
  private async versionFor(deliveryId: string): Promise<string> {
    const row = (await this.repo.db.query('SELECT version_id FROM information.material_deliveries WHERE message_id=$1', [deliveryId])).rows[0];
    if (!row) throw new DomainError('HANDOFF_NOT_FOUND',404); return row.version_id;
  }
  async ref(id: string): Promise<HandoffArtifact> {
    const row = (await this.repo.db.query('SELECT id AS artifact_id,sha256,size,kind FROM platform.artifact_objects WHERE id=$1',[id])).rows[0];
    if (!row) throw new DomainError('ARTIFACT_UNAVAILABLE',503); return row as HandoffArtifact;
  }
  private async context(versionId: string) {
    const row = (await this.repo.db.query(`SELECT v.*,o.source_id,o.source_version,o.operation_id,o.acquisition_id,o.collected_at,o.previous_version_id,o.version_kind,o.basis,
      s.catalog_key,c.config,op.url,op.actor FROM information.material_versions v
      JOIN information.material_version_origins o ON o.version_id=v.id
      JOIN m1.sources s ON s.id=o.source_id JOIN m1.source_versions c ON c.source_id=o.source_id AND c.version=o.source_version
      JOIN information.operations op ON op.id=o.operation_id
      JOIN information.acquisitions a ON a.id=o.acquisition_id AND a.operation_id=op.id AND a.raw_artifact_id=v.raw_artifact_id
      JOIN information.materials mat ON mat.id=v.material_id AND mat.source_id=o.source_id
      WHERE v.id=$1`,[versionId])).rows[0];
    if (!row) throw new DomainError('HANDOFF_PROVENANCE_REQUIRED',409); return row;
  }
  private async verify(packet: InformationHandoff): Promise<void> {
    const c = await this.context(packet.information.version_id);
    const d = await this.record(c.id);
    if (packet.delivery_id !== d.message_id || packet.information.information_id !== c.material_id || packet.information.version_no !== c.version_no || packet.information.previous_version_id !== c.previous_version_id || packet.source.source_id !== c.source_id || packet.source.source_config_version !== c.source_version || packet.provenance.operation_id !== c.operation_id || packet.provenance.acquisition_id !== c.acquisition_id || packet.provenance.collected_at !== c.collected_at.toISOString()) throw new DomainError('HANDOFF_VERSION_MISMATCH',409);
    for (const [key,id] of [['raw',c.raw_artifact_id],['normalized',c.normalized_artifact_id]] as const) {
      const expected = await this.ref(id), actual = packet.artifacts[key];
      const bytes = await this.repo.bytes(id);
      if (digest(expected) !== digest(actual) || bytes.length !== expected.size) throw new DomainError('HANDOFF_ARTIFACT_MISMATCH',409);
    }
    const material = await this.repo.json<NormalizedMaterial>(c.normalized_artifact_id);
    const segments = (await this.repo.db.query('SELECT id,text,raw_locator AS "rawLocator",kind FROM information.material_segments WHERE version_id=$1 ORDER BY ordinal',[c.id])).rows;
    const contentDigest = digest({title:material.title,published:material.publishedAtText,segments:material.segments.map(x=>({kind:x.kind,text:x.text}))});
    if (digest(packet.material) !== digest(material) || digest(material.segments) !== digest(segments) || contentDigest !== c.content_digest || packet.normalization.content_digest !== c.content_digest || packet.normalization.version !== c.normalizer_version) throw new DomainError('HANDOFF_CONTENT_MISMATCH',409);
  }
  async ensure(versionId: string): Promise<InformationHandoff> {
    let d = await this.record(versionId);
    if (!d.payload_artifact_id) {
      const c = await this.context(versionId), connection = c.config.connection;
      const packet: InformationHandoff = {
        schema_version:'riskhot.information-handoff.v1',delivery_id:d.message_id,consumer:'F02',
        information:{information_id:c.material_id,version_id:versionId,version_no:c.version_no,previous_version_id:c.previous_version_id,version_kind:c.version_kind},
        source:{source_id:c.source_id,source_config_version:c.source_version,catalog_key:c.catalog_key,name:c.config.catalog?.name ?? c.catalog_key,connector:connection?.id ?? c.config.connector,scope:connection?.scope ?? '历史配置范围'},
        provenance:{operation_id:c.operation_id,acquisition_id:c.acquisition_id,collected_at:c.collected_at.toISOString(),url:c.url},
        material:await this.repo.json(c.normalized_artifact_id),artifacts:{raw:await this.ref(c.raw_artifact_id),normalized:await this.ref(c.normalized_artifact_id)},
        normalization:{version:c.normalizer_version,content_digest:c.content_digest,checks:['saved_version','raw_readable','normalized_readable','segments_match'],attachment_status:'not_collected',limitations:['仅覆盖固定连接器声明的资料范围；未采集附件正文。']},
        saved:{operation_id:c.operation_id,at:c.created_at.toISOString()},
      };
      validateInformationHandoff(packet); await this.verify(packet);
      const artifact = await this.repo.artifact(await this.repo.artifacts.put(jsonBytes(packet),'information-handoff'));
      await this.repo.db.query('UPDATE information.material_deliveries SET payload_artifact_id=COALESCE(payload_artifact_id,$2) WHERE version_id=$1',[versionId,artifact]);
      d = await this.record(versionId);
    }
    const packet = validateInformationHandoff(await this.repo.json(d.payload_artifact_id)); await this.verify(packet);
    await this.files.publish(d.message_id,'information',await this.ref(d.payload_artifact_id));
    return packet;
  }
  private async owner(versionId: string, tx: PoolClient): Promise<OperationRow> {
    const row = (await tx.query<OperationRow>('SELECT * FROM information.operations WHERE version_id=$1 ORDER BY paused,created_at,id LIMIT 1',[versionId])).rows[0];
    if (!row) throw new DomainError('PROCESSING_OWNER_MISSING',409);
    await this.repo.checkSource(row,tx); return row;
  }
  async accept(deliveryId: string, claim?: { token: string; generation: number }): Promise<AcceptanceReceipt> {
    const versionId = await this.versionFor(deliveryId), packet = await this.ensure(versionId);
    const receipt = await transaction(this.repo.db,async tx=>{
      await this.repo.lockTaskGraph(tx);
      const d = (await tx.query('SELECT * FROM information.material_deliveries WHERE message_id=$1 FOR UPDATE',[deliveryId])).rows[0]!;
      const message = (await tx.query('SELECT * FROM platform.messages WHERE id=$1 FOR UPDATE',[deliveryId])).rows[0]!;
      if (claim && (d.lease_token !== claim.token || Number(d.generation) !== claim.generation || !d.lease_until || d.lease_until.getTime() <= Date.now())) throw new DomainError('STALE_DELIVERY',409);
      let inbox = (await tx.query('SELECT * FROM platform.inbox WHERE message_id=$1',[deliveryId])).rows[0];
      const legacy = Boolean(inbox);
      if (!inbox) {
        await this.owner(versionId,tx);
        const p = (await tx.query("INSERT INTO information.processing_runs(version_id) VALUES($1) ON CONFLICT(version_id,analysis_key) DO UPDATE SET version_id=EXCLUDED.version_id RETURNING id,generation",[versionId])).rows[0]!;
        inbox = (await tx.query('INSERT INTO platform.inbox(message_id,processing_id) VALUES($1,$2) RETURNING *',[deliveryId,p.id])).rows[0]!;
        await this.repo.intent(tx,'extract',p.id,Number(p.generation));
      }
      const result: AcceptanceReceipt = inbox.receipt ?? {
        schema_version:'riskhot.information-receipt.v1',delivery_id:deliveryId,information_id:packet.information.information_id,version_id:versionId,
        payload_artifact_id:d.payload_artifact_id,payload_sha256:(await tx.query('SELECT sha256 FROM platform.artifact_objects WHERE id=$1',[d.payload_artifact_id])).rows[0].sha256,
        processing_id:inbox.processing_id,analysis_key:'EXTRACTION_ONLY',accepted_at:inbox.received_at.toISOString(),status:'received',acceptance_basis:legacy?'legacy_inbox':'validated_handoff',
      };
      await tx.query('UPDATE platform.inbox SET receipt=COALESCE(receipt,$2) WHERE message_id=$1',[deliveryId,result]);
      await tx.query("UPDATE platform.messages SET state='received',receipt_processing_id=$2 WHERE id=$1",[deliveryId,inbox.processing_id]);
      await tx.query('UPDATE information.material_deliveries SET error_code=NULL,lease_token=NULL,lease_until=NULL WHERE message_id=$1',[deliveryId]);
      await this.repo.attachProcessing(tx,versionId);
      return result;
    });
    try { await this.publishReceipt(versionId,receipt); }
    catch { /* Only the file reconciler holding a lease projects publication failures. The receipt is already durable. */ }
    return receipt;
  }
  private async publishReceipt(versionId: string, receipt: AcceptanceReceipt): Promise<void> {
    const id = await this.repo.artifact(await this.repo.artifacts.put(jsonBytes(receipt),'information-receipt'));
    await this.repo.db.query('UPDATE information.material_deliveries SET receipt_artifact_id=COALESCE(receipt_artifact_id,$2) WHERE version_id=$1',[versionId,id]);
    await this.files.publish(receipt.delivery_id,'receipt',await this.ref(id));
  }
  async readAccepted(processingId: string): Promise<InformationHandoff> {
    const d = (await this.repo.db.query('SELECT d.* FROM information.material_deliveries d JOIN platform.inbox i ON i.message_id=d.message_id WHERE i.processing_id=$1',[processingId])).rows[0];
    if (!d?.payload_artifact_id) throw new DomainError('HANDOFF_NOT_RECEIVED',409);
    const bytes = await this.files.read(d.message_id,'information',await this.ref(d.payload_artifact_id));
    const packet = validateInformationHandoff(JSON.parse(bytes.toString('utf8'))); await this.verify(packet); return packet;
  }
  async publishResult(processingId:string):Promise<void> {
    const p=(await this.repo.db.query('SELECT * FROM information.processing_runs WHERE id=$1',[processingId])).rows[0];
    if(!p||p.extraction_status!=='completed')throw new DomainError('EXTRACTION_NOT_COMPLETED',409);
    const d=await this.record(p.version_id);
    try {
      const packet=await this.readAccepted(processingId);
      let artifact=p.result_artifact_id as string|null;
      if(!artifact){
        const candidates=(await this.repo.candidates(processingId)) as {id:string;candidate_key:string;status:string;ordinal:number;payload:unknown}[];
        if(candidates.length!==p.candidate_count)throw new DomainError('CANDIDATE_COUNT_MISMATCH',409);
        let data:ExtractionResult|null=p.validated_result_artifact_id?await this.repo.json(p.validated_result_artifact_id):null;
        if(!data){
          const attempt=(await this.repo.db.query("SELECT response_artifact_id,request_artifact_id FROM platform.model_attempts WHERE processing_id=$1 AND status='accepted' AND response_artifact_id IS NOT NULL ORDER BY attempt_no DESC LIMIT 1",[processingId])).rows[0];
          if(attempt)try{
            const input=await this.repo.json<TaskInput>(attempt.request_artifact_id);
            const recovered=validateExtraction(decodeModelResponse(await this.repo.json<TransportResponse>(attempt.response_artifact_id)),input.material);
            if(digest(recovered.candidates)===digest(candidates.map(c=>c.payload)))data=recovered;
          }catch{ /* Historical metadata is reported as missing, never invented. */ }
        }
        const result:CandidateResultFile={schema_version:'riskhot.candidate-result.v1',delivery_id:d.message_id,information_id:packet.information.information_id,version_id:p.version_id,processing_id:processingId,analysis_key:p.analysis_key,processing_scope:p.processing_scope,completed_at:p.completed_at.toISOString(),input_artifact_id:p.input_artifact_id,manifest_artifact_id:p.manifest_artifact_id,candidate_count:p.candidate_count,result_status:p.result_status,next_step:p.candidate_count?2:null,
          candidates:candidates.map(c=>({candidate_id:c.id,candidate_key:c.candidate_key,ordinal:c.ordinal,status:c.status,payload:c.payload})),covered_segment_ids:data?.covered_segment_ids??null,no_event_reason:data?.no_event_reason??null,warnings:data?.warnings??[],limitations:['EXTRACTION_ONLY：完整事件类型字典及初步Target字段尚待扩展。',...(!data?['历史结果未保留可恢复的完整抽取附加信息；不重新调用模型。']:[])]};
        const id=await this.repo.artifact(await this.repo.artifacts.put(jsonBytes(result),'candidate-result'));
        artifact=(await this.repo.db.query('UPDATE information.processing_runs SET result_artifact_id=COALESCE(result_artifact_id,$2) WHERE id=$1 RETURNING result_artifact_id',[processingId,id])).rows[0].result_artifact_id;
      }
      await this.files.publish(d.message_id,'candidates',await this.ref(artifact!),processingId);
    }catch(error){
      await this.repo.db.query("UPDATE information.material_deliveries SET files_state='recoverable',files_error_code=$3 WHERE version_id=$1 AND files_generation=$2",[p.version_id,d.files_generation,codeOf(error)]);throw error;
    }
  }
  async view(versionId: string, actor: string): Promise<DeliveryView> {
    await this.authorize(versionId,actor,'read'); const d = await this.record(versionId);
    const descriptor = async (name:HandoffFileName,id:string|null) => id ? {url:`/api/v1/l0/versions/${versionId}/delivery/files/${name}`,relative_path:this.files.path(d.message_id,name,d.receipt_processing_id),...await this.ref(id)} : null;
    return {delivery_id:d.message_id,version_id:versionId,status:d.state==='received'?'received':d.error_code?'recoverable':'pending',generation:Number(d.generation),reason_code:d.error_code,received_at:d.received_at?.toISOString()??null,processing_id:d.receipt_processing_id,extraction_status:d.extraction_status??null,candidate_count:d.candidate_count??null,
      files:{status:d.files_state,generation:Number(d.files_generation),reason_code:d.files_error_code,information:await descriptor('information',d.payload_artifact_id),receipt:await descriptor('receipt',d.receipt_artifact_id),candidates:await descriptor('candidates',d.result_artifact_id)}};
  }
  private async authorize(versionId:string,actor:string,permission:string,tx=this.repo.db):Promise<void> {
    const s=(await tx.query('SELECT s.catalog_key,s.state FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE v.id=$1',[versionId])).rows[0];
    if(!s)throw new DomainError('NOT_FOUND',404); await this.repo.authorize(actor,permission,s.catalog_key,tx);
  }
  async retry(deliveryId:string,actor:string,input:{expected_generation:number;reason:string},key:string):Promise<DeliveryView> { return this.recover(deliveryId,actor,input,key,false); }
  async retryFiles(deliveryId:string,actor:string,input:{expected_generation:number;reason:string},key:string):Promise<DeliveryView> { return this.recover(deliveryId,actor,input,key,true); }
  private async recover(deliveryId:string,actor:string,input:{expected_generation:number;reason:string},key:string,files:boolean):Promise<DeliveryView> {
    const versionId=await this.versionFor(deliveryId);
    if(!input.reason.trim())throw new DomainError('RETRY_REASON_REQUIRED',400);
    await this.repo.action(actor,files?'handoff-files-retry':'handoff-retry',key,{deliveryId,...input},async tx=>{
      const source=(await tx.query('SELECT s.catalog_key,s.state FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id CROSS JOIN LATERAL platform.lock_source(m.source_id) s WHERE v.id=$1',[versionId])).rows[0];
      await this.repo.authorize(actor,'read',source.catalog_key,tx);await this.repo.authorize(actor,'retry',source.catalog_key,tx);
      if(source.state!=='ACTIVE')throw new DomainError('SOURCE_DISABLED',409);
    },async tx=>{
      await this.repo.lockTaskGraph(tx);
      const d=(await tx.query('SELECT d.*,m.state FROM information.material_deliveries d JOIN platform.messages m ON m.id=d.message_id WHERE d.message_id=$1 FOR UPDATE OF d,m',[deliveryId])).rows[0];
      if(!files&&d.state==='received')return {delivery_id:deliveryId};
      const generation=Number(files?d.files_generation:d.generation);
      if(generation!==input.expected_generation)throw new DomainError('STALE_DELIVERY',409);
      if(!files&&d.lease_until?.getTime()>Date.now())throw new DomainError('DELIVERY_RUNNING',409);
      if(files?d.files_state!=='recoverable':!d.error_code)throw new DomainError('DELIVERY_NOT_RECOVERABLE',409);
      if(files)await tx.query("UPDATE information.material_deliveries SET files_generation=files_generation+1,files_window_start=files_attempts,files_state='pending',files_error_code=NULL,files_next_attempt_at=now(),files_lease_token=NULL,files_lease_until=NULL WHERE message_id=$1",[deliveryId]);
      else {
        await tx.query('UPDATE information.material_deliveries SET generation=generation+1,window_start_attempts=attempts,error_code=NULL,lease_token=NULL,lease_until=NULL WHERE message_id=$1',[deliveryId]);
        await tx.query("UPDATE platform.messages SET state='pending',next_attempt_at=now() WHERE id=$1",[deliveryId]);
      }
      await tx.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,$2,$3,$4)',[actor,files?'handoff-files-retry':'handoff-retry',deliveryId,input]); return {delivery_id:deliveryId};
    });
    return this.view(versionId,actor);
  }
  async reconcile(limit=20):Promise<void> {
    const pending=(await this.repo.db.query("SELECT d.message_id FROM information.material_deliveries d JOIN platform.messages m ON m.id=d.message_id WHERE m.state<>'received' AND m.next_attempt_at<=now() AND d.attempts-d.window_start_attempts<10 AND (d.lease_until IS NULL OR d.lease_until<=now()) ORDER BY m.next_attempt_at,d.message_id LIMIT $1",[limit])).rows;
    for(const row of pending){
      const claim=(await this.repo.db.query("UPDATE information.material_deliveries SET lease_token=$2,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 WHERE message_id=$1 AND attempts-window_start_attempts<10 AND (lease_until IS NULL OR lease_until<=clock_timestamp()) RETURNING generation,lease_token",[row.message_id,randomUUID()])).rows[0];
      if(!claim)continue;
      try{await this.accept(row.message_id,{token:claim.lease_token,generation:Number(claim.generation)});}
      catch(error){await transaction(this.repo.db,async tx=>{
        const updated=await tx.query('UPDATE information.material_deliveries SET error_code=$4,lease_until=NULL,lease_token=NULL WHERE message_id=$1 AND generation=$2 AND lease_token=$3 RETURNING message_id',[row.message_id,claim.generation,claim.lease_token,codeOf(error)]);
        if(updated.rowCount)await tx.query("UPDATE platform.messages SET state='blocked',attempts=attempts+1,next_attempt_at=clock_timestamp()+interval '30 seconds' WHERE id=$1 AND state<>'received'",[row.message_id]);
      });}
    }
    await transaction(this.repo.db,async tx=>{await this.repo.lockTaskGraph(tx);await this.repo.attachProcessing(tx);});
    const repairs=(await this.repo.db.query(`SELECT d.message_id,d.version_id FROM information.material_deliveries d JOIN platform.messages m ON m.id=d.message_id
      LEFT JOIN information.processing_runs p ON p.id=m.receipt_processing_id WHERE m.state='received'
      AND d.files_attempts-d.files_window_start<10 AND d.files_next_attempt_at<=now() ORDER BY d.files_next_attempt_at,d.message_id LIMIT $1`,[limit])).rows;
    for(const row of repairs){
      const lease=(await this.repo.db.query("UPDATE information.material_deliveries SET files_attempts=files_attempts+1,files_lease_token=$2,files_lease_until=clock_timestamp()+interval '60 seconds' WHERE message_id=$1 AND files_attempts-files_window_start<10 AND (files_lease_until IS NULL OR files_lease_until<=clock_timestamp()) RETURNING files_generation,files_lease_token",[row.message_id,randomUUID()])).rows[0];
      if(!lease)continue;
      try{
        await this.ensure(row.version_id);
        const d=await this.record(row.version_id);
        if(!d.receipt)await this.accept(row.message_id);else await this.publishReceipt(row.version_id,d.receipt);
        if(d.extraction_status==='completed')await this.publishResult(d.receipt_processing_id);
        await this.repo.db.query("UPDATE information.material_deliveries SET files_state='ready',files_error_code=NULL,files_window_start=files_attempts,files_next_attempt_at=clock_timestamp()+interval '5 minutes',files_lease_token=NULL,files_lease_until=NULL WHERE message_id=$1 AND files_generation=$2 AND files_lease_token=$3",[row.message_id,lease.files_generation,lease.files_lease_token]);
      }catch(error){await this.repo.db.query("UPDATE information.material_deliveries SET files_state='recoverable',files_error_code=$3,files_next_attempt_at=clock_timestamp()+interval '30 seconds',files_lease_token=NULL,files_lease_until=NULL WHERE message_id=$1 AND files_generation=$2 AND files_lease_token=$4",[row.message_id,lease.files_generation,codeOf(error),lease.files_lease_token]);}
    }
  }
}
