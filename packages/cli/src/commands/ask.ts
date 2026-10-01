import type { Config } from '../config.js';
import { generate } from './shared.js';

export async function askCommand(question: string, config: Config, opts: { raw?: boolean }): Promise<void> {
  await generate(config, { instruction: question, input: '' }, { raw: opts.raw });
}
