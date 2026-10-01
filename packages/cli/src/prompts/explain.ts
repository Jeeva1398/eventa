import type { PromptParts } from './index.js';
import { knowledgeFor } from './knowledge.js';

export interface ExplainContext {
  errorText: string;
  code?: string;
  snippets: string[];
  project?: { nodeVersion: string; moduleType: string; dependencies: string[] };
}

export function explainPrompt(ctx: ExplainContext): PromptParts {
  const sections = [`Error output:\n\`\`\`\n${ctx.errorText.trim()}\n\`\`\``];
  const lang = ctx.snippets.some((s) => /^\/\/ \S+\.[cm]?tsx?\b/.test(s)) ? 'ts' : 'js';
  if (ctx.snippets.length) sections.push(`Source around the failing lines:\n\`\`\`${lang}\n${ctx.snippets.join('\n\n')}\n\`\`\``);
  const known = knowledgeFor(ctx.code);
  if (known) sections.push(`Reference for ${ctx.code}: ${known}`);
  if (ctx.project) {
    const deps = ctx.project.dependencies.slice(0, 30).join(', ') || 'none';
    sections.push(`Project: Node ${ctx.project.nodeVersion}, ${ctx.project.moduleType} modules, dependencies: ${deps}`);
  }
  return {
    instruction:
      'Explain this Node.js / TypeScript error. Reply with exactly three sections:\n' +
      '**Cause**: the root cause in 1-3 sentences. Name the exact expression that failed and why its value is wrong.\n' +
      '**Fix**: only the changed lines as a fenced code block, then one sentence on why it works.\n' +
      '**Prevent**: one short tip.\n' +
      'Base the answer on the code shown. Do not invent files or APIs.',
    input: sections.join('\n\n'),
  };
}
