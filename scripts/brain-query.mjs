#!/usr/bin/env node
// Minimal query over brain.json (BRAIN_PLAN.md Phase 1 verification for
// `fonderie brain query`). Ranks packages for a natural-language phrase using
// the alias index + recipe match, then prints a compact slice: the package(s),
// how they wire (requires), the matching recipe, and its invariants. No LLM.
//
//   node scripts/brain-query.mjs "let people pay"
//   node scripts/brain-query.mjs --json "add team billing"

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brain = JSON.parse(readFileSync(join(root, '.claude/skills/fonderie/brain.json'), 'utf8'));

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const q = argv.filter((a) => a !== '--json').join(' ').toLowerCase().trim();
if (!q) { console.error('usage: brain-query.mjs [--json] "<question>"'); process.exit(2); }

// score packages: sum over index terms that appear as substrings of the query,
// weighting longer (more specific) terms higher.
const score = {};
for (const [term, pkgs] of Object.entries(brain.index)) {
  if (q.includes(term)) for (const p of pkgs) score[p] = (score[p] || 0) + term.length;
}
const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([p]) => p);

// best recipe: most package-overlap with the ranked set, tie-break by rank order
let bestRecipe = null, bestOverlap = 0;
for (const [name, r] of Object.entries(brain.recipes)) {
  const overlap = r.packages.filter((p) => ranked.includes(p)).length;
  if (overlap > bestOverlap) { bestOverlap = overlap; bestRecipe = { name, ...r }; }
}

const primary = ranked.slice(0, 3);
const result = {
  query: q,
  packages: primary.map((p) => ({
    name: p,
    version: brain.packages[p]?.version,
    requires: brain.packages[p]?.requires || [],
    exports: (brain.packages[p]?.exports || []).slice(0, 4),
  })),
  recipe: bestRecipe && {
    name: bestRecipe.name,
    when: bestRecipe.when,
    packages: bestRecipe.packages,
    invariants: (bestRecipe.invariants || []).map((i) => brain.invariants[i]).filter(Boolean),
  },
};

if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
if (!primary.length) { console.log(`no match for "${q}"`); process.exit(0); }

console.log(`Q: ${q}\n`);
for (const p of result.packages)
  console.log(`  @fonderie/${p.name}@${p.version}  requires:[${p.requires.join(', ') || '—'}]  ${p.exports.join(', ')}`);
if (result.recipe) {
  console.log(`\n  recipe: ${result.recipe.name} — ${result.recipe.when}`);
  console.log(`  wire:   ${result.recipe.packages.join(' → ')}`);
  for (const inv of result.recipe.invariants) console.log(`  ⚠ ${inv}`);
}
