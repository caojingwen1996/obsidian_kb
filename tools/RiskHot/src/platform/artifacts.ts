import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, link, unlink, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DomainError } from './types.js';

export interface ArtifactRef { sha256: string; size: number; kind: string }
export class ArtifactStore {
  constructor(private root: string) {}
  private capturePath(owner: string, phase: 'raw' | 'discovery'): string {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(owner)) throw new DomainError('CAPTURE_OWNER_INVALID', 400);
    return join(this.root, 'captures', owner, phase);
  }
  async recoverCapture(owner: string, phase: 'raw' | 'discovery'): Promise<ArtifactRef | null> {
    const directory = this.capturePath(owner, phase);
    try { await stat(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    try {
      const metadata = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8')) as { owner: string; phase: string; ref: ArtifactRef };
      const bytes = await readFile(join(directory, 'payload'));
      const expectedKind = phase === 'raw' ? 'raw' : 'discovery-capture';
      if (metadata.owner !== owner || metadata.phase !== phase || metadata.ref.kind !== expectedKind || metadata.ref.size !== bytes.byteLength || createHash('sha256').update(bytes).digest('hex') !== metadata.ref.sha256) throw new Error();
      return await this.put(bytes, expectedKind);
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('CAPTURE_INTEGRITY', 503); }
  }
  async capture(owner: string, phase: 'raw' | 'discovery', bytes: Buffer): Promise<ArtifactRef> {
    const existing = await this.recoverCapture(owner, phase);
    if (existing) return existing;
    const destination = this.capturePath(owner, phase);
    const parentPath = join(this.root, 'captures', owner);
    await mkdir(parentPath, { recursive: true, mode: 0o700 });
    const temporary = join(parentPath, `.${phase}-${randomUUID()}`);
    await mkdir(temporary, { mode: 0o700 });
    const ref = { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength, kind: phase === 'raw' ? 'raw' : 'discovery-capture' };
    try {
      for (const [name, content] of [['payload', bytes], ['receipt.json', Buffer.from(JSON.stringify({ owner, phase, ref }))]] as const) {
        const file = await open(join(temporary, name), 'wx', 0o600);
        try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
      }
      const staging = await open(temporary, 'r'); try { await staging.sync(); } finally { await staging.close(); }
      try { await rename(temporary, destination); }
      catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
      const parent = await open(parentPath, 'r'); try { await parent.sync(); } finally { await parent.close(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
    const captured = await this.recoverCapture(owner, phase);
    if (!captured) throw new DomainError('CAPTURE_UNAVAILABLE', 503);
    return captured;
  }
  async put(bytes: Buffer, kind: string): Promise<ArtifactRef> {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const directory = join(this.root, sha256.slice(0, 2));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    try {
      try { await link(temporary, join(directory, sha256)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      await this.read(sha256);
      const parent = await open(directory, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    } finally { await unlink(temporary); }
    return { sha256, size: bytes.byteLength, kind };
  }
  async read(sha256: string): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new DomainError('ARTIFACT_REF_INVALID', 400);
    let bytes: Buffer;
    try { bytes = await readFile(join(this.root, sha256.slice(0, 2), sha256)); }
    catch { throw new DomainError('ARTIFACT_UNAVAILABLE', 503, true); }
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new DomainError('ARTIFACT_INTEGRITY', 503);
    return bytes;
  }
}
