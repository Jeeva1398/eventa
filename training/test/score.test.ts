import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreDeps, scoreExplain, scoreReview } from '../src/score.js';
import type { Example } from '../src/types.js';

describe('scorers', () => {
  it('scores explain format and keywords', () => {
    const out = '**Cause**: `user` is undefined\n\n**Fix**:\n```js\nuser?.name\n```\n\n**Prevent**: validate';
    expect(scoreExplain(out, ['undefined', '?.', 'profile'])).toEqual({ format: 1, keywords: 2 / 3 });
    expect(scoreExplain('just text', []).format).toBe(0);
  });

  it('scores review recall, precision and severity with ±1 line tolerance', () => {
    const out = '- [high] line 8: sql injection → params\n- [low] line 12: style → x\n- [medium] line 20: nope → x';
    expect(scoreReview(out, [{ line: 7, severity: 'high' }, { line: 12, severity: 'medium' }])).toEqual({ recall: 1, precision: 2 / 3, severity: 0.5 });
  });

  it('requires "No issues found." and no issue lines on clean diffs', () => {
    expect(scoreReview('No issues found.', [])).toEqual({ clean: 1 });
    expect(scoreReview('- [low] line 3: console.log → remove', [])).toEqual({ clean: 0 });
  });

  it('flags invented versions in deps advice', () => {
    const input = 'Fix commands:\n- npm install lodash@4.17.21 → fixes lodash\nOutdated:\n- express 4.18.2 → latest 5.1.0 (MAJOR)';
    expect(scoreDeps('`npm install lodash@4.17.21`. express 4.18.2 → 5.1.0', input, ['npm install lodash@4.17.21'], ['express'])).toEqual({ commands: 1, majors: 1, noInvented: 1 });
    expect(scoreDeps('npm install lodash@4.18.0', input, ['npm install lodash@4.17.21'], []).noInvented).toBe(0);
  });

  it('gives the reference answers in the dataset a perfect score', () => {
    const rows = readFileSync(join(import.meta.dirname, '..', 'data', 'eval.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Example);
    for (const r of rows) {
      const c = r.check;
      const scores = c.task === 'explain' ? scoreExplain(r.output, c.keywords) : c.task === 'review' ? scoreReview(r.output, c.issues) : scoreDeps(r.output, r.input, c.commands, c.majors);
      for (const [metric, value] of Object.entries(scores)) expect({ id: r.id, metric, value }).toEqual({ id: r.id, metric, value: 1 });
    }
  });
});
