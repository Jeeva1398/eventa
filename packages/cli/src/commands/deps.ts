import chalk from 'chalk';
import ora from 'ora';
import type { Config } from '../config.js';
import { collectDeps, type DepsReport, fixPlan, readPackageJson } from '../context/deps.js';
import { buildPlan } from '../context/depsPlan.js';
import { depsPrompt } from '../prompts/deps.js';
import { renderStream } from '../ui/render.js';
import { generate, printJson } from './shared.js';

export interface DepsOptions {
  ai?: boolean;
  json?: boolean;
  raw?: boolean;
}

const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  critical: chalk.bgRed.white,
  high: chalk.red,
  moderate: chalk.yellow,
  low: chalk.blue,
  info: chalk.dim,
};

const isHealthy = (r: DepsReport) => !r.vulnerabilities.length && !r.outdated.length && !r.unused.length && !r.missing.length;

function printReport(r: DepsReport): void {
  if (r.auditError) console.log(chalk.yellow(`npm audit: ${r.auditError}`));
  if (r.vulnerabilities.length) {
    console.log(chalk.bold(`Vulnerabilities (${r.vulnerabilities.length})`));
    for (const v of r.vulnerabilities) {
      const color = SEVERITY_COLOR[v.severity] ?? chalk.white;
      console.log(`  ${color(v.severity.padEnd(8))} ${v.name.padEnd(20)} ${chalk.dim(v.title ?? '')}`);
    }
    console.log(chalk.bold('\nFix'));
    for (const f of fixPlan(r.vulnerabilities)) console.log(`  ${chalk.green(f.command)}  ${chalk.dim(`→ ${f.fixes.join(', ')}`)}`);
    console.log();
  }
  if (r.outdated.length) {
    console.log(chalk.bold(`Outdated (${r.outdated.length})`));
    for (const o of r.outdated) {
      const latest = o.major ? chalk.red(`${o.latest} major`) : chalk.green(o.latest);
      console.log(`  ${o.name.padEnd(28)} ${(o.current ?? 'missing').padEnd(10)} → ${latest}`);
    }
    console.log();
  }
  if (r.unused.length) console.log(`${chalk.bold('Possibly unused:')} ${r.unused.join(', ')}\n`);
  if (r.missing.length) console.log(`${chalk.bold('Imported but not in package.json:')} ${r.missing.join(', ')}\n`);
}

export async function depsCommand(config: Config, opts: DepsOptions): Promise<void> {
  const cwd = process.cwd();
  readPackageJson(cwd);
  const spinner = !opts.json && process.stderr.isTTY ? ora({ text: 'Running npm audit and npm outdated…', stream: process.stderr }).start() : null;
  const report = await collectDeps(cwd).finally(() => spinner?.stop());
  const wantAi = opts.ai && !isHealthy(report);

  const plan = isHealthy(report) ? '' : buildPlan(report);

  if (opts.json) {
    const analysis = wantAi ? await generate(config, depsPrompt(report, process.versions.node), { json: true }) : undefined;
    printJson({ ...report, plan, analysis });
    return;
  }
  printReport(report);
  if (isHealthy(report)) {
    console.log(chalk.green('✔ Dependencies look healthy.'));
    return;
  }
  console.log(chalk.bold.underline('Action plan'));
  await renderStream(lines(plan), { raw: opts.raw });
  if (wantAi) {
    console.log(chalk.bold.underline('\nAI notes'));
    await generate(config, depsPrompt(report, process.versions.node), opts);
  } else {
    console.log(chalk.dim('\nRun with --ai for extra AI commentary.'));
  }
}

async function* lines(text: string) {
  yield text;
}
