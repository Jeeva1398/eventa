import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  const dir = runtimeDir();
  mkdirSync(dir, { recursive: true });
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) writeFileSync(manifest, JSON.stringify({ name: 'eventa-runtime', private: true }, null, 2));
  log(`Installing the local runtime (node-llama-cpp ${LLAMA_VERSION}, about 80 MB, one time)…`);
  const r = await exec('npm', ['install', `node-llama-cpp@${LLAMA_VERSION}`, `${platformPackage()}@${LLAMA_VERSION}`, '--omit=optional', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
  if (r.code !== 0) throw new Error(`Runtime install failed:\n${r.stderr.trim()}`);
}

let cached: Promise<LlamaModule> | undefined;

export function loadRuntime(): Promise<LlamaModule> {
  cached ??= (async () => {
    const entry = createRequire(join(runtimeDir(), 'package.json')).resolve('node-llama-cpp');
    return (await import(pathToFileURL(entry).href)) as LlamaModule;
  })();
  return cached;
}
