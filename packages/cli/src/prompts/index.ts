export interface PromptParts {
  instruction: string;
  input: string;
}

export const SYSTEM_PROMPT =
  'You are Eventa, an expert Node.js engineer. Answer concisely and accurately. ' +
  'Prefer modern Node.js (ESM, async/await, node: built-ins). Use markdown and fenced code blocks.';

export const toPrompt = ({ instruction, input }: PromptParts): string => (input ? `${instruction}\n\n${input}` : instruction);
