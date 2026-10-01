import chalk from 'chalk';
import type { Config } from '../config.js';
import { createProvider, ProviderError } from '../llm/index.js';
import { LocalProvider } from '../llm/local.js';
import { OllamaProvider } from '../llm/ollama.js';

const ok = (msg: string) => console.log(`${chalk.green('✔')} ${msg}`);
const fail = (msg: string, hint?: string) => console.log(`${chalk.red('✖')} ${msg}${hint ? chalk.dim(`\n  ${hint}`) : ''}`);

async function probe(name: string, check: () => Promise<void>): Promise<boolean> {
  try {
    await check();
    ok(name);
    return true;
  } catch (err) {
    const e = err as ProviderError;
    fail(`${name}: ${e.message}`, e.hint);
    return false;
  }
}

export async function doctorCommand(config: Config): Promise<boolean> {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok(`Node.js ${process.versions.node}`);
  else fail(`Node.js ${process.versions.node}`, 'Eventa needs Node.js 20 or newer');

  const ollamaOk = await probe(`Ollama (${config.model})`, () => new OllamaProvider(config.model, config.ollamaHost).check());
  const localOk = await probe(`Built-in runtime (${config.localModel})`, () => new LocalProvider(config.localModel).check());

  const active = await createProvider(config);
  console.log(chalk.dim(`\nProvider setting: ${config.provider} → using ${active.name} (${active.model})`));
  if (!ollamaOk && !localOk) console.log(chalk.dim('Neither is ready yet. Eventa installs the built-in runtime and model on first use, or run `eventa model pull` now.'));
  return major >= 20 && (ollamaOk || localOk);
}
