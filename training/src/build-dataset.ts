import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixPlan } from '../../packages/cli/src/context/deps.js';
import { parseDiff } from '../../packages/cli/src/context/diff.js';
import { scanAddedLines } from '../../packages/cli/src/context/heuristics.js';
import { parseStack, snippetsFor, userFrames } from '../../packages/cli/src/context/stackParser.js';
import { truncateMiddle } from '../../packages/cli/src/context/tokens.js';
import { depsPrompt } from '../../packages/cli/src/prompts/deps.js';
import { explainPrompt } from '../../packages/cli/src/prompts/explain.js';
import { SYSTEM_PROMPT } from '../../packages/cli/src/prompts/index.js';
import { reviewPrompt } from '../../packages/cli/src/prompts/review.js';
import { type DepsCase, randomDepsCase, rng } from './scenarios/deps.js';
import { CRASHES } from './scenarios/explain.js';
import { MORE_CRASHES } from './scenarios/explain-more.js';
import { REVIEWS } from './scenarios/review.js';
import { MORE_REVIEWS } from './scenarios/review-more.js';
import { HIDDEN_BUGS } from './scenarios/review-hidden.js';
import type { CrashScenario, Example, ReviewScenario, Vars } from './types.js';

export const EVAL_SCENARIOS = new Set(['tdz', 'invalid-url', 'write-after-end', 'heap-oom-static', 'jwt-none-verify', 'foreach-async', 'clean-execfile', 'parseint-radix-and-nan', 'clean-validated-input', 'reduce-empty']);
const ROOTS = ['C:\\Users\\dev\\shop', 'D:\\work\\inventory', '/home/dev/api', '/Users/sam/projects/billing', '/app', '/srv/orders-service'];
const EXTRA_DEPS = ['express', 'pino', 'zod', 'dotenv', 'pg', 'mongoose', 'axios', 'fastify', 'ioredis'];
const NODE_VERSIONS = ['18.20.4', '20.18.1', '22.12.0'];

const rand = rng(1398);
const choice = <T>(items: T[]) => items[Math.floor(rand() * items.length)];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function expand<T>(scenario: T & { vars?: Vars }): T[] {
  const vars = scenario.vars ?? {};
  const count = Math.max(1, ...Object.values(vars).map((v) => v.length));
  const json = JSON.stringify(scenario);
  return Array.from({ length: count }, (_, i) => {
    let text = json;
    for (const [k, values] of Object.entries(vars)) text = text.replaceAll(`{{${k}}}`, JSON.stringify(values[i % values.length]).slice(1, -1));
    return JSON.parse(text) as T;
  });
}

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function relocate(text: string, realRoot: string, fakeRoot: string): string {
  const posix = fakeRoot.startsWith('/');
  const fakeUrl = posix ? `file://${fakeRoot}` : `file:///${fakeRoot.replace(/\\/g, '/')}`;
  let out = text
    .replaceAll(pathToFileURL(realRoot).href, fakeUrl)
    .replaceAll(realRoot, fakeRoot)
    .replaceAll(realRoot.replace(/\\/g, '/'), fakeRoot);
  const pathRe = new RegExp(`${escapeRe(fakeRoot)}[\\\\/\\w.@-]*`, 'g');
  out = out.replace(pathRe, (m) => (posix ? m.replace(/\\/g, '/') : m.replace(/\//g, '\\')));
  return out;
}

const cleanup = (dir: string) => {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.warn(`could not remove ${dir}`);
  }
};

const fence = (code: string) => (/^(npm|npx) /.test(code) ? 'bash' : code.startsWith('// package.json') ? 'jsonc' : 'js');

function explainExample(s: CrashScenario, variant: number): Example | null {
  const dir = mkdtempSync(join(tmpdir(), 'eventa-crash-'));
  try {
    writeFiles(dir, s.files);
    let errorText: string;
    if (s.stderr) {
      errorText = s.stderr.replaceAll('{{root}}', dir);
    } else {
      const r = spawnSync(s.run!, { cwd: dir, shell: true, encoding: 'utf8', timeout: 10000 });
      errorText = `${r.stderr ?? ''}${r.stdout ? `\n${r.stdout}` : ''}`.trim();
      if (r.error) console.warn(`${s.id}#${variant}: ${r.error.message}`);
      if (r.status === 0 || !parseStack(errorText).message) {
        console.warn(`skip ${s.id}#${variant}: command did not fail as expected`);
        return null;
      }
    }
    const parsed = parseStack(errorText);
    const snippets = snippetsFor(userFrames(parsed, dir), 12, dir);
    const fakeRoot = choice(ROOTS);
    const posix = fakeRoot.startsWith('/');
    const pkg = s.files['package.json'] ? (JSON.parse(s.files['package.json']) as { type?: string }) : {};
    const missingPkg = s.id === 'package-not-installed' ? errorText.match(/package '([^']+)'/)?.[1] : undefined;
    const deps = EXTRA_DEPS.filter((d) => d !== missingPkg && rand() < 0.35);
    const parts = explainPrompt({
      errorText: truncateMiddle(relocate(errorText, dir, fakeRoot), 2500),
      code: parsed.code,
      snippets: snippets.map((sn) => (posix ? sn.replace(/^\/\/ (\S+)/, (_m, p: string) => `// ${p.replace(/\\/g, '/')}`) : sn)),
      project: { nodeVersion: errorText.match(/Node\.js v([\d.]+)/)?.[1] ?? process.versions.node, moduleType: pkg.type === 'module' ? 'ESM' : 'CommonJS', dependencies: deps },
    });
    const output = `**Cause**: ${s.cause}\n\n**Fix**:\n\`\`\`${fence(s.fix)}\n${s.fix}\n\`\`\`\n${s.why}\n\n**Prevent**: ${s.prevent}`;
    return { id: `explain/${s.id}/${variant}`, scenario: s.id, task: 'explain', system: SYSTEM_PROMPT, ...parts, output, check: { task: 'explain', keywords: s.keywords } };
  } finally {
    cleanup(dir);
  }
}

function reviewExample(s: ReviewScenario, variant: number): Example {
  const dir = mkdtempSync(join(tmpdir(), 'eventa-review-'));
  try {
    writeFiles(dir, { [`a/${s.path}`]: s.before, [`b/${s.path}`]: s.after });
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', '-U3', `a/${s.path}`, `b/${s.path}`], { cwd: dir, encoding: 'utf8' });
    const file = parseDiff(r.stdout)[0];
    if (!file) throw new Error(`${s.id}: empty diff`);
    const afterLines = s.after.split('\n');
    const issues = s.issues.map((issue) => {
      const line = afterLines.findIndex((l) => l.includes(issue.match)) + 1;
      if (!file.added.some((a) => a.line === line)) throw new Error(`${s.id}: "${issue.match}" is not on an added line`);
      return { ...issue, line };
    });
    const parts = reviewPrompt(s.path, file.patch, scanAddedLines(file.added));
    const output = issues.length ? issues.map((i) => `- [${i.severity}] line ${i.line}: ${i.problem} → ${i.fix}`).join('\n') : 'No issues found.';
    return { id: `review/${s.id}/${variant}`, scenario: s.id, task: 'review', system: SYSTEM_PROMPT, ...parts, output, check: { task: 'review', issues: issues.map((i) => ({ line: i.line, severity: i.severity })) } };
  } finally {
    cleanup(dir);
  }
}

function depsOutput({ report, vulns, majors }: DepsCase): string {
  const sections: string[] = [];
  if (vulns.length) {
    const why = new Map(vulns.map((v) => [v.name, `${v.why} (${v.severity})`]));
    const items = fixPlan(report.vulnerabilities).map((f) =>
      f.command === 'no fix available'
        ? f.fixes.map((n) => `- No fix available for **${n}**: ${why.get(n)}.`).join('\n')
        : `- \`${f.command.replace(' (major)', '')}\`${f.command.endsWith('(major)') ? ' (major version)' : ''} fixes ${f.fixes.join(', ')}: ${f.fixes.map((n) => why.get(n)).join('; ')}.`,
    );
    sections.push(`**1. Security**\n${items.join('\n')}`);
  }
  if (majors.length) sections.push(`**2. Major upgrades**\n${majors.map((m) => `- **${m.name} ${m.current} → ${m.latest}**: ${m.risk}`).join('\n')}`);
  const cleanup: string[] = [];
  if (report.unused.length) cleanup.push(`- \`npm uninstall ${report.unused.join(' ')}\`: not imported anywhere (double-check config files and dynamic requires first).`);
  if (report.missing.length) cleanup.push(`- \`npm install ${report.missing.join(' ')}\`: imported in code but missing from package.json.`);
  const minors = report.outdated.filter((o) => !o.major);
  if (minors.length) cleanup.push(`- \`npm update\` picks up the safe minor/patch releases of ${minors.map((m) => m.name).join(', ')}.`);
  if (cleanup.length) sections.push(`**3. Cleanup**\n${cleanup.join('\n')}`);
  return sections.join('\n\n');
}

function depsExample(index: number, split: string): Example | null {
  const c = randomDepsCase(rand);
  const { report } = c;
  if (!report.vulnerabilities.length && !report.outdated.length && !report.unused.length && !report.missing.length) return null;
  const parts = depsPrompt(report, choice(NODE_VERSIONS));
  const commands = fixPlan(report.vulnerabilities).filter((f) => f.command !== 'no fix available').map((f) => f.command.replace(' (major)', ''));
  return { id: `deps/${split}/${index}`, scenario: `deps-${split}`, task: 'deps', system: SYSTEM_PROMPT, ...parts, output: depsOutput(c), check: { task: 'deps', commands, majors: c.majors.map((m) => m.name) } };
}

function main() {
  const repeats = Number(process.env.REPEATS ?? 2);
  const train: Example[] = [];
  const evals: Example[] = [];
  const add = (e: Example | null) => e && (EVAL_SCENARIOS.has(e.scenario) || e.scenario === 'deps-eval' ? evals : train).push(e);

  for (const scenario of [...CRASHES, ...MORE_CRASHES]) {
    expand(scenario).forEach((s, i) => {
      for (let r = 0; r < (EVAL_SCENARIOS.has(s.id) ? 1 : repeats); r++) add(explainExample(s, i * repeats + r));
    });
  }
  for (const scenario of [...REVIEWS, ...MORE_REVIEWS, ...HIDDEN_BUGS]) expand(scenario).forEach((s, i) => add(reviewExample(s, i)));
  for (let i = 0; i < Number(process.env.DEPS_TRAIN ?? 150); i++) add(depsExample(i, 'train'));
  for (let i = 0; i < Number(process.env.DEPS_EVAL ?? 15); i++) add(depsExample(i, 'eval'));

  const outDir = join(import.meta.dirname, '..', 'data');
  mkdirSync(outDir, { recursive: true });
  const toJsonl = (rows: Example[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(outDir, 'train.jsonl'), toJsonl(train.sort(() => rand() - 0.5)));
  writeFileSync(join(outDir, 'eval.jsonl'), toJsonl(evals));

  const count = (rows: Example[], task: string) => rows.filter((r) => r.task === task).length;
  for (const [name, rows] of [['train', train], ['eval', evals]] as const) {
    console.log(`${name}: ${rows.length} examples (explain ${count(rows, 'explain')}, review ${count(rows, 'review')}, deps ${count(rows, 'deps')})`);
  }
}

main();
