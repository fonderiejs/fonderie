#!/usr/bin/env node
// `fonderie brain query` — CLI over brain.json (BRAIN_PLAN.md Phase 1/2
// verification). Same ranking the MCP server uses (shared brain-lib.mjs), so
// this is a faithful check of what `brain serve` returns. No LLM.
//
//   node scripts/brain-query.mjs billing.subscriptions   # concept ID — deterministic, language-neutral
//   node scripts/brain-query.mjs "let people pay"        # free text — English keyword fallback only
//   node scripts/brain-query.mjs --concepts              # list all concept IDs
//   node scripts/brain-query.mjs --json "add team billing"

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrain, query, concept } from './brain-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brain = loadBrain(join(root, '.claude/skills/fonderie/brain.json'));

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
if (argv.includes('--concepts')) {
  for (const [id, c] of Object.entries(brain.concepts || {}).sort()) console.log(`  ${id} — ${c.description}`);
  process.exit(0);
}
const q = argv.filter((a) => !a.startsWith('--')).join(' ');
if (!q.trim()) { console.error('usage: brain-query.mjs [--json] <concept-id | "question">   (--concepts to list IDs)'); process.exit(2); }

function printRecipe(r) {
  console.log(`\n  recipe: ${r.name} — ${r.when}`);
  console.log(`  wire:   ${r.packages.join(' → ')}`);
  for (const inv of r.invariants) console.log(`  ⚠ ${inv}`);
}

// Concept-ID path (the MCP server's mechanism, minus the LLM that picks the
// ID): exact, language-neutral, nothing to miss.
const c = concept(brain, q.trim());
if (c) {
  if (asJson) { console.log(JSON.stringify(c, null, 2)); process.exit(0); }
  console.log(`${c.id} — ${c.description}\n`);
  console.log(`  @fonderie/${c.package.name}@${c.package.version}  requires:[${c.package.requires.join(', ') || '—'}]  ${c.package.exports.join(', ')}`);
  if (c.recipe) printRecipe(c.recipe);
  process.exit(0);
}

const result = query(brain, q);
if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
if (!result.packages.length) {
  console.log(`no keyword match for "${result.query}" — keyword search is English-only.`);
  console.log(`Use a concept ID instead (language-neutral): brain-query.mjs --concepts`);
  process.exit(0);
}

console.log(`Q: ${result.query}\n`);
for (const p of result.packages)
  console.log(`  @fonderie/${p.name}@${p.version}  requires:[${p.requires.join(', ') || '—'}]  ${p.exports.join(', ')}`);
if (result.recipe) printRecipe(result.recipe);
