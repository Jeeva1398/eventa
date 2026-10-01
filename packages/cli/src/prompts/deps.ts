import { type DepsReport, fixPlan } from '../context/deps.js';
import type { PromptParts } from './index.js';
import { upgradeNote } from './upgrades.js';

export function depsPrompt(r: DepsReport, nodeVersion: string): PromptParts {
  const lines: string[] = [`Node ${nodeVersion}`];
  if (r.vulnerabilities.length) {
    const title = new Map(r.vulnerabilities.map((v) => [v.name, v.title]));
    lines.push('Vulnerabilities:', ...r.vulnerabilities.slice(0, 20).map((v) => `- ${v.name} [${v.severity}] ${v.title ?? ''}`));
    lines.push(
      'Fix commands (already computed and correct):',
      ...fixPlan(r.vulnerabilities).map((f) => `- ${f.command} → fixes ${f.fixes.map((n) => (title.get(n) ? `${n} (${title.get(n)})` : n)).join(', ')}`),
    );
  }
  if (r.outdated.length) {
    lines.push('Outdated:', ...r.outdated.slice(0, 25).map((o) => `- ${o.name} ${o.current ?? 'not installed'} → latest ${o.latest}${o.major ? ' (MAJOR)' : ''}`));
    const notes = r.outdated.filter((o) => o.major).map((o) => [o, upgradeNote(o.name, o.latest)] as const);
    const known = notes.filter(([, n]) => n);
    if (known.length) lines.push('Verified upgrade notes:', ...known.map(([o, n]) => `- ${o.name} → ${o.latest}: ${n}`));
    const unknown = notes.filter(([, n]) => !n).map(([o]) => o.name);
    if (unknown.length) lines.push(`No verified notes for: ${unknown.join(', ')}`);
  }
  if (r.unused.length) lines.push(`Possibly unused dependencies: ${r.unused.join(', ')}`);
  if (r.missing.length) lines.push(`Imported but not declared in package.json: ${r.missing.join(', ')}`);
  return {
    instruction:
      "You are given facts about a Node.js project's dependencies. Write a short, prioritized action plan:\n" +
      '1. Security: repeat each fix command exactly as given and say in one line why it matters, based only on the advisory titles. Never change versions.\n' +
      '2. Major upgrades (marked MAJOR only): restate the verified upgrade note for each. For packages with no verified notes, say to read their changelog before upgrading; do not guess API changes.\n' +
      '3. Cleanup: unused packages to remove and missing packages to add.\n' +
      'Do not repeat the raw lists. Do not invent versions, advisories or APIs. Skip any section with nothing to do.',
    input: lines.join('\n'),
  };
}
