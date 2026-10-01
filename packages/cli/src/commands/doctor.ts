import chalk from 'chalk';
import type { Config } from '../config.js';
import { createProvider, ProviderError } from '../llm/index.js';

export async function doctorCommand(config: Config): Promise<boolean> {
  const major = Number(process.versions.node.split('.')[0]);
  const ok = (msg: string) => console.log(`${chalk.green('✔')} ${msg}`);
  const fail = (msg: string, hint?: string) => console.log(`${chalk.red('✖')} ${msg}${hint ? chalk.dim(`\n  ${hint}`) : ''}`);

  let healthy = true;
  if (major >= 18) ok(`Node.js ${process.versions.node}`);
  else {
    fail(`Node.js ${process.versions.node}`, 'Eventa needs Node.js 18 or newer');
    healthy = false;
  }

  const provider = createProvider(config);
  try {
    await provider.check();
    ok(`${provider.name} is running with model ${config.model}`);
  } catch (err) {
    const e = err as ProviderError;
    fail(e.message, e.hint);
    healthy = false;
  }
  return healthy;
}
