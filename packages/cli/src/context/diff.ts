export interface DiffFile {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  patch: string;
  added: { line: number; text: string }[];
}

const SKIP = [/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/, /(^|\/)(dist|build|coverage|node_modules)\//, /\.min\.(js|css)$/, /\.(png|jpe?g|gif|ico|woff2?|gguf|map)$/];

export const isReviewable = (path: string): boolean => !SKIP.some((re) => re.test(path));

export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let newLine = 0;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      const m = / b\/(.+)$/.exec(line);
      current = { path: m?.[1] ?? line, status: 'modified', patch: '', added: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('new file mode')) current.status = 'added';
    else if (line.startsWith('deleted file mode')) current.status = 'deleted';
    else if (line.startsWith('rename to ')) current.status = 'renamed';
    if (/^(index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode)/.test(line)) continue;
    if (line.startsWith('Binary files')) {
      current.patch = '';
      current.status = 'deleted';
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      current.patch += line + '\n';
      continue;
    }
    if (line.startsWith('+')) {
      current.added.push({ line: newLine, text: line.slice(1) });
      current.patch += `${String(newLine).padStart(4)} ${line}\n`;
      newLine++;
    } else if (line.startsWith('-')) {
      current.patch += `     ${line}\n`;
    } else if (line.startsWith(' ')) {
      current.patch += `${String(newLine).padStart(4)} ${line}\n`;
      newLine++;
    }
  }
  return files.filter((f) => f.status !== 'deleted' && f.patch && isReviewable(f.path));
}

export function splitPatch(patch: string, maxChars: number): string[] {
  if (patch.length <= maxChars) return [patch];
  const hunks = patch.split(/(?=^@@ )/m);
  const parts: string[] = [];
  let buf = '';
  for (const h of hunks) {
    if (buf && buf.length + h.length > maxChars) {
      parts.push(buf);
      buf = '';
    }
    buf += h.length > maxChars ? h.slice(0, maxChars) + '\n… [hunk truncated]\n' : h;
  }
  if (buf) parts.push(buf);
  return parts;
}
