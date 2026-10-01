import type { Config } from '../config.js';
import { OllamaProvider } from './ollama.js';
import type { Provider } from './provider.js';

export function createProvider(config: Config): Provider {
  return new OllamaProvider(config.model, config.ollamaHost.replace(/\/+$/, ''));
}

export * from './provider.js';
