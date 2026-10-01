import chalk from 'chalk';
import type { Config } from '../config.js';
import { parseDiff, splitPatch } from '../context/diff.js';
import { exec } from '../context/exec.js';
import { type Hint, scanAddedLines } from '../context/heuristics.js';
import { reviewPrompt } from '../prompts/review.js';
import { generate, printJson } from './shared.js';

export interface ReviewOptions {
  base?: string;
  maxFiles: string;
  json?: boolean;
  raw?: boolean;
}

const SEVERITY: Record<Hint['severity'], (s: string) => string> = { high: chalk.red, medium: chalk.yellow, low: chalk.dim };

const git = (args: string[], cwd: string) => exec('git', args, { cwd, shell: false });

async function getDiff(cwd: string, base?: string): Promise<{ diff: string; label: string }> {
  if ((await git(['rev-parse', '--is-inside-work-tree'], cwd)).code !== 0) throw new Error('Not inside a git repository.');
  const flags = ['diff', '--no-color', '--no-ext-diff', '-U3'];
  if (base) {
    const r = await git([...flags, `${base}...HEAD`], cwd);
    if (r.code !== 0) throw new Error(r.stderr.trim() || `git diff ${base}...HEAD failed`);
    return { diff: r.stdout, label: `changes since ${base}` };
  }
  const staged = await git([...flags, '--staged'], cwd);
  if (staged.stdout.trim()) return { diff: staged.stdout, label: 'staged changes' };
  return { diff: (await git(flags, cwd)).stdout, label: 'unstaged changes' };
}

export async function reviewCommand(config: Config, opts: ReviewOptions): Promise<void> {
  const cwd = process.cwd();
  const { diff, label } = await getDiff(cwd, opts.base);
  const files = parseDiff(diff).slice(0, Number(opts.maxFiles) || 20);
  if (!files.length) {
    if (opts.json) printJson([]);
    else console.log(chalk.yellow('Nothing to review: no changed source files found.'));
    return;
  }
  if (!opts.json) console.log(chalk.dim(`Reviewing ${label} in ${files.length} file(s)\n`));

  const maxChars = Math.min(12000, Math.floor((config.contextSize - 2000) * 3.5));
  const results: { file: string; hints: Hint[]; analysis: string }[] = [];

  for (const file of files) {
    const hints = scanAddedLines(file.added);
    const parts = splitPatch(file.patch, maxChars);
    for (const [i, part] of parts.entries()) {
      const partHints = hints.filter((h) => part.includes(`${String(h.line).padStart(4)} +`));
      if (!opts.json) {
        const suffix = parts.length > 1 ? chalk.dim(` (part ${i + 1}/${parts.length})`) : '';
        console.log(chalk.bold.cyan(`▸ ${file.path}`) + suffix);
        if (partHints.length) {
          console.log(chalk.bold('Static checks'));
          for (const h of partHints) console.log(`  ${SEVERITY[h.severity](`[${h.severity}]`)} line ${h.line}: ${h.message}`);
          console.log(chalk.bold('AI review'));
        }
      }
      const analysis = await generate(config, reviewPrompt(file.path, part, partHints), opts);
      results.push({ file: file.path, hints: partHints, analysis });
      if (!opts.json && /^no issues found\.?$/i.test(analysis.trim()) && partHints.some((h) => h.severity !== 'low')) {
        console.log(chalk.yellow('The AI did not confirm the static checks above. Verify them yourself.'));
      }
      if (!opts.json) console.log();
    }
  }
  if (opts.json) printJson(results);
}
