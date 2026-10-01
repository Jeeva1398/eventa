import { describe, expect, it } from 'vitest';
import { breaking, type DepsReport } from '../src/context/deps.js';
import { buildPlan } from '../src/context/depsPlan.js';
import { upgradeNote } from '../src/prompts/upgrades.js';

const report: DepsReport = {
  vulnerabilities: [
    { name: 'qs', severity: 'high', title: 'qs vulnerable to Prototype Pollution', fix: 'npm install express@4.22.3' },
    { name: 'express', severity: 'moderate', title: 'Open Redirect', fix: 'npm install express@4.22.3' },
    { name: 'ip', severity: 'high', title: 'ip SSRF' },
  ],
  outdated: [
    { name: 'express', current: '4.17.1', wanted: '4.22.3', latest: '5.2.1', major: true },
    { name: 'left-pad', current: '1.0.0', wanted: '1.0.0', latest: '2.0.0', major: true },
    { name: 'dotenv', current: '16.3.1', wanted: '16.5.0', latest: '16.5.0', major: false },
  ],
  unused: ['moment'],
  missing: ['zod'],
};

describe('deps plan', () => {
  it('groups fixes with the worst severity and keeps commands exact', () => {
    const plan = buildPlan(report);
    expect(plan).toContain('- `npm install express@4.22.3` (high): qs: qs vulnerable to Prototype Pollution; express: Open Redirect.');
    expect(plan).toContain('**No fix available** (high): ip: ip SSRF.');
  });

  it('uses verified notes and never guesses for unknown packages', () => {
    const plan = buildPlan(report);
    expect(plan).toContain('**express 4.17.1 → 5.2.1**: Express 5 uses path-to-regexp v8');
    expect(plan).toContain('**left-pad 1.0.0 → 2.0.0**: no verified notes. Read its changelog');
  });

  it('lists cleanup commands and safe updates', () => {
    const plan = buildPlan(report);
    expect(plan).toContain('`npm uninstall moment`');
    expect(plan).toContain('`npm install zod`');
    expect(plan).toContain('safe minor/patch updates for dotenv');
  });

  it('finds notes by target major, then by package name', () => {
    expect(upgradeNote('express', '5.2.1')).toMatch(/Express 5/);
    expect(upgradeNote('express', '6.0.0')).toBeUndefined();
    expect(upgradeNote('dotenv', '17.0.0')).toMatch(/Low risk/);
  });

  it('treats 0.x minor bumps as breaking', () => {
    expect(breaking('0.13.2', '0.14.2')).toBe(true);
    expect(breaking('0.14.1', '0.14.2')).toBe(false);
    expect(breaking('4.17.20', '4.18.1')).toBe(false);
    expect(breaking('4.17.1', '5.0.0')).toBe(true);
  });
});
