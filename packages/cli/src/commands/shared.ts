import type { Config } from '../config.js';
import { createProvider } from '../llm/index.js';
import { type PromptParts, SYSTEM_PROMPT, toPrompt } from '../prompts/index.js';
import { renderStream } from '../ui/render.js';

export interface OutputOptions {
  raw?: boolean;
  json?: boolean;
  system?: string;
}

export async function generate(config: Config, parts: PromptParts, opts: OutputOptions = {}): Promise<string> {
  const provider = await createProvider(config);
  await provider.prepare?.();
  const tokens = provider.generate(toPrompt(parts), {
    system: opts.system ?? SYSTEM_PROMPT,
    temperature: config.temperature,
    numCtx: config.contextSize,
  });
  if (opts.json) {
    let text = '';
    for await (const t of tokens) text += t;
    return text.trim();
  }
  return renderStream(tokens, { raw: opts.raw });
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

export const printJson = (value: unknown) => console.log(JSON.stringify(value, null, 2));
