import type { DepsReport, Outdated, Vulnerability } from '../../../packages/cli/src/context/deps.js';

export interface MajorUpgrade extends Outdated {
  risk: string;
}

export const MAJORS: MajorUpgrade[] = [
  { name: 'express', current: '4.18.2', wanted: '4.21.2', latest: '5.1.0', major: true, risk: 'Express 5 uses path-to-regexp v8: wildcard routes must be named (`/*splat`) and optional params use braces; `req.param()` and `app.del()` were removed; rejected promises in async handlers now go to error middleware. Run your route tests.' },
  { name: 'chalk', current: '4.1.2', wanted: '4.1.2', latest: '5.4.1', major: true, risk: 'chalk 5 is ESM-only; `require(\'chalk\')` fails in CommonJS. Stay on 4 for CJS or migrate the project to ESM.' },
  { name: 'node-fetch', current: '2.7.0', wanted: '2.7.0', latest: '3.3.2', major: true, risk: 'node-fetch 3 is ESM-only. On Node 18+ prefer the built-in global `fetch` and remove the dependency.' },
  { name: 'uuid', current: '7.0.3', wanted: '7.0.3', latest: '11.1.0', major: true, risk: 'Deep imports such as `require(\'uuid/v4\')` were removed in v8; use `const { v4 } = require(\'uuid\')`.' },
  { name: 'mongoose', current: '6.12.0', wanted: '6.13.8', latest: '8.15.1', major: true, risk: 'Mongoose 7 removed callback support from model methods (use async/await) and changed the `strictQuery` default; Mongoose 8 needs MongoDB 4.4+.' },
  { name: 'jest', current: '27.5.1', wanted: '27.5.1', latest: '29.7.0', major: true, risk: 'Jest 28 no longer bundles jsdom (install `jest-environment-jsdom`) and renamed `testURL` to `testEnvironmentOptions.url`; Jest 29 changed the default snapshot format.' },
  { name: 'eslint', current: '8.57.0', wanted: '8.57.0', latest: '9.28.0', major: true, risk: 'ESLint 9 uses flat config (`eslint.config.js`) by default and ignores `.eslintrc`; many plugins need updated versions.' },
  { name: 'typescript', current: '4.9.5', wanted: '4.9.5', latest: '5.8.3', major: true, risk: 'TypeScript 5 deprecates flags such as `importsNotUsedAsValues` and implements standard decorators unless `experimentalDecorators` is set; expect some new type errors.' },
  { name: 'axios', current: '0.27.2', wanted: '0.27.2', latest: '1.9.0', major: true, risk: 'axios 1.x adds an `exports` map, so deep imports like `axios/lib/...` break, and some TypeScript types were renamed.' },
  { name: 'helmet', current: '4.6.0', wanted: '4.6.0', latest: '8.1.0', major: true, risk: 'Newer helmet enables a strict Content-Security-Policy and cross-origin headers by default, which can block inline scripts and third-party assets; test your pages.' },
  { name: 'inquirer', current: '8.2.6', wanted: '8.2.6', latest: '12.6.3', major: true, risk: 'inquirer 9+ is ESM-only and v10+ moved to the new `@inquirer/prompts` API.' },
  { name: 'got', current: '11.8.6', wanted: '11.8.6', latest: '14.4.7', major: true, risk: 'got 12+ is ESM-only and changed several option names; consider native `fetch` for simple calls.' },
  { name: 'webpack', current: '4.47.0', wanted: '4.47.0', latest: '5.99.9', major: true, risk: 'webpack 5 removed automatic Node.js polyfills (`Buffer`, `process`, `crypto`) for browser bundles; add `resolve.fallback` where needed. It also fixes ERR_OSSL_EVP_UNSUPPORTED on Node 17+.' },
  { name: 'dotenv', current: '8.6.0', wanted: '8.6.0', latest: '16.5.0', major: true, risk: 'Low risk: dotenv 16 keeps the same `config()` API and adds multiline values.' },
  { name: '@nestjs/core', current: '10.4.15', wanted: '10.4.15', latest: '11.1.3', major: true, risk: 'Nest 11 requires Node 20+ and uses Express 5 by default, so wildcard routes change syntax (`*` must be named, e.g. `*splat`). Upgrade all `@nestjs/*` packages together.' },
  { name: '@prisma/client', current: '4.16.2', wanted: '4.16.2', latest: '6.9.0', major: true, risk: 'Prisma 5 removed `rejectOnNotFound` (use `findUniqueOrThrow`); Prisma 6 needs Node 18.18+ and TypeScript 5.1+, and `Bytes` fields become `Uint8Array`. Upgrade `prisma` and `@prisma/client` to the same version and re-run `prisma generate`.' },
  { name: 'class-validator', current: '0.13.2', wanted: '0.13.2', latest: '0.14.2', major: true, risk: 'Low risk for most apps: 0.14 fixes a security issue where unknown values skipped validation; `forbidUnknownValues` now defaults to true, so plain objects without decorators are rejected.' },
];

export const MINORS: Outdated[] = [
  { name: 'cors', current: '2.8.4', wanted: '2.8.5', latest: '2.8.5', major: false },
  { name: 'dotenv', current: '16.3.1', wanted: '16.5.0', latest: '16.5.0', major: false },
  { name: 'pino', current: '9.1.0', wanted: '9.7.0', latest: '9.7.0', major: false },
  { name: 'zod', current: '3.22.4', wanted: '3.25.67', latest: '3.25.67', major: false },
  { name: 'nodemon', current: '3.0.1', wanted: '3.1.10', latest: '3.1.10', major: false },
  { name: 'prettier', current: '3.2.5', wanted: '3.5.3', latest: '3.5.3', major: false },
];

export const VULNS: (Vulnerability & { why: string })[] = [
  { name: 'lodash', severity: 'high', title: 'Command Injection in lodash', fix: 'npm install lodash@4.17.21', why: 'template() can execute injected code' },
  { name: 'minimist', severity: 'critical', title: 'Prototype Pollution in minimist', fix: 'npm audit fix', why: 'crafted CLI args can pollute Object.prototype' },
  { name: 'semver', severity: 'moderate', title: 'semver vulnerable to Regular Expression Denial of Service', fix: 'npm audit fix', why: 'long version strings can hang the event loop' },
  { name: 'jsonwebtoken', severity: 'high', title: 'jsonwebtoken unrestricted key type could lead to legacy keys usage', fix: 'npm install jsonwebtoken@9.0.2 (major)', why: 'weak or wrong key types may be accepted when verifying tokens; v9 is a major upgrade, check `verify` options' },
  { name: 'axios', severity: 'moderate', title: 'Axios Cross-Site Request Forgery Vulnerability', fix: 'npm install axios@1.9.0 (major)', why: 'the XSRF token can leak to third-party hosts; this is also a major upgrade' },
  { name: 'express', severity: 'moderate', title: 'Express.js Open Redirect in malformed URLs', fix: 'npm install express@4.21.2', why: 'res.redirect can send users to attacker-controlled sites' },
  { name: 'tough-cookie', severity: 'moderate', title: 'tough-cookie Prototype Pollution vulnerability', fix: 'npm audit fix', why: 'cookie parsing can pollute prototypes' },
  { name: 'word-wrap', severity: 'moderate', title: 'word-wrap vulnerable to Regular Expression Denial of Service', fix: 'npm audit fix', why: 'crafted input can block the event loop' },
  { name: 'ws', severity: 'high', title: 'ws affected by a DoS when handling a request with many HTTP headers', fix: 'npm audit fix', why: 'a single request can crash the WebSocket server' },
  { name: 'follow-redirects', severity: 'moderate', title: 'follow-redirects improperly handles URLs in the url.parse() function', fix: 'npm audit fix', why: 'redirects can leak credentials to other hosts' },
  { name: 'request', severity: 'moderate', title: 'Server-Side Request Forgery in Request', why: 'request is deprecated and will not be fixed; replace it with fetch, undici or axios' },
  { name: 'node-fetch', severity: 'high', title: 'node-fetch forwards secure headers to untrusted sites', fix: 'npm install node-fetch@2.7.0', why: 'Authorization headers can be sent to a redirect target' },
  { name: 'ip', severity: 'high', title: 'ip SSRF improper categorization in isPublic', why: 'no patched release; avoid using `ip.isPublic` for security decisions or drop the dependency' },
];

const UNUSED = ['moment', 'request', 'body-parser', 'underscore', 'bluebird', 'colors', 'q'];
const MISSING = ['zod', 'pino', 'dotenv', 'jsonwebtoken', 'cors', '@aws-sdk/client-s3'];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: T[], max: number): T[] {
  const n = Math.floor(rand() * (max + 1));
  return [...items].sort(() => rand() - 0.5).slice(0, n);
}

export interface DepsCase {
  report: DepsReport;
  vulns: (typeof VULNS)[number][];
  majors: MajorUpgrade[];
}

export function randomDepsCase(rand: () => number): DepsCase {
  const vulns = pick(rand, VULNS, 4);
  const majors = pick(rand, MAJORS, 3);
  const taken = new Set([...vulns.map((v) => v.name), ...majors.map((m) => m.name)]);
  const minors = pick(rand, MINORS.filter((m) => !taken.has(m.name)), 2);
  const unused = pick(rand, UNUSED.filter((u) => !taken.has(u)), 2);
  const missing = pick(rand, MISSING.filter((m) => !taken.has(m)), 2);
  const report: DepsReport = {
    vulnerabilities: vulns.map(({ why: _why, ...v }) => v),
    outdated: [...majors.map(({ risk: _risk, ...o }) => o), ...minors],
    unused,
    missing,
  };
  return { report, vulns, majors };
}
