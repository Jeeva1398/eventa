import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ModelSpec, modelPath } from './registry.js';

export interface Progress {
  received: number;
  total?: number;
  bytesPerSecond: number;
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(0);

export function formatProgress(p: Progress, width = 24): string {
  const speed = `${(p.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
  if (!p.total) return `${mb(p.received)} MB  ${speed}`;
  const ratio = Math.min(1, p.received / p.total);
  const filled = Math.round(ratio * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(ratio * 100).toFixed(0).padStart(3)}%  ${mb(p.received)}/${mb(p.total)} MB  ${speed}`;
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export async function downloadModel(
  spec: ModelSpec,
  onProgress?: (p: Progress) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const target = modelPath(spec);
  if (existsSync(target)) return target;
  mkdirSync(dirname(target), { recursive: true });

  const part = `${target}.part`;
  const offset = existsSync(part) ? statSync(part).size : 0;
  const res = await fetchImpl(spec.url, { headers: offset ? { Range: `bytes=${offset}-` } : {} });
  if (res.status === 404) throw new Error(`Model ${spec.id} is not published yet (${spec.url})`);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} for ${spec.url}`);

  const resumed = res.status === 206;
  const start = resumed ? offset : 0;
  const length = Number(res.headers.get('content-length')) || undefined;
  const total = spec.size ?? (length ? start + length : undefined);
  let received = start;
  const began = Date.now();

  const counter = async function* (source: AsyncIterable<Uint8Array>) {
    for await (const chunk of source) {
      received += chunk.length;
      const seconds = Math.max(0.001, (Date.now() - began) / 1000);
      onProgress?.({ received, total, bytesPerSecond: (received - start) / seconds });
      yield chunk;
    }
  };
  await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(part, { flags: resumed ? 'a' : 'w' }));

  if (spec.sha256) {
    const actual = await sha256File(part);
    if (actual !== spec.sha256) {
      unlinkSync(part);
      throw new Error(`Checksum mismatch for ${spec.file} (expected ${spec.sha256}, got ${actual}). The partial file was removed; run the command again.`);
    }
  }
  renameSync(part, target);
  return target;
}
