import type { Hint } from '../context/heuristics.js';
import type { PromptParts } from './index.js';

export function reviewPrompt(path: string, patch: string, hints: Hint[]): PromptParts {
  const sections = [`File: ${path}\nDiff (left column is the new line number, + added, - removed):\n\`\`\`diff\n${patch.trimEnd()}\n\`\`\``];
  if (hints.length) sections.push(`Static checks flagged:\n${hints.map((h) => `- [${h.severity}] line ${h.line}: ${h.message}`).join('\n')}`);
  return {
    instruction:
      'Review this Node.js code change. Report only real problems in the added lines: bugs, missing await, ' +
      'unhandled promise rejections, error handling, security (injection, path traversal, secrets, unsafe TLS), ' +
      'and event-loop blocking work in request paths. Confirm or dismiss each static check.\n' +
      'Format each issue as: `- [high|medium|low] line N: problem → fix`. Add a short code block only when the fix is not obvious.\n' +
      'Severity: injection, secrets, disabled TLS and lost errors from a missing await are high; swallowed errors and blocking I/O are medium; style is low.\n' +
      'Write "No issues found." only when you list no issues at all.',
    input: sections.join('\n\n'),
  };
}
