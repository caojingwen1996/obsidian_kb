import { createHash } from 'node:crypto';
import { link, lstat, mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ArtifactStore, type ArtifactRef } from './artifacts.js';
import { DomainError } from './types.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type HandoffFileName = 'information' | 'receipt' | 'candidates';
export class HandoffFiles {
  constructor(private store: ArtifactStore) {}
  path(deliveryId: string, name: HandoffFileName, processingId?: string): string {
    if (!uuid.test(deliveryId) || !['information', 'receipt', 'candidates'].includes(name) || (name === 'candidates' && (!processingId || !uuid.test(processingId)))) throw new DomainError('HANDOFF_PATH_INVALID', 400);
    return join('handoffs', 'f01-f02', deliveryId, ...(name === 'candidates' ? ['analyses', processingId!] : []), `${name}.json`);
  }
  async read(deliveryId: string, name: HandoffFileName, ref: ArtifactRef, processingId?: string): Promise<Buffer> {
    const path = join(this.store.root, this.path(deliveryId, name, processingId));
    const info = await lstat(path).catch(() => { throw new DomainError('HANDOFF_FILE_UNAVAILABLE', 503); });
    if (!info.isFile() || info.isSymbolicLink()) throw new DomainError('HANDOFF_FILE_CONFLICT', 409);
    const bytes = await readFile(path);
    if (bytes.length !== ref.size || createHash('sha256').update(bytes).digest('hex') !== ref.sha256) throw new DomainError('HANDOFF_FILE_CONFLICT', 409);
    return bytes;
  }
  async publish(deliveryId: string, name: HandoffFileName, ref: ArtifactRef, processingId?: string): Promise<string> {
    const relative = this.path(deliveryId, name, processingId), path = join(this.store.root, relative);
    const bytes = await this.store.read(ref.sha256);
    if (bytes.length !== ref.size) throw new DomainError('HANDOFF_SIZE_MISMATCH', 409);
    const directory = join(path, '..');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await link(join(this.store.root, ref.sha256.slice(0, 2), ref.sha256), path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    await this.read(deliveryId, name, ref, processingId);
    const parent = await open(directory, 'r'); try { await parent.sync(); } finally { await parent.close(); }
    return relative;
  }
}
