import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configDir } from '../config.js';
import { exec } from '../context/exec.js';

export const LLAMA_VERSION = '3.22.1';

export interface LlamaModule {
  getLlama(opts?: { gpu?: false | 'auto'; build?: 'never' | 'auto'; logLevel?: string }): Promise<{
    loadModel(opts: { modelPath: string }): Promise<LlamaModel>;
  }>;
  LlamaChatSession: new (opts: { contextSequence: unknown; systemPrompt?: string }) => {
    prompt(text: string, opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal; onTextChunk?: (t: string) => void }): Promise<string>;
    dispose(): void;
  };
}

export interface LlamaModel {
  createContext(opts: { contextSize?: number }): Promise<{ getSequence(): unknown; dispose(): Promise<void> }>;
}

export const runtimeDir = () => join(configDir(), 'runtime');

export function platformPackage(platform = process.platform, arch = process.arch): string {
  const os = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : platform;
  const cpu = arch === 'arm' ? 'armv7l' : arch;
  if (os === 'mac' && cpu === 'arm64') return '@node-llama-cpp/mac-arm64-metal';
  const supported = ['win-x64', 'win-arm64', 'mac-x64', 'linux-x64', 'linux-arm64', 'linux-armv7l', 'linux-riscv64'];
  const id = `${os}-${cpu}`;
  if (!supported.includes(id)) throw new Error(`The built-in runtime has no prebuilt binary for ${platform}-${arch}. Use Ollama instead.`);
  return `@node-llama-cpp/${id}`;
}

const entryPath = () => join(runtimeDir(), 'node_modules', 'node-llama-cpp', 'package.json');

export const isRuntimeInstalled = () => existsSync(entryPath());

export async function installRuntime(log: (msg: string) => void = () => {}): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) < 20) {
    throw new Error('The built-in runtime needs Node.js 20 or newer. Upgrade Node, or use Ollama.');
  }
  if (!existsSync(join(LOCK_DIR, 'package-lock.json'))) {
    throw new Error('The built-in runtime is installed by the npm package. Use `npx @jeeva1398/eventa`, or run Ollama with this binary.');
  }
  const dir = runtimeDir();
  const platform = platformPackage();
  rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of ['package.json', 'package-lock.json']) copyFileSync(join(LOCK_DIR, f), join(dir, f));
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8')) as LockFile;
  const expected = lock.packages[`node_modules/${platform}`]?.integrity;
  if (!expected) throw new Error(`No pinned runtime binary for ${platform}.`);

  log(`Installing the local runtime (node-llama-cpp ${LLAMA_VERSION}, about 80 MB, one time)…`);
  const npm = (args: string[]) => exec('npm', [...args, '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
  const ci = await npm(['ci', '--omit=optional']);
  if (ci.code !== 0) throw new Error(`Runtime install failed:\n${ci.stderr.trim()}`);
  const bin = await npm(['install', '--no-save', '--omit=optional', `${platform}@${LLAMA_VERSION}`]);
  if (bin.code !== 0) throw new Error(`Runtime install failed:\n${bin.stderr.trim()}`);

  const installed = (JSON.parse(readFileSync(join(dir, 'node_modules', '.package-lock.json'), 'utf8')) as LockFile).packages[`node_modules/${platform}`]?.integrity;
  if (installed !== expected) {
    rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
    throw new Error(`Integrity check failed for ${platform}: expected ${expected}, got ${installed ?? 'nothing'}.`);
  }
}

interface LockFile {
  packages: Record<string, { integrity?: string }>;
}

// Shipped next to dist/ in the npm package: a pinned lockfile so the runtime install is reproducible.
const LOCK_DIR = fileURLToPath(new URL('../runtime/', import.meta.url));

let cached: Promise<LlamaModule> | undefined;

export function loadRuntime(): Promise<LlamaModule> {
  cached ??= (async () => {
    const entry = createRequire(join(runtimeDir(), 'package.json')).resolve('node-llama-cpp');
    return (await import(pathToFileURL(entry).href)) as LlamaModule;
  })();
  return cached;
}
