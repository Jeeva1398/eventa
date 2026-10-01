export interface GenerateOptions {
  system?: string;
  temperature?: number;
  numCtx?: number;
  signal?: AbortSignal;
}

export interface Provider {
  name: string;
  model: string;
  generate(prompt: string, opts?: GenerateOptions): AsyncIterable<string>;
  check(): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
