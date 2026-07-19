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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectDir = arg('--project', process.cwd());
const outPath = arg('--out', null);

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

for (const p of installed) {
  const sig = read(join(sigDir, `${p.name}.md`));
  const oc = read(join(sigDir, `${p.name}-outcomes.md`));
  if (!sig && !oc) continue;
  lines.push(`## @fonderie/${p.name}@${p.version}`);
  lines.push('');
  if (sig) lines.push(sig.trim(), '');
  if (oc) lines.push(oc.trim(), '');
}

const doc = lines.join('\n') + '\n';
if (outPath) {
  writeFileSync(outPath, doc);
  const kb = (doc.length / 1024).toFixed(1);
  console.error(`wrote ${outPath}: ${installed.length} packages, ${kb} KB (~${Math.ceil(doc.length / 4)} tokens)`);
} else {
  process.stdout.write(doc);
}
