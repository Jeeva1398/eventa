import { type DepsReport, fixPlan } from '../context/deps.js';
import type { PromptParts } from './index.js';

export function depsPrompt(r: DepsReport, nodeVersion: string): PromptParts {
  const lines: string[] = [`Node ${nodeVersion}`];
  if (r.vulnerabilities.length) {
    lines.push('Vulnerabilities:', ...r.vulnerabilities.slice(0, 20).map((v) => `- ${v.name} [${v.severity}] ${v.title ?? ''}`));
    lines.push('Fix commands (already computed and correct):', ...fixPlan(r.vulnerabilities).map((f) => `- ${f.command} → fixes ${f.fixes.join(', ')}`));
  }
  if (r.outdated.length) {
    lines.push('Outdated:', ...r.outdated.slice(0, 25).map((o) => `- ${o.name} ${o.current ?? 'not installed'} → latest ${o.latest}${o.major ? ' (MAJOR)' : ''}`));
  }
  if (r.unused.length) lines.push(`Possibly unused dependencies: ${r.unused.join(', ')}`);
  if (r.missing.length) lines.push(`Imported but not declared in package.json: ${r.missing.join(', ')}`);
  return {
    instruction:
      "You are given facts about a Node.js project's dependencies. Write a short, prioritized action plan:\n" +
      '1. Security: repeat each fix command exactly as given and say in one line why it matters. Never change versions.\n' +
      '2. Major upgrades (marked MAJOR only): for each, the main breaking-change risk you know of and what to check.\n' +
      '3. Cleanup: unused packages to remove and missing packages to add.\n' +
      'Do not repeat the raw lists. Do not invent versions or advisories. Skip any section with nothing to do.',
    input: lines.join('\n'),
  };
}
