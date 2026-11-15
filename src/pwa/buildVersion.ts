// Node only. Imported by the Vite plugin (swPlugin.ts), never by sw.ts.
import { createHash } from 'node:crypto';

export type BuildFile = { path: string; content: Uint8Array };

const VERSION_LENGTH = 12;

function lengthPrefix(length: number): Buffer {
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64BE(BigInt(length));
  return prefix;
}

function compareByPath(a: BuildFile, b: BuildFile): number {
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
}

/**
 * SHA-256 over the files sorted by path (path and content both hashed),
 * first 12 hex characters. Each path and content is preceded by its byte
 * length, so different file lists cannot produce the same hashed stream.
 */
export function computeBuildVersion(files: readonly BuildFile[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort(compareByPath)) {
    const pathBytes = Buffer.from(file.path, 'utf8');
    hash.update(lengthPrefix(pathBytes.byteLength));
    hash.update(pathBytes);
    hash.update(lengthPrefix(file.content.byteLength));
    hash.update(file.content);
  }
  return hash.digest('hex').slice(0, VERSION_LENGTH);
}
