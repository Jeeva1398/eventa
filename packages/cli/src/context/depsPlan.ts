import { upgradeNote } from '../prompts/upgrades.js';
import { type DepsReport, fixPlan } from './deps.js';

const SEVERITY_RANK = ['critical', 'high', 'moderate', 'low', 'info'];

export function buildPlan(r: DepsReport): string {
  const sections: string[] = [];
  const byName = new Map(r.vulnerabilities.map((v) => [v.name, v]));

  if (r.vulnerabilities.length) {
    const items = fixPlan(r.vulnerabilities).map(({ command, fixes }) => {
      const vulns = fixes.map((n) => byName.get(n)!);
      const worst = vulns.map((v) => v.severity).sort((a, b) => SEVERITY_RANK.indexOf(a) - SEVERITY_RANK.indexOf(b))[0];
      const titles = vulns.map((v) => `${v.name}: ${v.title ?? 'advisory'}`).join('; ');
      if (command === 'no fix available') return `- **No fix available** (${worst}): ${titles}. Replace the package or check whether the vulnerable code is reachable.`;
      const major = command.endsWith('(major)');
      return `- \`${command.replace(' (major)', '')}\`${major ? ' **(major version, see notes below)**' : ''} (${worst}): ${titles}.`;
    });
    sections.push(`**1. Security**\n${items.join('\n')}`);
  }

  const majors = r.outdated.filter((o) => o.major);
  if (majors.length) {
    const items = majors.map((o) => {
      const note = upgradeNote(o.name, o.latest);
      return `- **${o.name} ${o.current ?? '?'} → ${o.latest}**: ${note ?? 'no verified notes. Read its changelog / release notes before upgrading.'}`;
    });
    sections.push(`**2. Major upgrades**\n${items.join('\n')}`);
  }

  const cleanup: string[] = [];
  if (r.unused.length) cleanup.push(`- \`npm uninstall ${r.unused.join(' ')}\`: not imported anywhere (double-check config files, scripts and dynamic requires first).`);
  if (r.missing.length) cleanup.push(`- \`npm install ${r.missing.join(' ')}\`: imported in code but missing from package.json.`);
  const minors = r.outdated.filter((o) => !o.major);
  if (minors.length) cleanup.push(`- \`npm update\`: safe minor/patch updates for ${minors.map((m) => m.name).join(', ')}.`);
  if (cleanup.length) sections.push(`**3. Cleanup**\n${cleanup.join('\n')}`);

  return sections.join('\n\n');
}
