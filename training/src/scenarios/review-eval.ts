import type { ReviewScenario } from '../types.js';

const lines = (...l: string[]) => l.join('\n') + '\n';

// Held out: bugs no static check flags, and clean diffs a static check flags wrongly.
export const EVAL_REVIEWS: ReviewScenario[] = [
  {
    id: 'idor-delete-by-id',
    path: 'src/routes/{{entity}}.js',
    before: lines("router.delete('/{{entity}}/:id', requireUser, async (req, res) => {", '  res.sendStatus(501);', '});'),
    after: lines(
      "router.delete('/{{entity}}/:id', requireUser, async (req, res) => {",
      '  const result = await {{Model}}.deleteOne({ _id: req.params.id });',
      '  if (!result.deletedCount) return res.sendStatus(404);',
      '  res.sendStatus(204);',
      '});',
    ),
    issues: [{ match: '.deleteOne({ _id: req.params.id })', severity: 'high', problem: 'the query does not check ownership, so any logged-in user can delete another user\'s {{entity}}', fix: '`{{Model}}.deleteOne({ _id: req.params.id, owner: req.user.id })`' }],
    vars: { entity: ['notes', 'comments', 'drafts'], Model: ['Note', 'Comment', 'Draft'] },
  },
  {
    id: 'filter-async-predicate',
    path: 'src/services/{{svc}}.js',
    before: lines('export async function {{fn}}(users) {', '  return users;', '}'),
    after: lines('export async function {{fn}}(users) {', '  return users.filter(async (u) => await isActive(u.id));', '}'),
    issues: [{ match: 'users.filter(async', severity: 'high', problem: 'an async callback returns a Promise, which is always truthy, so `filter` keeps every user', fix: '`const flags = await Promise.all(users.map((u) => isActive(u.id))); return users.filter((_, i) => flags[i]);`' }],
    vars: { svc: ['billing', 'mailer', 'reports'], fn: ['activeUsers', 'billableUsers', 'recipients'] },
  },
  {
    id: 'indexof-zero-falsy',
    path: 'src/utils/{{file}}.js',
    before: lines('export function {{fn}}(list, item) {', '  return list;', '}'),
    after: lines('export function {{fn}}(list, item) {', '  const index = list.indexOf(item);', '  if (index) list.splice(index, 1);', '  return list;', '}'),
    issues: [{ match: 'if (index) list.splice', severity: 'medium', problem: '`indexOf` returns 0 for the first element and -1 when missing, so the first item is never removed and a missing item removes the last one', fix: '`if (index !== -1) list.splice(index, 1);`' }],
    vars: { file: ['cart', 'tags', 'queue'], fn: ['removeItem', 'removeTag', 'dequeue'] },
  },
  {
    id: 'mass-assignment-spread',
    path: 'src/routes/{{file}}.js',
    before: lines("router.post('/{{file}}', async (req, res) => {", '  res.sendStatus(501);', '});'),
    after: lines(
      "router.post('/{{file}}', async (req, res) => {",
      "  const user = await User.create({ role: 'member', verified: false, ...req.body });",
      '  res.status(201).json(user);',
      '});',
    ),
    issues: [{ match: '...req.body });', severity: 'high', problem: 'spreading `req.body` last lets a client send `role: \'admin\'` or `verified: true` and override the defaults', fix: "pick allowed fields: `const { email, name } = req.body; User.create({ email, name, role: 'member', verified: false })`" }],
    vars: { file: ['signup', 'users', 'register'] },
  },
  {
    id: 'jwt-expiresin-ms',
    path: 'src/auth/{{file}}.js',
    before: lines("import jwt from 'jsonwebtoken';", ''),
    after: lines("import jwt from 'jsonwebtoken';", '', 'export function issueToken(user) {', '  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: {{ms}} });', '}'),
    issues: [{ match: 'expiresIn: {{ms}}', severity: 'medium', problem: 'a numeric `expiresIn` is in seconds, not milliseconds, so the token lives 1000 times longer than intended', fix: "use a string: `{ expiresIn: '{{label}}' }`" }],
    vars: { file: ['tokens', 'session', 'login'], ms: ['3600000', '900000', '86400000'], label: ['1h', '15m', '1d'] },
  },
  {
    id: 'clean-map-delete',
    path: 'src/cache/{{file}}.js',
    before: lines('const entries = new Map();', '', 'export function lookup(key) {', '  return entries.get(key);', '}'),
    after: lines('const entries = new Map();', '', 'export function lookup(key) {', '  return entries.get(key);', '}', '', 'export function invalidate(key) {', '  entries.delete(key);', '}'),
    issues: [],
    vars: { file: ['sessions', 'prices', 'templates'] },
  },
  {
    id: 'clean-sha1-etag',
    path: 'src/http/{{fn}}.js',
    before: lines("import { createHash } from 'node:crypto';", ''),
    after: lines("import { createHash } from 'node:crypto';", '', 'export function {{fn}}(body) {', "  return createHash('sha1').update(body).digest('base64url');", '}'),
    issues: [],
    vars: { fn: ['etag', 'cacheKey', 'fingerprint'] },
  },
  {
    id: 'clean-batched-query-loop',
    path: 'scripts/backfill-{{table}}.js',
    before: lines('export async function backfill(db, ids) {', '  return ids.length;', '}'),
    after: lines(
      'export async function backfill(db, ids) {',
      '  for (let i = 0; i < ids.length; i += 500) {',
      "    await db.query('UPDATE {{table}} SET migrated = true WHERE id = ANY($1)', [ids.slice(i, i + 500)]);",
      '  }',
      '}',
    ),
    issues: [],
    vars: { table: ['orders', 'users', 'invoices'] },
  },
  {
    id: 'clean-test-fixture-readfilesync',
    path: 'test/helpers/{{file}}.js',
    before: lines("import { join } from 'node:path';", ''),
    after: lines(
      "import { readFileSync } from 'node:fs';",
      "import { join } from 'node:path';",
      '',
      "export const fixture = (name) => JSON.parse(readFileSync(join(import.meta.dirname, '..', 'fixtures', name), 'utf8'));",
    ),
    issues: [],
    vars: { file: ['fixtures', 'load', 'data'] },
  },
];
