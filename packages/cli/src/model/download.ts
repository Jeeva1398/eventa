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

const HF_RE = /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/([^/]+)\/([^/]+)$/;

export async function hubChecksum(url: string, fetchImpl: typeof fetch = fetch): Promise<{ sha256?: string; size?: number }> {
  const m = HF_RE.exec(url);
  if (!m) return {};
  try {
    const res = await fetchImpl(`https://huggingface.co/api/models/${m[1]}/tree/${m[2]}`);
    if (!res.ok) return {};
    const files = (await res.json()) as { path: string; lfs?: { oid: string; size: number } }[];
    const lfs = files.find((f) => f.path === decodeURIComponent(m[3]))?.lfs;
    return lfs ? { sha256: lfs.oid, size: lfs.size } : {};
  } catch {
    return {};
  }
}

async function fetchInto(
  spec: ModelSpec,
  part: string,
  offset: number,
  onProgress: ((p: Progress) => void) | undefined,
  fetchImpl: typeof fetch,
): Promise<void> {
  let res = await fetchImpl(spec.url, { headers: offset ? { Range: `bytes=${offset}-` } : {} });
  if (res.status === 416 && offset) res = await fetchImpl(spec.url);
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
}

export async function downloadModel(
  model: ModelSpec,
  onProgress?: (p: Progress) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const target = modelPath(model);
  if (existsSync(target)) return target;
  const spec = model.sha256 ? model : { ...model, ...(await hubChecksum(model.url, fetchImpl)) };
  mkdirSync(dirname(target), { recursive: true });

  const part = `${target}.part`;
  let offset = existsSync(part) ? statSync(part).size : 0;
  if (spec.size && offset > spec.size) offset = 0;
  if (!spec.size || offset < spec.size) await fetchInto(spec, part, offset, onProgress, fetchImpl);

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
