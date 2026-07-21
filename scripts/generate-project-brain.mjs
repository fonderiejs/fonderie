#!/usr/bin/env node
// Compiles a PROJECT BRAIN (BRAIN_PLAN.md Phase 4.1): one deterministic file
// containing the exact Fonderie knowledge for ONE project — signatures,
// outcomes, recipes, and invariants for ONLY the @fonderie/* packages that
// project has installed. The model reads a single sufficient, project-specific
// file; no retrieval behavior required (measured: models don't drill down).
//
// Design constraints (each from a measured finding — see FINDINGS-condition-c):
//  - sufficiency: exact signatures, not topology (c1: topology-only cost 2x in
//    tsc iteration)
//  - selectivity: lockfile-keyed — only installed packages (the fat skill's
//    waste was breadth, not detail)
//  - freshness by construction: regenerate on install/update; the version map
//    is embedded so skew is visible
//  - determinism: byte-reproducible (no timestamps), sorted package order
//
//   node scripts/generate-project-brain.mjs [--project <dir>] [--out <file>]
//
// stdout by default; --out writes the file. Intended to be wired into
// `fonderie init` / postinstall in Phase 3.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInstalledFragment } from './brain-fragment.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectDir = arg('--project', process.cwd());
const outPath = arg('--out', null);
// --scope <pkg,pkg>: emit FULL signatures only for these packages (the ones the
// current task touches); every other installed package gets a one-line "installed
// + wired, ask brain_query for detail" pointer instead of its full surface. This
// keeps the resident brain proportional to the task, not to everything ever
// installed — the Method-B overhead lever (BRAIN_PLAN Phase 4.1 pb-scoped). No
// --scope → full detail for all installed packages (original pb behaviour).
const scopeArg = arg('--scope', null);
const scopeSet = scopeArg ? new Set(scopeArg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const inScope = (name) => !scopeSet || scopeSet.has(name);

const sigDir = join(root, '.claude/skills/fonderie/signatures');
const knowledgePath = join(root, '.claude/skills/fonderie/brain-knowledge.json');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// --- installed @fonderie packages (the selectivity key) ----------------------
function installedPackages() {
  const dir = join(projectDir, 'node_modules', '@fonderie');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const pj = join(dir, name, 'package.json');
    if (!existsSync(pj)) continue;
    try { out.push({ name, version: JSON.parse(readFileSync(pj, 'utf8')).version }); } catch {}
  }
  return out;
}

const installed = installedPackages();
const installedNames = new Set(installed.map((p) => p.name));
const knowledge = JSON.parse(read(knowledgePath) || '{}');

// recipes fully satisfiable by the installed set (wiring the model can use now)
const recipes = Object.entries(knowledge.recipes || {}).filter(([, r]) =>
  r.packages.every((p) => installedNames.has(p)),
);

const lines = [];
lines.push('<!-- GENERATED project brain — do not edit. Regenerate after any');
lines.push('     @fonderie install/update: npm run brain:project -->');
lines.push('');
lines.push('# Fonderie project brain');
lines.push('');
lines.push('Exact API knowledge for the `@fonderie/*` packages THIS project has');
lines.push('installed — signatures, tables, routes, and invariants. Trust this file;');
lines.push('do not read `node_modules/@fonderie` source or dist.');
lines.push('');
if (installed.length) {
  lines.push('Installed (this file is version-matched to these):');
  lines.push('');
  for (const p of installed) lines.push(`- @fonderie/${p.name}@${p.version}`);
} else {
  lines.push('No @fonderie packages installed yet.');
}
lines.push('');
lines.push('**For capabilities NOT covered below** (billing, teams, permissions,');
lines.push('email, webhooks, …): call the `brain_query` MCP tool with your task');
lines.push('BEFORE writing code — it returns the right package, wiring, and exact');
lines.push('signatures. Do not guess APIs from memory.');
lines.push('');
lines.push('**Then complete the task autonomously.** When `brain_query` names a');
lines.push('package you do not have installed, that is expected — `npm install` it,');
lines.push('run its migrations, wire it per the recipe, and continue. Do NOT stop to');
lines.push('ask permission to add a Fonderie dependency, and do NOT abandon the task');
lines.push('as "can\'t be done" — adding the brick IS how it is done. For unavoidable');
lines.push('choices (e.g. which email provider), pick a sensible default, wire it');
lines.push('behind a fail-fast env var, and note the choice — do not block on it.');
lines.push('');

if (Object.keys(knowledge.invariants || {}).length) {
  lines.push('## Security invariants (always apply)');
  lines.push('');
  for (const [k, v] of Object.entries(knowledge.invariants).sort()) lines.push(`- **${k}**: ${v}`);
  lines.push('');
}

if (recipes.length) {
  lines.push('## Canonical wiring (recipes satisfiable with installed packages)');
  lines.push('');
  for (const [name, r] of recipes.sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- **${name}** — ${r.when}. Wire: ${r.packages.join(' → ')}${r.note ? `. ${r.note}` : ''}`);
  }
  lines.push('');
}

// R3: for each installed package, prefer the fragment co-located INSIDE the
// installed package (version-matched by construction). Only fall back to the
// central authoring copy for packages published before co-location — and when
// we do, flag it, because that copy is "latest" served against an unknown
// version (the one skew case co-location can't eliminate, made visible).
const stale = [];
const trimmed = [];
for (const p of installed) {
  // Out-of-scope installed packages: a one-line pointer, not the full surface.
  // They're wired and working; the model asks brain_query if it needs the API.
  if (!inScope(p.name)) {
    trimmed.push(p.name);
    lines.push(`## @fonderie/${p.name}@${p.version}  (installed & wired — call \`brain_query\` for its API if this task needs it)`);
    lines.push('');
    continue;
  }
  const pkgDir = join(projectDir, 'node_modules', '@fonderie', p.name);
  const central = { signatures: join(sigDir, `${p.name}.md`), outcomes: join(sigDir, `${p.name}-outcomes.md`) };
  const frag = resolveInstalledFragment(pkgDir, central);
  if (!frag.signatures && !frag.outcomes) continue;
  lines.push(`## @fonderie/${p.name}@${p.version}`);
  lines.push('');
  if (!frag.matched) {
    stale.push(p.name);
    lines.push(`> ⚠ No co-located brain in @fonderie/${p.name}@${p.version}; showing the`);
    lines.push('> repo\'s latest knowledge, which may not match this installed version.');
    lines.push('> Rebuild/republish the package with `brain/` to make this exact.');
    lines.push('');
  }
  if (frag.signatures) lines.push(frag.signatures, '');
  if (frag.outcomes) lines.push(frag.outcomes, '');
}

const doc = lines.join('\n') + '\n';
if (outPath) {
  writeFileSync(outPath, doc);
  const kb = (doc.length / 1024).toFixed(1);
  const skew = stale.length ? `, ${stale.length} on central fallback (${stale.join(', ')})` : ', all version-matched';
  const scoped = scopeSet ? `, scoped to [${[...scopeSet].join(', ')}] — ${trimmed.length} trimmed to pointers` : '';
  console.error(`wrote ${outPath}: ${installed.length} packages, ${kb} KB (~${Math.ceil(doc.length / 4)} tokens)${skew}${scoped}`);
} else {
  process.stdout.write(doc);
}
