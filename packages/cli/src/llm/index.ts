import type { Config } from '../config.js';
import { LocalProvider } from './local.js';
import { OllamaProvider } from './ollama.js';
import type { Provider } from './provider.js';

const ollamaFor = (config: Config) => new OllamaProvider(config.model, config.ollamaHost.replace(/\/+$/, ''));

export async function createProvider(config: Config): Promise<Provider> {
  if (config.provider === 'ollama') return ollamaFor(config);
  if (config.provider === 'local') return new LocalProvider(config.localModel);
  const ollama = ollamaFor(config);
  try {
    await ollama.check();
    return ollama;
  } catch {
    return new LocalProvider(config.localModel);
  }
}

export * from './provider.js';
