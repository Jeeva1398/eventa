// Keys are "name@targetMajor" (most specific) or "name" (any major bump).
export const UPGRADE_NOTES: Record<string, string> = {
  'express@5': 'Express 5 uses path-to-regexp v8: wildcard routes must be named (`/*splat`) and optional params use braces; `req.param()` and `app.del()` were removed; rejected promises in async handlers now go to error middleware. Run your route tests.',
  'body-parser@2': 'body-parser 2 (used by Express 5) drops deprecated options and changes `urlencoded` `extended` default to false; check form parsing.',
  'chalk@5': "chalk 5 is ESM-only; `require('chalk')` fails in CommonJS. Stay on 4 for CJS or migrate the project to ESM.",
  'node-fetch@3': 'node-fetch 3 is ESM-only. On Node 18+ prefer the built-in global `fetch` and remove the dependency.',
  uuid: "Deep imports such as `require('uuid/v4')` were removed in v8; use `const { v4 } = require('uuid')`.",
  'mongoose@7': 'Mongoose 7 removed callback support from model methods (use async/await) and changed the `strictQuery` default.',
  'mongoose@8': 'Mongoose 7 removed callback support from model methods (use async/await) and changed the `strictQuery` default; Mongoose 8 needs MongoDB 4.4+.',
  'jest@28': 'Jest 28 no longer bundles jsdom (install `jest-environment-jsdom`) and renamed `testURL` to `testEnvironmentOptions.url`.',
  'jest@29': 'Jest 28 no longer bundles jsdom (install `jest-environment-jsdom`) and renamed `testURL` to `testEnvironmentOptions.url`; Jest 29 changed the default snapshot format.',
  'eslint@9': 'ESLint 9 uses flat config (`eslint.config.js`) by default and ignores `.eslintrc`; many plugins need updated versions.',
  'typescript@5': 'TypeScript 5 deprecates flags such as `importsNotUsedAsValues` and implements standard decorators unless `experimentalDecorators` is set; expect some new type errors.',
  'axios@1': 'axios 1.x adds an `exports` map, so deep imports like `axios/lib/...` break, and some TypeScript types were renamed.',
  helmet: 'Newer helmet enables a strict Content-Security-Policy and cross-origin headers by default, which can block inline scripts and third-party assets; test your pages.',
  inquirer: 'inquirer 9+ is ESM-only and v10+ moved to the new `@inquirer/prompts` API.',
  got: 'got 12+ is ESM-only and changed several option names; consider native `fetch` for simple calls.',
  'webpack@5': 'webpack 5 removed automatic Node.js polyfills (`Buffer`, `process`, `crypto`) for browser bundles; add `resolve.fallback` where needed. It also fixes ERR_OSSL_EVP_UNSUPPORTED on Node 17+.',
  dotenv: 'Low risk: dotenv 16 keeps the same `config()` API and adds multiline values.',
  '@nestjs/core@11': 'Nest 11 requires Node 20+ and uses Express 5 by default, so wildcard routes change syntax (`*` must be named, e.g. `*splat`). Upgrade all `@nestjs/*` packages together.',
  '@nestjs/common@11': 'Nest 11 requires Node 20+ and uses Express 5 by default, so wildcard routes change syntax (`*` must be named, e.g. `*splat`). Upgrade all `@nestjs/*` packages together.',
  '@prisma/client': 'Prisma 5 removed `rejectOnNotFound` (use `findUniqueOrThrow`); Prisma 6 needs Node 18.18+ and TypeScript 5.1+, and `Bytes` fields become `Uint8Array`. Upgrade `prisma` and `@prisma/client` to the same version and re-run `prisma generate`.',
  prisma: 'Upgrade `prisma` and `@prisma/client` to the same version and re-run `prisma generate`; Prisma 5 removed `rejectOnNotFound`, Prisma 6 needs Node 18.18+ and TypeScript 5.1+.',
  'class-validator@0': 'Low risk for most apps: 0.14 fixes a security issue where unknown values skipped validation; `forbidUnknownValues` now defaults to true, so plain objects without decorators are rejected.',
  'redis@4': 'node-redis 4 is promise-based: call `await client.connect()` before use, and commands are camelCase (`hSet`, not `hset`) with no callbacks.',
  glob: "glob 9+ has a promise API only (no callbacks) and a named export: `import { glob } from 'glob'`.",
  rimraf: "rimraf 4+ has a promise API only and a named export: `import { rimraf } from 'rimraf'`.",
};

const major = (version?: string) => version?.split('.')[0];

export function upgradeNote(name: string, latest: string): string | undefined {
  return UPGRADE_NOTES[`${name}@${major(latest)}`] ?? UPGRADE_NOTES[name];
}
