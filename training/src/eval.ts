import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { OllamaProvider } from '../../packages/cli/src/llm/ollama.js';
import { toPrompt } from '../../packages/cli/src/prompts/index.js';
import { scoreDeps, scoreExplain, scoreReview } from './score.js';
import type { Example } from './types.js';

const { values } = parseArgs({
  options: {
    models: { type: 'string', default: 'qwen2.5-coder:1.5b' },
    data: { type: 'string', default: join(import.meta.dirname, '..', 'data', 'eval.jsonl') },
    host: { type: 'string', default: process.env.OLLAMA_HOST ?? 'http://localhost:11434' },
    limit: { type: 'string' },
    'from-outputs': { type: 'boolean', default: false },
    report: { type: 'string', default: join(import.meta.dirname, '..', 'eval-report.md') },
  },
});

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => (Number.isNaN(x) ? '–' : `${(x * 100).toFixed(0)}%`);

interface Output {
  id: string;
  output: string;
  seconds?: number;
}

const outputsFile = (model: string) => join(import.meta.dirname, '..', 'outputs', `eval-${model.replace(/[^\w.-]+/g, '_')}.jsonl`);

async function generateAll(model: string, rows: Example[]): Promise<Output[]> {
  const provider = new OllamaProvider(model, values.host!);
  await provider.check();
  const outputs: Output[] = [];
  for (const [i, row] of rows.entries()) {
    const started = Date.now();
    let output = '';
    for await (const t of provider.generate(toPrompt(row), { system: row.system, temperature: 0, numCtx: 8192 })) output += t;
    outputs.push({ id: row.id, output, seconds: (Date.now() - started) / 1000 });
    process.stderr.write(`\r${model}: ${i + 1}/${rows.length}`);
  }
  process.stderr.write('\n');
  mkdirSync(dirname(outputsFile(model)), { recursive: true });
  writeFileSync(outputsFile(model), outputs.map((o) => JSON.stringify(o)).join('\n') + '\n');
  return outputs;
}

async function run(model: string, rows: Example[]) {
  const outputs = values['from-outputs']
    ? readFileSync(outputsFile(model), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Output)
    : await generateAll(model, rows);
  const byId = new Map(outputs.map((o) => [o.id, o]));
  const scores: Record<string, number[]> = {};
  const add = (prefix: string, s: Record<string, number>) => {
    for (const [k, v] of Object.entries(s)) (scores[`${prefix}.${k}`] ??= []).push(v);
  };
  for (const row of rows) {
    const output = byId.get(row.id)?.output ?? '';
    if (row.check.task === 'explain') add('explain', scoreExplain(output, row.check.keywords));
    if (row.check.task === 'review') add('review', scoreReview(output, row.check.issues));
    if (row.check.task === 'deps') add('deps', scoreDeps(output, row.input, row.check.commands, row.check.majors));
  }
  const timed = outputs.filter((o) => o.seconds !== undefined).map((o) => o.seconds!);
  return { model, seconds: mean(timed), scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, mean(v)])) };
}

const METRICS: [string, string][] = [
  ['explain.format', 'Explain: 3-section format'],
  ['explain.keywords', 'Explain: key facts mentioned'],
  ['review.recall', 'Review: real issues found'],
  ['review.precision', 'Review: precision'],
  ['review.severity', 'Review: correct severity'],
  ['review.clean', 'Review: clean diff → "No issues found."'],
  ['deps.commands', 'Deps: exact fix commands'],
  ['deps.majors', 'Deps: major upgrades covered'],
  ['deps.noInvented', 'Deps: no invented versions'],
];

async function main() {
  let rows = readFileSync(values.data!, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Example);
  if (values.limit) rows = rows.slice(0, Number(values.limit));
  const results: Awaited<ReturnType<typeof run>>[] = [];
  for (const model of values.models!.split(',')) results.push(await run(model.trim(), rows));

  const header = `| Metric | ${results.map((r) => `\`${r.model}\``).join(' | ')} |\n|---|${results.map(() => '---').join('|')}|`;
  const body = METRICS.map(([key, label]) => `| ${label} | ${results.map((r) => pct(r.scores[key] ?? NaN)).join(' | ')} |`).join('\n');
  const speed = `| Avg seconds / example (CPU) | ${results.map((r) => (Number.isNaN(r.seconds) ? '–' : r.seconds.toFixed(1))).join(' | ')} |`;
  const report = `# Eventa eval report\n\n${rows.length} held-out examples (${new Date().toISOString().slice(0, 10)}).\n\n${header}\n${body}\n${speed}\n`;
  writeFileSync(values.report!, report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
