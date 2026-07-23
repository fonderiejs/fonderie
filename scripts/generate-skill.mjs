#!/usr/bin/env node
// Compiles a LAZY skill (PLAN-SKILLS-CLI.md): the three-layer pattern the
// industry converged on. Instead of one eager CLAUDE.md carrying every installed
// package's signatures every turn, emit:
//
//   <out>/SKILL.md            — the ROUTER: frontmatter + a concept→body table +
//                               the always-apply security invariants. Small,
//                               always resident (~a few hundred tokens).
//   <out>/fonderie/<pkg>.md   — per-package BODY (signatures + outcomes). Loaded
//                               LAZILY: the agent reads it only when the task
//                               touches that package.
//
// Load scales with what the agent does, not with what it might do. Same
// knowledge as the project brain, sliced so it arrives on demand.
//
//   node scripts/generate-skill.mjs [--project <dir>] --out <skills-dir>
//
// --project keys the router to the project's INSTALLED packages (like the brain);
// with no project it emits the full catalogue.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCOPE, SCOPE_PREFIX } from './scope.mjs';
import { resolveInstalledFragment } from './brain-fragment.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectDir = arg('--project', null);
const outDir = arg('--out', null);
if (!outDir) { console.error('usage: generate-skill.mjs [--project <dir>] --out <skills-dir>'); process.exit(2); }

const sigDir = join(root, '.claude/skills/fonderie/signatures');
const knowledge = JSON.parse(readFileSync(join(root, '.claude/skills/fonderie/brain-knowledge.json'), 'utf8'));
const cliBin = `node ${join(root, 'scripts/brain-query.mjs')}`;

// installed packages (router scopes to these when a project is given)
function installed() {
  if (!projectDir) return null;
  const dir = join(projectDir, 'node_modules', SCOPE);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().filter((n) => existsSync(join(dir, n, 'package.json')))
    .map((n) => ({ name: n, version: JSON.parse(readFileSync(join(dir, n, 'package.json'), 'utf8')).version }));
}
const inst = installed();
const instNames = inst && new Set(inst.map((p) => p.name));

// concept → package, from the curated layer (the routing table)
const concepts = Object.entries(knowledge.concepts || {});
// every package that has a body to emit
const allPkgs = [...new Set(concepts.map(([, c]) => c.package))].sort();

mkdirSync(join(outDir, 'fonderie'), { recursive: true });

// --- per-package BODIES (lazy) ----------------------------------------------
const bodyFor = (pkg) => {
  // prefer co-located installed fragment (version-matched); else central
  const central = { signatures: join(sigDir, `${pkg}.md`), outcomes: join(sigDir, `${pkg}-outcomes.md`) };
  const pkgDir = projectDir ? join(projectDir, 'node_modules', SCOPE, pkg) : '';
  const frag = resolveInstalledFragment(pkgDir, central);
  if (!frag.signatures && !frag.outcomes) return null;
  return [`# ${SCOPE}/${pkg}`, '', frag.signatures || '', frag.outcomes ? '\n' + frag.outcomes : ''].join('\n');
};
let bodies = 0;
for (const pkg of allPkgs) {
  const body = bodyFor(pkg);
  if (!body) continue;
  writeFileSync(join(outDir, 'fonderie', `${pkg}.md`), body.trim() + '\n');
  bodies++;
}

// --- ROUTER SKILL.md (always resident, small) -------------------------------
const L = [];
L.push('---');
L.push('name: fonderie');
L.push('description: Building or modifying a SaaS backend — auth/login/sessions, teams/workspaces, billing/Stripe, roles/permissions, email/SMS, feature flags, audit logs, webhooks, or wiring an API route. Reach for a @fonderie brick instead of hand-writing it.');
L.push('---');
L.push('');
L.push('# Fonderie — router');
L.push('');
L.push('Do not hand-write auth, billing, teams, permissions, email, webhooks, rate');
L.push('limiting, or config. Use the audited `@fonderie/*` brick. This file is a');
L.push('router: for the capability your task needs, **read only that package\'s body**');
L.push('below — do not load them all.');
L.push('');
if (inst) {
  L.push(`Installed here: ${inst.length ? inst.map((p) => `\`${SCOPE}/${p.name}@${p.version}\``).join(', ') : 'none yet'}.`);
  L.push('');
}
L.push('## Capability → read this / or run this');
L.push('');
L.push('| Task needs… | Package | Read (installed) | Or discover (any) |');
L.push('| --- | --- | --- | --- |');
for (const [id, c] of concepts) {
  const here = inst && instNames.has(c.package);
  const readCol = here ? `\`fonderie/${c.package}.md\`` : '— (not installed)';
  L.push(`| ${c.description} | \`${c.package}\` | ${readCol} | \`${cliBin} ${id}\` |`);
}
L.push('');
L.push('**Not installed?** Run the discover command — it names the package + recipe.');
L.push('Then `npm install @fonderie/<pkg>`, run its migrations, wire it, and continue.');
L.push('Do NOT stop to ask permission or abandon the task; adding the brick IS the task.');
L.push('Pick sensible defaults for provider/config choices behind fail-fast env vars.');
L.push('');
L.push('## Definition of done — you do NOT need a database to build');
L.push('');
L.push('A Fonderie app is **done** when it **typechecks** (`tsc` clean) and each');
L.push('capability is **wired per its recipe**. The bricks are audited and own their');
L.push('schema — migrations ship inside the package and run automatically on boot,');
L.push('and each route is guaranteed by the package. (Confirmed: a typecheck-clean');
L.push('wired app boots, self-migrates, and serves the brick routes with no glue.)');
L.push('');
L.push('While building: do NOT provision a database (no `docker run`/`initdb`) and do');
L.push('NOT boot the app to "check it works" — a clean typecheck + correct wiring IS');
L.push('the check. Running it is a separate, optional step done later with a real');
L.push('`DATABASE_URL`. The tables each brick creates are in its body — read them.');
L.push('');
// security invariants — small, always apply → stay in the router
if (Object.keys(knowledge.invariants || {}).length) {
  L.push('## Security invariants (always apply)');
  L.push('');
  for (const [k, v] of Object.entries(knowledge.invariants).sort()) L.push(`- **${k}**: ${v}`);
  L.push('');
}

writeFileSync(join(outDir, 'SKILL.md'), L.join('\n') + '\n');
const routerTok = Math.ceil(L.join('\n').length / 4);
console.error(`wrote ${outDir}/SKILL.md (router ~${routerTok} tok, always resident) + ${bodies} lazy bodies in fonderie/`);
