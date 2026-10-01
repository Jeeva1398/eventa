import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Frame {
  fn?: string;
  file: string;
  line: number;
  column?: number;
  internal: boolean;
  dependency: boolean;
}

export interface ParsedError {
  message?: string;
  code?: string;
  frames: Frame[];
}

const FRAME_RE = /^\s*at\s+(?:async\s+(?=[^(]*$))?(?:(.+?)\s+\()?((?:file:\/\/|node:|[A-Za-z]:[\\/]|[\\/.]).+?):(\d+)(?::(\d+))?\)?\s*$/;
const HEADER_RE = /^((?:file:\/\/\/?)?(?:[A-Za-z]:)?[^\s:]+\.(?:[cm]?[jt]sx?)):(\d+)$/;
const MESSAGE_RE = /^\s*(?:Uncaught\s+)?((?:[A-Z][A-Za-z]*)?Error(?:\s\[[A-Z0-9_]+\])?:\s.*)$/;
const CODE_RE = /\b(TS\d{4,5}|P[1-3]\d{3}|ERR_[A-Z0-9_]+|E(?:CONNREFUSED|CONNRESET|ADDRINUSE|ACCES|NOENT|PERM|TIMEDOUT|NOTFOUND|EXIST|ISDIR|MFILE|PIPE))\b/;
const TSC_RE = /^(.+?\.(?:[cm]?tsx?))(?:\((\d+),(\d+)\)|:(\d+):(\d+)) ?[:-] ?error (TS\d+): (.*)$/;
const ANSI_RE = /\u001b\[[0-9;]*m/g;
const PATTERN_CODES: [RegExp, string][] = [
  [/Nest can't resolve dependencies/, 'NEST_UNKNOWN_DEPENDENCIES'],
  [/circular dependency/i, 'NEST_CIRCULAR_DEPENDENCY'],
  [/@prisma\/client did not initialize yet/, 'PRISMA_NOT_GENERATED'],
];

function toPath(file: string): string {
  if (file.startsWith('file://')) {
    try {
      return fileURLToPath(file);
    } catch {
      return file;
    }
  }
  return file;
}

function frame(fn: string | undefined, file: string, line: string, column?: string): Frame {
  const path = toPath(file);
  return {
    fn: fn?.trim() || undefined,
    file: path,
    line: Number(line),
    column: column ? Number(column) : undefined,
    internal: path.startsWith('node:') || path.startsWith('internal/'),
    dependency: /[\\/]node_modules[\\/]/.test(path),
  };
}

export function parseStack(raw: string): ParsedError {
  const text = raw.replace(ANSI_RE, '');
  const result: ParsedError = { frames: [] };
  const seen = new Map<string, Frame>();
  const add = (f: Frame) => {
    const key = `${f.file}:${f.line}`;
    const existing = seen.get(key);
    if (existing) {
      existing.fn ??= f.fn;
      existing.column ??= f.column;
      return;
    }
    seen.set(key, f);
    result.frames.push(f);
  };

  for (const line of text.split(/\r?\n/)) {
    const t = TSC_RE.exec(line.trim());
    if (t) {
      add(frame(undefined, t[1], t[2] ?? t[4], t[3] ?? t[5]));
      result.message ??= `error ${t[6]}: ${t[7]}`;
      continue;
    }
    const m = FRAME_RE.exec(line);
    if (m) {
      add(frame(m[1], m[2], m[3], m[4]));
      continue;
    }
    const h = HEADER_RE.exec(line.trim());
    if (h && result.frames.length === 0) add(frame(undefined, h[1], h[2]));
    const msg = MESSAGE_RE.exec(line);
    if (msg && !result.message) result.message = msg[1].trim();
  }
  result.code = PATTERN_CODES.find(([re]) => re.test(text))?.[1] ?? CODE_RE.exec(text)?.[1];
  return result;
}

export function userFrames(parsed: ParsedError, cwd: string, limit = 3): Frame[] {
  return parsed.frames
    .filter((f) => !f.internal && !f.dependency)
    .map((f) => ({ ...f, file: isAbsolute(f.file) ? f.file : resolve(cwd, f.file) }))
    .filter((f) => existsSync(f.file))
    .slice(0, limit);
}

export function readSnippet(file: string, marked: number | number[], radius = 15, cwd = process.cwd()): string {
  const targets = (Array.isArray(marked) ? marked : [marked]).slice().sort((a, b) => a - b);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const start = Math.max(1, targets[0] - radius);
  const end = Math.min(lines.length, targets[targets.length - 1] + radius);
  const body = [];
  for (let n = start; n <= end; n++) {
    body.push(targets.includes(n) ? `${lines[n - 1]}  // <-- line ${n}, in the stack trace` : lines[n - 1]);
  }
  return `// ${relative(cwd, file) || file} (lines ${start}-${end})\n${body.join('\n')}`;
}

export function snippetsFor(frames: Frame[], radius: number, cwd: string): string[] {
  const byFile = new Map<string, number[]>();
  for (const f of frames) {
    const lines = byFile.get(f.file) ?? [];
    const last = lines[lines.length - 1];
    if (last === undefined || Math.abs(f.line - last) <= radius * 2) lines.push(f.line);
    byFile.set(f.file, lines);
  }
  return [...byFile].map(([file, lines]) => readSnippet(file, lines, radius, cwd));
}
