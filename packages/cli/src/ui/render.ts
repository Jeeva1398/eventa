import chalk from 'chalk';
import ora from 'ora';

export function formatLine(line: string, state: { inCode: boolean }): string {
  if (line.trimStart().startsWith('```')) {
    state.inCode = !state.inCode;
    return chalk.dim(line);
  }
  if (state.inCode) return chalk.cyan(line);
  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading) return chalk.bold.underline(heading[2]);
  return line
    .replace(/\*\*([^*]+)\*\*/g, (_, t: string) => chalk.bold(t))
    .replace(/`([^`]+)`/g, (_, t: string) => chalk.yellow(t))
    .replace(/^(\s*)[-*]\s+/, (_, s: string) => `${s}• `);
}

export interface RenderOptions {
  raw?: boolean;
  out?: NodeJS.WritableStream & { isTTY?: boolean };
}

// Streams tokens but formats whole lines, so markdown styling never splits mid-token.
export async function renderStream(tokens: AsyncIterable<string>, opts: RenderOptions = {}): Promise<string> {
  const out = opts.out ?? process.stdout;
  const pretty = !opts.raw && Boolean(out.isTTY);
  const spinner = pretty ? ora({ text: 'Thinking…', stream: process.stderr }).start() : null;
  const state = { inCode: false };
  let full = '';
  let pending = '';

  try {
    for await (const token of tokens) {
      spinner?.stop();
      full += token;
      if (!pretty) {
        out.write(token);
        continue;
      }
      pending += token;
      let nl: number;
      while ((nl = pending.indexOf('\n')) >= 0) {
        out.write(formatLine(pending.slice(0, nl), state) + '\n');
        pending = pending.slice(nl + 1);
      }
    }
    if (pretty && pending) out.write(formatLine(pending, state));
    if (!full.endsWith('\n')) out.write('\n');
  } finally {
    spinner?.stop();
  }
  return full;
}
