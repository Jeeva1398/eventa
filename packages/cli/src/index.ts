import chalk from 'chalk';
import { Command } from 'commander';
import { askCommand } from './commands/ask.js';
import { configGet, configSet, configWhere } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { loadConfig } from './config.js';
import { ProviderError } from './llm/index.js';

interface GlobalOpts {
  model?: string;
  host?: string;
  raw?: boolean;
}

const program = new Command();

program
  .name('eventa')
  .description('Offline AI assistant for Node.js developers')
  .version(__VERSION__)
  .option('-m, --model <name>', 'model to use (overrides config)')
  .option('--host <url>', 'Ollama host URL')
  .option('--raw', 'print plain output without terminal formatting');

const configFrom = (cmd: Command) => {
  const g = cmd.optsWithGlobals<GlobalOpts>();
  return { config: loadConfig({ model: g.model, ollamaHost: g.host }), raw: g.raw };
};

program
  .command('ask')
  .description('ask a Node.js question')
  .argument('<question...>', 'your question')
  .action(async (words: string[], _opts, cmd: Command) => {
    const { config, raw } = configFrom(cmd);
    await askCommand(words.join(' '), config, { raw });
  });

program
  .command('doctor')
  .description('check that Node.js, Ollama and the model are ready')
  .action(async (_opts, cmd: Command) => {
    const healthy = await doctorCommand(configFrom(cmd).config);
    if (!healthy) process.exitCode = 1;
  });

const config = program.command('config').description('view or change settings');
config.command('get').argument('[key]').description('print a setting or all settings').action(configGet);
config.command('set').argument('<key>').argument('<value>').description('change a setting').action(configSet);
config.command('path').description('print the config file location').action(configWhere);

program.parseAsync().catch((err: unknown) => {
  if (err instanceof ProviderError) {
    console.error(chalk.red(`✖ ${err.message}`));
    if (err.hint) console.error(chalk.dim(`  ${err.hint}`));
  } else {
    console.error(chalk.red(`✖ ${(err as Error).message}`));
  }
  process.exitCode = 1;
});
