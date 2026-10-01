import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import chalk from 'chalk';
import type { Config } from '../config.js';
import { readPackageJson } from '../context/deps.js';
import { runShell } from '../context/exec.js';
import { parseStack, snippetsFor, userFrames } from '../context/stackParser.js';
import { estimateTokens, truncateMiddle } from '../context/tokens.js';
import { explainPrompt, type ExplainContext } from '../prompts/explain.js';
import { generate, printJson, readStdin } from './shared.js';

export interface ExplainOptions {
  file?: string;
  run?: string;
  json?: boolean;
  raw?: boolean;
}

function projectInfo(cwd: string): ExplainContext['project'] {
  try {
    const pkg = readPackageJson(cwd);
    return {
      nodeVersion: process.versions.node,
      moduleType: pkg.type === 'module' ? 'ESM' : 'CommonJS',
      dependencies: Object.keys(pkg.dependencies ?? {}),
    };
  } catch {
    return undefined;
  }
}

async function collectErrorText(words: string[], opts: ExplainOptions, cwd: string): Promise<string | null> {
  if (opts.run) {
    const r = await runShell(opts.run, cwd);
    const output = `${r.stderr}\n${r.stdout}`.trim();
    if (r.code === 0 && !parseStack(output).message) return null;
    return output;
  }
  if (opts.file) return readFileSync(opts.file, 'utf8');
  if (words.length) return words.join(' ');
  return readStdin();
}

export async function explainCommand(words: string[], config: Config, opts: ExplainOptions): Promise<void> {
  const cwd = process.cwd();
  const errorText = await collectErrorText(words, opts, cwd);
  if (errorText === null) {
    console.log(chalk.green('✔ Command exited cleanly, nothing to explain.'));
    return;
  }
  if (!errorText.trim()) {
    throw new Error('No error to explain. Pipe it in (node app.js 2>&1 | eventa explain), pass --file crash.log, or use --run "node app.js".');
  }

  const parsed = parseStack(errorText);
  const frames = userFrames(parsed, cwd);
  const budget = config.contextSize - 1500;
  const snippets = snippetsFor(frames, 12, cwd);
  while (snippets.length > 1 && estimateTokens(snippets.join('\n')) > budget * 0.5) snippets.pop();

  const parts = explainPrompt({
    errorText: truncateMiddle(errorText, Math.floor(budget * 0.35)),
    code: parsed.code,
    snippets,
    project: projectInfo(cwd),
  });

  const where = frames.map((f) => `${relative(cwd, f.file)}:${f.line}`);
  if (!opts.json) {
    console.log(chalk.bold.red(parsed.message ?? errorText.trim().split('\n')[0]));
    if (where.length) console.log(chalk.dim(`Looking at ${where.join(', ')}`));
    console.log();
  }
  const analysis = await generate(config, parts, opts);
  if (opts.json) printJson({ message: parsed.message, code: parsed.code, frames: where, analysis });
}
