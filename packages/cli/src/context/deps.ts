import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { extname, join } from 'node:path';
import { exec } from './exec.js';

export interface PackageJson {
  name?: string;
  type?: string;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface Vulnerability {
  name: string;
  severity: string;
  title?: string;
  url?: string;
  range?: string;
  fix?: string;
}

export interface Outdated {
  name: string;
  current?: string;
  wanted: string;
  latest: string;
  major: boolean;
}

export interface DepsReport {
  vulnerabilities: Vulnerability[];
  auditError?: string;
  outdated: Outdated[];
  unused: string[];
  missing: string[];
}

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];
const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'out', '.turbo', '.cache']);
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const BUILTINS = new Set(builtinModules);

export function readPackageJson(cwd: string): PackageJson {
  try {
    return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as PackageJson;
  } catch {
    throw new Error(`No readable package.json in ${cwd}`);
  }
}

function parseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

interface AuditJson {
  error?: { code?: string; summary?: string };
  vulnerabilities?: Record<string, {
    severity: string;
    range?: string;
    via: (string | { title?: string; url?: string })[];
    fixAvailable: boolean | { name: string; version: string; isSemVerMajor?: boolean };
  }>;
}

export function parseAudit(text: string): { vulnerabilities: Vulnerability[]; error?: string } {
  const json = parseJson<AuditJson>(text);
  if (!json) return { vulnerabilities: [], error: 'npm audit returned no JSON' };
  if (json.error) return { vulnerabilities: [], error: json.error.summary ?? json.error.code };
  const vulnerabilities = Object.entries(json.vulnerabilities ?? {}).map(([name, v]) => {
    const advisory = v.via.find((x): x is { title?: string; url?: string } => typeof x === 'object');
    const fix = v.fixAvailable === true ? 'npm audit fix'
      : v.fixAvailable ? `npm install ${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? ' (major)' : ''}`
      : undefined;
    return { name, severity: v.severity, title: advisory?.title ?? (v.via.length ? `via ${v.via.join(', ')}` : undefined), url: advisory?.url, range: v.range, fix };
  });
  vulnerabilities.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return { vulnerabilities };
}

export function fixPlan(vulns: Vulnerability[]): { command: string; fixes: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const v of vulns) {
    const command = v.fix ?? 'no fix available';
    groups.set(command, [...(groups.get(command) ?? []), v.name]);
  }
  return [...groups].map(([command, fixes]) => ({ command, fixes }));
}

export function parseOutdated(text: string): Outdated[] {
  const json = parseJson<Record<string, { current?: string; wanted: string; latest: string }>>(text) ?? {};
  return Object.entries(json).map(([name, v]) => ({
    name,
    current: v.current,
    wanted: v.wanted,
    latest: v.latest,
    major: Boolean(v.current && v.latest && v.current.split('.')[0] !== v.latest.split('.')[0]),
  }));
}

export function packageName(specifier: string): string | undefined {
  if (/^(\.|\/|#|~|@\/|[a-z]+:)/i.test(specifier) || BUILTINS.has(specifier)) return undefined;
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (BUILTINS.has(name) || !/^(@[\w.-]+\/)?[\w.-]+$/.test(name)) return undefined;
  return name;
}

export function scanImports(cwd: string, maxFiles = 3000): Set<string> {
  const found = new Set<string>();
  let count = 0;
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (count >= maxFiles) return;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name));
      } else if (SOURCE_EXT.has(extname(e.name)) || /\.config\.[cm]?[jt]s$/.test(e.name)) {
        count++;
        const text = readFileSync(join(dir, e.name), 'utf8');
        for (const m of text.matchAll(IMPORT_RE)) {
          const name = packageName(m[1] ?? m[2] ?? m[3] ?? m[4]);
          if (name) found.add(name);
        }
      }
    }
  };
  walk(cwd);
  return found;
}

function binNames(cwd: string, dep: string): string[] {
  let text: string;
  try {
    text = readFileSync(join(cwd, 'node_modules', dep, 'package.json'), 'utf8');
  } catch {
    return [];
  }
  const pkg = parseJson<{ bin?: string | Record<string, string> }>(text);
  if (!pkg?.bin) return [];
  return typeof pkg.bin === 'string' ? [dep.split('/').pop()!] : Object.keys(pkg.bin);
}

export function findUnusedAndMissing(pkg: PackageJson, imported: Set<string>, cwd = process.cwd()): { unused: string[]; missing: string[] } {
  const scriptTokens = new Set(Object.values(pkg.scripts ?? {}).join(' ').split(/[\s&|;()'"=]+/));
  const usedInScripts = (d: string) => scriptTokens.has(d) || binNames(cwd, d).some((b) => scriptTokens.has(b));
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
  const unused = Object.keys(pkg.dependencies ?? {}).filter(
    (d) => !imported.has(d) && !d.startsWith('@types/') && !usedInScripts(d),
  );
  const missing = [...imported].filter((d) => !declared.has(d) && d !== pkg.name && !declared.has(`@types/${d}`)).sort();
  return { unused, missing };
}

export async function collectDeps(cwd: string): Promise<DepsReport> {
  const pkg = readPackageJson(cwd);
  const [audit, outdated] = await Promise.all([
    exec('npm', ['audit', '--json'], { cwd }),
    exec('npm', ['outdated', '--json'], { cwd }),
  ]);
  const { vulnerabilities, error } = parseAudit(audit.stdout);
  return {
    vulnerabilities,
    auditError: error,
    outdated: parseOutdated(outdated.stdout),
    ...findUnusedAndMissing(pkg, scanImports(cwd), cwd),
  };
}
