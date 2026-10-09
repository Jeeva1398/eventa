const ISSUE_RE = /^\s*-\s*\[(high|medium|low)\]\s*(?:line\s*)?(\d+)/gim;

export function scoreExplain(output: string, keywords: string[]) {
  const format = ['**Cause**', '**Fix**', '**Prevent**'].every((h) => output.includes(h)) && output.includes('```');
  const hits = keywords.filter((k) => output.toLowerCase().includes(k.toLowerCase())).length;
  return { format: format ? 1 : 0, keywords: keywords.length ? hits / keywords.length : 1 };
}

const issues = (text: string) => [...text.matchAll(ISSUE_RE)].map((m) => ({ severity: m[1].toLowerCase(), line: Number(m[2]) }));

export function scoreReview(output: string, expected: { line: number; severity: string }[], input = ''): Record<string, number> {
  const predicted = issues(output);
  const hints = issues(input.split('Static checks flagged:')[1] ?? '').filter((h) => h.severity !== 'low');
  const near = (a: { line: number }, b: { line: number }) => Math.abs(a.line - b.line) <= 1;
  if (!expected.length) {
    const clean = predicted.length === 0 && /no issues found/i.test(output);
    return { clean: clean ? 1 : 0, cleanWithChecks: clean && !hints.length ? 1 : 0, [hints.length ? 'falseHintRejected' : 'cleanNoHint']: clean ? 1 : 0 };
  }
  const matched = expected.filter((e) => predicted.some((p) => near(p, e)));
  const severity = matched.filter((e) => predicted.some((p) => near(p, e) && p.severity === e.severity));
  const recall = matched.length / expected.length;
  return {
    recall,
    [hints.length ? 'recallHinted' : 'recallNoHint']: recall,
    precision: predicted.length ? Math.min(1, matched.length / predicted.length) : 0,
    severity: matched.length ? severity.length / matched.length : 0,
    recallWithChecks: expected.filter((e) => [...predicted, ...hints].some((p) => near(p, e))).length / expected.length,
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
