import chalk from 'chalk';
import { Command } from 'commander';
import { askCommand } from './commands/ask.js';
import { configGet, configSet, configWhere } from './commands/config.js';
import { depsCommand, type DepsOptions } from './commands/deps.js';
import { doctorCommand } from './commands/doctor.js';
import { modelList, modelPull, modelRemove, modelUse } from './commands/model.js';
import { explainCommand, type ExplainOptions } from './commands/explain.js';
import { reviewCommand, type ReviewOptions } from './commands/review.js';
import { type Config, loadConfig } from './config.js';
import { ProviderError } from './llm/index.js';

interface GlobalOpts {
  model?: string;
  host?: string;
  provider?: Config['provider'];
  raw?: boolean;
}

const program = new Command();

program
  .name('eventa')
  .description('Offline AI assistant for Node.js developers')
  .version(__VERSION__)
  .option('-m, --model <name>', 'model to use (overrides config)')
  .option('--host <url>', 'Ollama host URL')
  .option('-p, --provider <name>', 'auto | ollama | local')
  .option('--raw', 'print plain output without terminal formatting');

const configFrom = (cmd: Command) => {
  const g = cmd.optsWithGlobals<GlobalOpts>();
  if (g.provider && !['auto', 'ollama', 'local'].includes(g.provider)) throw new Error('--provider must be auto, ollama or local');
  return { config: loadConfig({ model: g.model, localModel: g.model, ollamaHost: g.host, provider: g.provider }), raw: g.raw };
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
  .command('explain')
  .description('explain a Node.js error or stack trace and suggest a fix')
  .argument('[error...]', 'error text (or pipe it via stdin)')
  .option('-f, --file <path>', 'read the error from a log file')
  .option('-r, --run <command>', 'run a command and explain its failure')
  .option('--json', 'print JSON output')
  .addHelpText('after', '\nExamples:\n  node app.js 2>&1 | eventa explain\n  eventa explain --run "npm test"\n  eventa explain --file crash.log')
  .action(async (words: string[], opts: ExplainOptions, cmd: Command) => {
    const { config, raw } = configFrom(cmd);
    await explainCommand(words, config, { ...opts, raw });
  });

program
  .command('review')
  .description('review your staged git diff (falls back to unstaged changes)')
  .option('-b, --base <ref>', 'review all changes since a branch or commit, e.g. main')
  .option('--max-files <n>', 'maximum files to review', '20')
  .option('--json', 'print JSON output')
  .option('--markdown', 'print a Markdown report (for PR comments)')
  .option('--fail-on <severity>', 'exit with code 1 if the AI reports an issue at this severity or above: high | medium | low | none')
  .action(async (opts: ReviewOptions, cmd: Command) => {
    const { config, raw } = configFrom(cmd);
    await reviewCommand(config, { ...opts, raw });
  });

program
  .command('deps')
  .description('audit dependencies: vulnerabilities, outdated, unused and missing packages')
  .option('--ai', 'also ask the model for extra commentary (the action plan itself is always deterministic)')
  .option('--json', 'print JSON output')
  .action(async (opts: DepsOptions, cmd: Command) => {
    const { config, raw } = configFrom(cmd);
    await depsCommand(config, { ...opts, raw });
  });

program
  .command('doctor')
  .description('check that Node.js, Ollama and the model are ready')
  .action(async (_opts, cmd: Command) => {
    const healthy = await doctorCommand(configFrom(cmd).config);
    if (!healthy) process.exitCode = 1;
  });

const model = program.command('model').description('manage the built-in local model');
model.command('list').description('show built-in models and what is downloaded').action(modelList);
model.command('pull').argument('[id]', 'model id, .gguf URL or path (default: configured localModel)').description('install the runtime and download a model').action(modelPull);
model.command('use').argument('<id>').description('set the default local model').action(modelUse);
model.command('rm').argument('<id>').description('delete a downloaded model').action(modelRemove);

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
