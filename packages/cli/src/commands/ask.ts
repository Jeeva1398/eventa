import type { Config } from '../config.js';
import { createProvider } from '../llm/index.js';
import { renderStream } from '../ui/render.js';

export const SYSTEM_PROMPT =
  'You are Eventa, an expert Node.js engineer. Answer concisely and accurately. ' +
  'Prefer modern Node.js (ESM, async/await, node: built-ins). Use markdown and fenced code blocks.';

export async function askCommand(question: string, config: Config, opts: { raw?: boolean }): Promise<void> {
  const provider = createProvider(config);
  const tokens = provider.generate(question, { system: SYSTEM_PROMPT, temperature: config.temperature });
  await renderStream(tokens, { raw: opts.raw });
}
