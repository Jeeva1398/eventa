import { type GenerateOptions, type Provider, ProviderError } from './provider.js';

interface ChunkLine {
  response?: string;
  done?: boolean;
  error?: string;
}

export async function* parseNdjson(body: AsyncIterable<Uint8Array>): AsyncGenerator<ChunkLine> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChunkLine;
    }
  }
  const rest = buffer.trim();
  if (rest) yield JSON.parse(rest) as ChunkLine;
}

export class OllamaProvider implements Provider {
  readonly name = 'ollama';

  constructor(
    readonly model: string,
    private readonly host: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private unreachable(): ProviderError {
    return new ProviderError(`Cannot reach Ollama at ${this.host}`, 'Start it with `ollama serve`, or install it from https://ollama.com');
  }

  async check(): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.host}/api/tags`);
    } catch {
      throw this.unreachable();
    }
    const { models = [] } = (await res.json()) as { models?: { name: string }[] };
    const wanted = this.model.includes(':') ? this.model : `${this.model}:latest`;
    if (!models.some((m) => m.name === wanted || m.name === this.model)) {
      throw new ProviderError(`Model "${this.model}" is not installed in Ollama`, `Run \`ollama pull ${this.model}\``);
    }
  }

  async *generate(prompt: string, opts: GenerateOptions = {}): AsyncGenerator<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: opts.system,
          stream: true,
          options: { temperature: opts.temperature },
        }),
        signal: opts.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      throw this.unreachable();
    }
    if (res.status === 404) {
      throw new ProviderError(`Model "${this.model}" is not installed in Ollama`, `Run \`ollama pull ${this.model}\``);
    }
    if (!res.ok || !res.body) throw new ProviderError(`Ollama returned HTTP ${res.status}: ${await res.text()}`);

    for await (const line of parseNdjson(res.body as unknown as AsyncIterable<Uint8Array>)) {
      if (line.error) throw new ProviderError(`Ollama error: ${line.error}`);
      if (line.response) yield line.response;
      if (line.done) return;
    }
  }
}
