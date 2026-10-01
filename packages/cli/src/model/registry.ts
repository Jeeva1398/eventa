import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { configDir } from '../config.js';

export interface ModelSpec {
  id: string;
  description: string;
  url: string;
  file: string;
  sha256?: string;
  size?: number;
}

export const MODELS: Record<string, ModelSpec> = {
  'qwen2.5-coder-1.5b': {
    id: 'qwen2.5-coder-1.5b',
    description: 'Qwen2.5-Coder 1.5B Instruct, Q4_K_M (stock base model)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    sha256: 'cc324af070c2ecbfd324a30884d2f951a7ff756aba85cb811a6ec436933bb046',
    size: 1117320768,
  },
  'eventa-1.5b': {
    id: 'eventa-1.5b',
    description: 'Eventa 1.5B, fine-tuned for Node.js, Q4_K_M',
    url: 'https://huggingface.co/jeeva1398/eventa-1.5b-gguf/resolve/b6168198ed557fc78d375699bef27369b80e0b88/eventa-1.5b-q4_k_m.gguf',
    file: 'eventa-1.5b-q4_k_m-e179b0a3.gguf',
    sha256: 'e179b0a33732b63ee7d615d32ce150c100242448cbb3808a468d43f2adf42dfb',
    size: 986048192,
  },
};

export const modelsDir = () => join(configDir(), 'models');

export function resolveModel(idOrPath: string): ModelSpec {
  if (MODELS[idOrPath]) return MODELS[idOrPath];
  if (/^https?:\/\/.+\.gguf$/.test(idOrPath)) {
    const file = basename(new URL(idOrPath).pathname);
    return { id: file.replace(/\.gguf$/, ''), description: 'custom URL', url: idOrPath, file };
  }
  if (idOrPath.endsWith('.gguf') && existsSync(idOrPath)) {
    return { id: basename(idOrPath, '.gguf'), description: 'local file', url: '', file: resolve(idOrPath) };
  }
  throw new Error(`Unknown model "${idOrPath}". Known models: ${Object.keys(MODELS).join(', ')}, or pass a .gguf path or URL.`);
}

export const modelPath = (spec: ModelSpec) => (spec.url ? join(modelsDir(), spec.file) : spec.file);

export const isDownloaded = (spec: ModelSpec) => existsSync(modelPath(spec));
