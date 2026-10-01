import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnusedAndMissing, fixPlan, packageName, parseAudit, parseOutdated, readPackageJson, scanImports } from '../src/context/deps.js';
import { parseDiff, splitPatch } from '../src/context/diff.js';
import { scanAddedLines } from '../src/context/heuristics.js';
import { parseStack, readSnippet, snippetsFor, userFrames } from '../src/context/stackParser.js';
import { truncateMiddle } from '../src/context/tokens.js';
import { explainPrompt } from '../src/prompts/explain.js';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('parseStack', () => {
  it('parses a Windows CommonJS ERR_REQUIRE_ESM crash', () => {
    const p = parseStack(fixture('stack-require-esm.txt'));
    expect(p.code).toBe('ERR_REQUIRE_ESM');
    expect(p.message).toMatch(/^Error \[ERR_REQUIRE_ESM\]: require\(\) of ES Module/);
    expect(p.frames[0]).toMatchObject({ file: 'C:\\projects\\shop\\src\\server.js', line: 3, internal: false });
    expect(p.frames.filter((f) => f.internal).length).toBeGreaterThan(0);
  });

  it('parses ESM file:// frames and marks node_modules as dependency', () => {
    const p = parseStack(fixture('stack-esm.txt'));
    expect(p.message).toBe("TypeError: Cannot read properties of undefined (reading 'name')");
    const users = p.frames.find((f) => f.fn === 'getUser');
    expect(users?.line).toBe(14);
    expect(users?.file).toMatch(/users\.mjs$/);
    expect(p.frames.some((f) => f.dependency)).toBe(true);
  });

  it('finds system error codes', () => {
    expect(parseStack('Error: connect ECONNREFUSED 127.0.0.1:5432').code).toBe('ECONNREFUSED');
  });

  it('reads snippets for frames that exist on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eventa-'));
    const file = join(dir, 'app.js');
    writeFileSync(file, ['const a = 1;', 'const b = a.c.d;', 'console.log(b);'].join('\n'));
    const frames = userFrames(parseStack(`TypeError: x\n    at Object.<anonymous> (${file}:2:15)\n    at missing (${join(dir, 'nope.js')}:1:1)`), dir);
    expect(frames).toHaveLength(1);
    const snippet = readSnippet(frames[0].file, 2, 1, dir);
    expect(snippet).toContain('const b = a.c.d;  // <-- line 2');
    expect(snippet.startsWith('// app.js (lines 1-3)')).toBe(true);
  });

  it('merges nearby frames from the same file into one snippet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eventa-'));
    const file = join(dir, 'app.js');
    writeFileSync(file, Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n'));
    const frame = (line: number) => ({ file, line, internal: false, dependency: false });
    const [snippet, ...rest] = snippetsFor([frame(3), frame(6)], 2, dir);
    expect(rest).toHaveLength(0);
    expect(snippet).toContain('line3  // <-- line 3');
    expect(snippet).toContain('line6  // <-- line 6');
  });
});

describe('diff + heuristics', () => {
  const files = parseDiff(fixture('missing-await.diff'));

  it('keeps source files and drops lockfiles and deletions', () => {
    expect(files.map((f) => f.path)).toEqual(['src/orders.js']);
    expect(files[0].added[0]).toEqual({ line: 12, text: "  const config = fs.readFileSync('./config.json', 'utf8');" });
  });

  it('flags missing await, SQL injection, sync fs and empty catch', () => {
    const rules = scanAddedLines(files[0].added).map((h) => `${h.rule}@${h.line}`);
    expect(rules).toEqual(expect.arrayContaining(['sync-fs@12', 'promise-no-await@14', 'sql-injection@15', 'empty-catch@18']));
  });

  it('splits long patches on hunk boundaries', () => {
    const patch = '@@ -1 +1 @@\n' + 'a'.repeat(50) + '\n@@ -9 +9 @@\n' + 'b'.repeat(50) + '\n';
    const parts = splitPatch(patch, 80);
    expect(parts).toHaveLength(2);
    expect(parts[1].startsWith('@@ -9')).toBe(true);
  });
});

describe('deps', () => {
  it('parses npm audit JSON sorted by severity', () => {
    const { vulnerabilities } = parseAudit(fixture('audit.json'));
    expect(vulnerabilities.map((v) => v.name)).toEqual(['minimist', 'lodash', 'mkdirp']);
    expect(vulnerabilities[1]).toMatchObject({ title: 'Prototype Pollution in lodash', fix: 'npm install lodash@4.17.21' });
    expect(vulnerabilities[2].fix).toBeUndefined();
  });

  it('groups vulnerabilities by fix command', () => {
    const plan = fixPlan(parseAudit(fixture('audit.json')).vulnerabilities);
    expect(plan).toEqual([
      { command: 'npm audit fix', fixes: ['minimist'] },
      { command: 'npm install lodash@4.17.21', fixes: ['lodash'] },
      { command: 'no fix available', fixes: ['mkdirp'] },
    ]);
  });

  it('reports audit errors such as a missing lockfile', () => {
    expect(parseAudit('{"error":{"code":"ENOLOCK","summary":"This command requires an existing lockfile."}}').error).toMatch(/lockfile/);
  });

  it('parses npm outdated JSON and detects major bumps', () => {
    const out = parseOutdated(fixture('outdated.json'));
    expect(out.find((o) => o.name === 'express')?.major).toBe(true);
    expect(out.find((o) => o.name === 'dotenv')?.major).toBe(false);
    expect(out.find((o) => o.name === 'chalk')?.current).toBeUndefined();
  });

  it('maps import specifiers to package names', () => {
    expect(packageName('lodash/debounce.js')).toBe('lodash');
    expect(packageName('@acme/config/load')).toBe('@acme/config');
    expect(packageName('node:fs')).toBeUndefined();
    expect(packageName('fs/promises')).toBeUndefined();
    expect(packageName('./x.js')).toBeUndefined();
    expect(packageName('@/components/x')).toBeUndefined();
  });

  it('finds unused and missing packages', () => {
    const dir = join(import.meta.dirname, 'fixtures', 'deps-project');
    const result = findUnusedAndMissing(readPackageJson(dir), scanImports(dir), dir);
    expect(result.unused).toEqual(['moment']);
    expect(result.missing).toEqual(['@acme/config', 'pino', 'zod']);
  });
});

describe('prompts', () => {
  it('includes the reference note for known error codes', () => {
    const { input } = explainPrompt({ errorText: 'Error [ERR_REQUIRE_ESM]: x', code: 'ERR_REQUIRE_ESM', snippets: [] });
    expect(input).toContain('Reference for ERR_REQUIRE_ESM');
  });

  it('truncates long text in the middle', () => {
    const t = truncateMiddle('a'.repeat(1000) + 'b'.repeat(1000), 100);
    expect(t.length).toBeLessThan(400);
    expect(t.startsWith('a') && t.endsWith('b')).toBe(true);
  });
});
