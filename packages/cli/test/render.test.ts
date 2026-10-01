import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { formatLine, renderStream } from '../src/ui/render.js';

async function* tokens(...t: string[]) {
  yield* t;
}

describe('render', () => {
  it('passes tokens through unchanged when not a TTY', async () => {
    let written = '';
    const out = new Writable({
      write(chunk, _enc, cb) {
        written += chunk;
        cb();
      },
    });
    const full = await renderStream(tokens('Hello ', '**world**'), { out });
    expect(full).toBe('Hello **world**');
    expect(written).toBe('Hello **world**\n');
  });

  it('tracks fenced code blocks across lines', () => {
    const state = { inCode: false };
    formatLine('```js', state);
    expect(state.inCode).toBe(true);
    formatLine('```', state);
    expect(state.inCode).toBe(false);
  });

  it('turns list markers into bullets', () => {
    expect(formatLine('- item', { inCode: false })).toContain('• item');
  });
});
