const ISSUE_RE = /^\s*-\s*\[(high|medium|low)\]\s*(?:line\s*)?(\d+)/gim;

export function scoreExplain(output: string, keywords: string[]) {
  const format = ['**Cause**', '**Fix**', '**Prevent**'].every((h) => output.includes(h)) && output.includes('```');
  const hits = keywords.filter((k) => output.toLowerCase().includes(k.toLowerCase())).length;
  return { format: format ? 1 : 0, keywords: keywords.length ? hits / keywords.length : 1 };
}

export function scoreReview(output: string, expected: { line: number; severity: string }[]): Record<string, number> {
  const predicted = [...output.matchAll(ISSUE_RE)].map((m) => ({ severity: m[1].toLowerCase(), line: Number(m[2]) }));
  if (!expected.length) return { clean: predicted.length === 0 && /no issues found/i.test(output) ? 1 : 0 };
  const matched = expected.filter((e) => predicted.some((p) => Math.abs(p.line - e.line) <= 1));
  const severity = matched.filter((e) => predicted.some((p) => Math.abs(p.line - e.line) <= 1 && p.severity === e.severity));
  return {
    recall: matched.length / expected.length,
    precision: predicted.length ? Math.min(1, matched.length / predicted.length) : 0,
    severity: matched.length ? severity.length / matched.length : 0,
  };
}

export function scoreDeps(output: string, input: string, commands: string[], majors: string[]) {
  const versions = output.match(/\b\d+\.\d+\.\d+\b/g) ?? [];
  const invented = versions.filter((v) => !input.includes(v)).length;
  return {
    commands: commands.length ? commands.filter((c) => output.includes(c)).length / commands.length : 1,
    majors: majors.length ? majors.filter((m) => output.includes(m)).length / majors.length : 1,
    noInvented: invented === 0 ? 1 : 0,
  };
}
