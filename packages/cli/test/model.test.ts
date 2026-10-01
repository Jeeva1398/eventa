import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { downloadModel, formatProgress } from '../src/model/download.js';
import { MODELS, type ModelSpec, modelPath, modelsDir, resolveModel } from '../src/model/registry.js';
import { platformPackage } from '../src/model/runtime.js';

const payload = Buffer.from('GGUF-fake-model-bytes-0123456789');
const sha = createHash('sha256').update(payload).digest('hex');
const spec = (extra: Partial<ModelSpec> = {}): ModelSpec => ({ id: 't', description: '', url: 'https://x/t.gguf', file: 't.gguf', ...extra });

beforeEach(() => {
  process.env.EVENTA_HOME = mkdtempSync(join(tmpdir(), 'eventa-'));
});

describe('registry', () => {
  it('resolves built-in ids, URLs and rejects unknown names', () => {
    expect(resolveModel('qwen2.5-coder-1.5b')).toBe(MODELS['qwen2.5-coder-1.5b']);
    expect(resolveModel('https://hf.co/a/b/resolve/main/my-model.gguf')).toMatchObject({ id: 'my-model', file: 'my-model.gguf' });
    expect(() => resolveModel('qwen2.5-coder:1.5b')).toThrow(/Unknown model/);
  });

  it('accepts an existing local .gguf path', () => {
    const file = join(process.env.EVENTA_HOME!, 'mine.gguf');
    writeFileSync(file, 'x');
    expect(modelPath(resolveModel(file))).toBe(file);
  });
});

describe('platformPackage', () => {
  it('maps platforms to prebuilt binary packages', () => {
    expect(platformPackage('win32', 'x64')).toBe('@node-llama-cpp/win-x64');
    expect(platformPackage('darwin', 'arm64')).toBe('@node-llama-cpp/mac-arm64-metal');
    expect(platformPackage('linux', 'arm')).toBe('@node-llama-cpp/linux-armv7l');
    expect(() => platformPackage('aix', 'ppc64')).toThrow();
  });
});

describe('downloadModel', () => {
  it('downloads, verifies the checksum and reports progress', async () => {
    const seen: number[] = [];
    const fake = (async () => new Response(payload, { headers: { 'content-length': String(payload.length) } })) as typeof fetch;
    const path = await downloadModel(spec({ sha256: sha }), (p) => seen.push(p.received), fake);
    expect(readFileSync(path)).toEqual(payload);
    expect(seen[seen.length - 1]).toBe(payload.length);
  });

  it('resumes a partial download with a Range request', async () => {
    const s = spec({ sha256: sha, size: payload.length });
    const target = modelPath(s);
    mkdirSync(modelsDir(), { recursive: true });
    writeFileSync(`${target}.part`, payload.subarray(0, 10));
    let range = '';
    const fake = (async (_u: string, init?: RequestInit) => {
      range = (init?.headers as Record<string, string>).Range;
      return new Response(payload.subarray(10), { status: 206 });
    }) as typeof fetch;
    await downloadModel(s, undefined, fake);
    expect(range).toBe('bytes=10-');
    expect(readFileSync(target)).toEqual(payload);
  });

  it('deletes the file on checksum mismatch', async () => {
    const s = spec({ sha256: 'f'.repeat(64) });
    await expect(downloadModel(s, undefined, (async () => new Response(payload)) as typeof fetch)).rejects.toThrow(/Checksum mismatch/);
    expect(existsSync(modelPath(s))).toBe(false);
    expect(existsSync(`${modelPath(s)}.part`)).toBe(false);
  });

  it('explains when a model is not published yet', async () => {
    await expect(downloadModel(spec(), undefined, (async () => new Response('', { status: 404 })) as typeof fetch)).rejects.toThrow(/not published yet/);
  });

  it('formats a progress bar', () => {
    expect(formatProgress({ received: 50 * 1024 ** 2, total: 100 * 1024 ** 2, bytesPerSecond: 2 * 1024 ** 2 }, 10)).toBe('[█████░░░░░]  50%  50/100 MB  2.0 MB/s');
  });
});
