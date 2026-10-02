import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Config {
  provider: 'auto' | 'ollama' | 'local';
  model: string;
  localModel: string;
  ollamaHost: string;
  temperature: number;
  contextSize: number;
}

export const DEFAULTS: Config = {
  provider: 'auto',
  model: 'hf.co/jeeva1398/eventa-1.5b-gguf',
  localModel: 'eventa-1.5b',
  ollamaHost: 'http://localhost:11434',
  temperature: 0.2,
  contextSize: 8192,
};

export const CONFIG_KEYS = Object.keys(DEFAULTS) as (keyof Config)[];

export function configDir(): string {
  return process.env.EVENTA_HOME ?? join(homedir(), '.eventa');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

function readFile(): Partial<Config> {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<Config>;
  } catch {
    return {};
  }
}

function fromEnv(env: NodeJS.ProcessEnv): Partial<Config> {
  const out: Partial<Config> = {};
  if (env.EVENTA_MODEL) out.model = env.EVENTA_MODEL;
  if (env.EVENTA_LOCAL_MODEL) out.localModel = env.EVENTA_LOCAL_MODEL;
  if (env.EVENTA_PROVIDER) out.provider = env.EVENTA_PROVIDER as Config['provider'];
  if (env.EVENTA_TEMPERATURE && !Number.isNaN(Number(env.EVENTA_TEMPERATURE))) out.temperature = Number(env.EVENTA_TEMPERATURE);
  const host = env.EVENTA_OLLAMA_HOST ?? env.OLLAMA_HOST;
  if (host) out.ollamaHost = host.startsWith('http') ? host : `http://${host}`;
  return out;
}

export function loadConfig(overrides: Partial<Config> = {}, env = process.env): Config {
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
  return { ...DEFAULTS, ...readFile(), ...fromEnv(env), ...defined };
}

export function setConfigValue(key: keyof Config, raw: string): Config {
  const current = readFile();
  const value = typeof DEFAULTS[key] === 'number' ? Number(raw) : raw;
  if (typeof value === 'number' && Number.isNaN(value)) throw new Error(`${key} must be a number`);
  const next = { ...current, [key]: value };
  mkdirSync(dirname(configPath()), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(next, null, 2) + '\n');
  return { ...DEFAULTS, ...next };
}
