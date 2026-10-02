import type { Hint, Severity } from '../context/heuristics.js';

export interface FileReview {
  file: string;
  hints: Hint[];
  analysis: string;
}

export interface Issue {
  severity: Severity;
  line?: number;
  text: string;
}

export const MARKER = '<!-- eventa-review -->';
const RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
const ICON: Record<Severity, string> = { high: '🔴', medium: '🟠', low: '⚪' };

export function parseIssues(analysis: string): Issue[] {
  const issues: Issue[] = [];
  for (const line of analysis.split(/\r?\n/)) {
    const m = /^\s*[-*]\s*\[(high|medium|low)\]\s*(?:line\s+(\d+)\s*:?)?\s*(.+)$/i.exec(line);
    if (m) issues.push({ severity: m[1].toLowerCase() as Severity, line: m[2] ? Number(m[2]) : undefined, text: m[3].trim() });
  }
  return issues;
}

export function worstSeverity(results: FileReview[]): Severity | undefined {
  let worst: Severity | undefined;
  for (const r of results) for (const i of parseIssues(r.analysis)) if (!worst || RANK[i.severity] > RANK[worst]) worst = i.severity;
  return worst;
}

export const meetsThreshold = (worst: Severity | undefined, failOn: string): boolean =>
  !!worst && failOn in RANK && RANK[worst] >= RANK[failOn as Severity];

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function toMarkdown(results: FileReview[], opts: { label: string; version: string }): string {
  const byFile = new Map<string, { issues: Issue[]; hints: Hint[] }>();
  for (const r of results) {
    const entry = byFile.get(r.file) ?? { issues: [], hints: [] };
    entry.issues.push(...parseIssues(r.analysis));
    entry.hints.push(...r.hints);
    byFile.set(r.file, entry);
  }
  const all = [...byFile.values()].flatMap((f) => f.issues);
  const count = (s: Severity) => all.filter((i) => i.severity === s).length;

  const out = [MARKER, '### Eventa review', ''];
  if (!all.length) {
    out.push(`No issues found in ${byFile.size} file(s) (${opts.label}).`);
  } else {
    out.push(`Found **${all.length}** issue(s) in ${byFile.size} file(s) (${opts.label}): ${count('high')} high, ${count('medium')} medium, ${count('low')} low.`, '');
    out.push('| | File | Line | Issue |', '|---|---|---|---|');
    for (const [file, { issues }] of byFile) {
      for (const i of [...issues].sort((a, b) => RANK[b.severity] - RANK[a.severity])) {
        out.push(`| ${ICON[i.severity]} ${i.severity} | \`${file}\` | ${i.line ?? ''} | ${cell(i.text)} |`);
      }
    }
  }

  const hinted = [...byFile].filter(([, f]) => f.hints.length);
  if (hinted.length) {
    out.push('', '<details><summary>Static checks</summary>', '');
    for (const [file, { hints }] of hinted) for (const h of hints) out.push(`- \`${file}\` line ${h.line}: [${h.severity}] ${h.message}`);
    out.push('', '</details>');
  }
  out.push('', `<sub>Reviewed offline by <a href="https://github.com/Jeeva1398/eventa">eventa</a> ${opts.version}. AI findings can be wrong, check before acting.</sub>`);
  return out.join('\n') + '\n';
}
