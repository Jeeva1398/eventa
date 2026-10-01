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
const CODE_RE = /\b(ERR_[A-Z0-9_]+|E(?:CONNREFUSED|CONNRESET|ADDRINUSE|ACCES|NOENT|PERM|TIMEDOUT|NOTFOUND|EXIST|ISDIR|MFILE|PIPE))\b/;

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

export function parseStack(text: string): ParsedError {
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
  result.code = CODE_RE.exec(text)?.[1];
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
