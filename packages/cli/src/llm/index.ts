import chalk from 'chalk';
import type { Config } from '../config.js';
import { LocalProvider } from './local.js';
import { OllamaProvider } from './ollama.js';
import type { Provider } from './provider.js';

const ollamaFor = (config: Config) => new OllamaProvider(config.model, config.ollamaHost.replace(/\/+$/, ''));

export function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '::1' || host === '0.0.0.0' || /^127\./.test(host);
  } catch {
    return false;
  }
}

let warned = false;

function useOllama(config: Config): Provider {
  if (!warned && !isLocalHost(config.ollamaHost)) {
    warned = true;
    process.stderr.write(
      chalk.yellow(`⚠ Sending code to Ollama at ${config.ollamaHost}, which is not this machine.`) +
        chalk.dim(' Set `eventa config set provider local` to keep everything on this machine.\n'),
    );
  }
  return ollamaFor(config);
}

export async function createProvider(config: Config): Promise<Provider> {
  if (config.provider === 'ollama') return useOllama(config);
  if (config.provider === 'local') return new LocalProvider(config.localModel);
  try {
    await ollamaFor(config).check();
    return useOllama(config);
  } catch {
    return new LocalProvider(config.localModel);
  }
}

export * from './provider.js';
