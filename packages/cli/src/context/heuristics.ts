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
  { rule: 'promise-no-await', severity: 'high', re: /^\s*(?!return\b|await\b|const\b|let\b|var\b)[\w.]+\.(save|create|update|delete|insert|send|fetch|query|findOne|findById)\s*\([^)]*\)\s*;?\s*$/, message: 'async-looking call without await or return, result and errors are dropped' },
  { rule: 'empty-catch', severity: 'medium', re: /catch\s*(\(\w*\))?\s*\{\s*\}/, message: 'empty catch swallows errors' },
  { rule: 'then-no-catch', severity: 'medium', re: /\.then\([^)]*\)\s*;\s*$/, message: '.then() without .catch(), possible unhandled rejection' },
  { rule: 'console-log', severity: 'low', re: /\bconsole\.log\(/, message: 'leftover console.log' },
  { rule: 'tls-off', severity: 'high', re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, message: 'TLS certificate verification disabled' },
];

export function scanAddedLines(added: { line: number; text: string }[]): Hint[] {
  const hints: Hint[] = [];
  for (const { line, text } of added) {
    for (const r of RULES) if (r.re.test(text)) hints.push({ line, rule: r.rule, severity: r.severity, message: r.message });
  }
  return hints;
}
