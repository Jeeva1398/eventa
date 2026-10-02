import { describe, expect, it } from 'vitest';
import { MARKER, meetsThreshold, parseIssues, toMarkdown, worstSeverity } from '../src/commands/reviewReport.js';

const analysis = [
  '- [high] line 7: `save()` is not awaited → `await order.save();`',
  '* [Medium] line 12 empty catch | swallows errors',
  '- [low] leftover console.log',
  'Some prose that is not an issue.',
].join('\n');

describe('review report', () => {
  it('parses issue lines from the model output', () => {
    expect(parseIssues(analysis)).toEqual([
      { severity: 'high', line: 7, text: '`save()` is not awaited → `await order.save();`' },
      { severity: 'medium', line: 12, text: 'empty catch | swallows errors' },
      { severity: 'low', line: undefined, text: 'leftover console.log' },
    ]);
    expect(parseIssues('No issues found.')).toEqual([]);
  });

  it('applies the fail-on threshold', () => {
    const results = [{ file: 'a.js', hints: [], analysis: '- [medium] line 1: x' }];
    expect(worstSeverity(results)).toBe('medium');
    expect(meetsThreshold('medium', 'high')).toBe(false);
    expect(meetsThreshold('medium', 'medium')).toBe(true);
    expect(meetsThreshold('medium', 'low')).toBe(true);
    expect(meetsThreshold('high', 'none')).toBe(false);
    expect(meetsThreshold(undefined, 'low')).toBe(false);
  });

  it('renders a PR comment with a table and static checks', () => {
    const md = toMarkdown(
      [
        { file: 'src/orders.js', hints: [{ line: 7, rule: 'promise-no-await', severity: 'high', message: 'dropped promise' }], analysis },
        { file: 'src/clean.js', hints: [], analysis: 'No issues found.' },
      ],
      { label: 'changes since HEAD^1', version: '0.2.0' },
    );
    expect(md.startsWith(MARKER)).toBe(true);
    expect(md).toContain('Found **3** issue(s) in 2 file(s) (changes since HEAD^1): 1 high, 1 medium, 1 low.');
    expect(md).toContain('| 🔴 high | `src/orders.js` | 7 |');
    expect(md).toContain('empty catch \\| swallows errors');
    expect(md).toContain('- `src/orders.js` line 7: [high] dropped promise');
  });

  it('says so when nothing was found', () => {
    const md = toMarkdown([{ file: 'a.js', hints: [], analysis: 'No issues found.' }], { label: 'staged changes', version: '0.2.0' });
    expect(md).toContain('No issues found in 1 file(s) (staged changes).');
    expect(md).not.toContain('<details>');
  });
});
