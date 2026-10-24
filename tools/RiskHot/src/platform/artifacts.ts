import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, link, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DomainError } from './types.js';

export interface ArtifactRef { sha256: string; size: number; kind: string }
export class ArtifactStore {
  constructor(private root: string) {}
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
