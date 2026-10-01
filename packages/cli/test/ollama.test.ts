import { describe, expect, it } from 'vitest';
import { OllamaProvider, parseNdjson } from '../src/llm/ollama.js';
import { ProviderError } from '../src/llm/provider.js';

const enc = new TextEncoder();

async function* chunks(...parts: string[]) {
  for (const p of parts) yield enc.encode(p);
}

function streamResponse(lines: object[], status = 200): Response {
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  return new Response(body, { status });
}

describe('parseNdjson', () => {
  it('handles lines split across chunks', async () => {
    const out = [];
    for await (const line of parseNdjson(chunks('{"response":"he', 'llo"}\n{"resp', 'onse":"!","done":true}'))) out.push(line);
    expect(out).toEqual([{ response: 'hello' }, { response: '!', done: true }]);
  });
});

describe('OllamaProvider', () => {
  it('streams response tokens until done', async () => {
    const fake = (async () => streamResponse([{ response: 'a' }, { response: 'b' }, { done: true }, { response: 'ignored' }])) as typeof fetch;
    const p = new OllamaProvider('m', 'http://x', fake);
    const tokens: string[] = [];
    for await (const t of p.generate('hi')) tokens.push(t);
    expect(tokens).toEqual(['a', 'b']);
  });

  it('sends model, prompt and system', async () => {
    let sent: Record<string, unknown> = {};
    const fake = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return streamResponse([{ done: true }]);
    }) as typeof fetch;
    for await (const _ of new OllamaProvider('qwen', 'http://x', fake).generate('q', { system: 's', temperature: 0.1 }));
    expect(sent).toMatchObject({ model: 'qwen', prompt: 'q', system: 's', stream: true, options: { temperature: 0.1 } });
  });

  it('gives a pull hint when the model is missing', async () => {
    const fake = (async () => new Response('not found', { status: 404 })) as typeof fetch;
    const gen = new OllamaProvider('nope', 'http://x', fake).generate('q');
    await expect(gen.next()).rejects.toMatchObject({ hint: 'Run `ollama pull nope`' });
  });

  it('reports an unreachable server', async () => {
    const fake = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(new OllamaProvider('m', 'http://x', fake).check()).rejects.toBeInstanceOf(ProviderError);
  });

  it('check accepts an untagged model name as :latest', async () => {
    const fake = (async () => Response.json({ models: [{ name: 'eventa:latest' }] })) as typeof fetch;
    await expect(new OllamaProvider('eventa', 'http://x', fake).check()).resolves.toBeUndefined();
  });
});
