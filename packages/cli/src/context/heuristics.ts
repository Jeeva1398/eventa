export type Severity = 'high' | 'medium' | 'low';

export interface Hint {
  line: number;
  rule: string;
  severity: Severity;
  message: string;
}

interface Rule {
  rule: string;
  severity: Severity;
  re: RegExp;
  message: string;
}

const RULES: Rule[] = [
  { rule: 'eval', severity: 'high', re: /\b(eval|new Function)\s*\(/, message: 'dynamic code execution (eval / new Function)' },
  { rule: 'shell-injection', severity: 'high', re: /\bexec(Sync)?\s*\(\s*`[^`]*\$\{/, message: 'child_process exec with an interpolated string, possible command injection' },
  { rule: 'sql-injection', severity: 'high', re: /\b(query|execute|raw)\s*\(\s*`\s*(SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{/i, message: 'SQL built with template interpolation, use parameters' },
  { rule: 'sync-fs', severity: 'medium', re: /\b(readFileSync|writeFileSync|readdirSync|existsSync|statSync)\s*\(/, message: 'synchronous fs call, blocks the event loop if used in a request path' },
  { rule: 'secret', severity: 'high', re: /\b(api[_-]?key|secret|password|token)\b\s*[:=]\s*['"][^'"]{8,}['"]/i, message: 'possible hard-coded secret' },
  { rule: 'promise-no-await', severity: 'high', re: /^\s*(?!return\b|await\b|const\b|let\b|var\b)[\w.]+\.(save|create|update\w*|delete\w*|insert\w*|send|fetch|query|find\w+|remove\w*)\s*\([^)]*\)\s*;?\s*$/, message: 'async-looking call without await or return, result and errors are dropped' },
  { rule: 'empty-catch', severity: 'medium', re: /catch\s*(\(\w*\))?\s*\{\s*\}/, message: 'empty catch swallows errors' },
  { rule: 'then-no-catch', severity: 'medium', re: /\.then\([^)]*\)\s*;\s*$/, message: '.then() without .catch(), possible unhandled rejection' },
  { rule: 'console-log', severity: 'low', re: /\bconsole\.log\(/, message: 'leftover console.log' },
  { rule: 'tls-off', severity: 'high', re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, message: 'TLS certificate verification disabled' },
  { rule: 'foreach-async', severity: 'high', re: /\.forEach\(\s*async\b/, message: 'forEach does not await async callbacks; the caller continues before they finish' },
  { rule: 'jwt-decode', severity: 'high', re: /\bjwt\.decode\(/, message: 'jwt.decode does not verify the signature' },
  { rule: 'prisma-raw-unsafe', severity: 'high', re: /\$(queryRawUnsafe|executeRawUnsafe)\(\s*`[^`]*\$\{/, message: 'Prisma raw "Unsafe" query with interpolation, possible SQL injection' },
  { rule: 'open-redirect', severity: 'high', re: /\bredirect\(\s*req\.(query|body|params)\b/, message: 'redirect target comes from user input (open redirect)' },
  { rule: 'assign-in-if', severity: 'high', re: /\bif\s*\(\s*[\w.$[\]'"]+\s*=(?![=>])/, message: 'assignment inside an if condition, probably meant === ' },
  { rule: 'insecure-random', severity: 'medium', re: /Math\.random\(\)\.toString\(\d+\)/, message: 'Math.random() is not cryptographically secure; do not use it for tokens or IDs' },
  { rule: 'parseint-unchecked', severity: 'medium', re: /\bparseInt\(\s*[^,()]+\)/, message: 'parseInt without radix; NaN and out-of-range values are not handled' },
  { rule: 'sort-default', severity: 'low', re: /\.sort\(\)/, message: 'sort() without a comparator compares as strings (wrong for numbers)' },
  { rule: 'weak-hash', severity: 'medium', re: /createHash\(\s*['"](md5|sha1)['"]/, message: 'md5/sha1 are weak; never use fast hashes for passwords' },
];

const LOOP_START_RE = /^\s*(for|while)\s*\(|\.forEach\(|\.map\(\s*async/;
const QUERY_RE = /\bawait\s+[\w.$]+\.(find\w*|query|count|aggregate|get\w*|load\w*)\(/;

const braceDelta = (text: string) => (text.match(/\{/g)?.length ?? 0) - (text.match(/\}/g)?.length ?? 0);

export function scanAddedLines(added: { line: number; text: string }[]): Hint[] {
  const hints: Hint[] = [];
  const push = (line: number, r: Pick<Rule, 'rule' | 'severity' | 'message'>) => hints.push({ line, rule: r.rule, severity: r.severity, message: r.message });
  let loopDepth = 0;
  let depth = 0;
  for (const { line, text } of added) {
    for (const r of RULES) if (r.re.test(text)) push(line, r);
    if (loopDepth && QUERY_RE.test(text)) push(line, { rule: 'query-in-loop', severity: 'medium', message: 'database query inside a loop (N+1); batch it or load relations in one query' });
    if (!loopDepth && LOOP_START_RE.test(text)) loopDepth = depth + 1;
    depth += braceDelta(text);
    if (loopDepth && depth < loopDepth) loopDepth = 0;
  }
  return hints;
}
