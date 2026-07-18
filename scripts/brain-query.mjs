#!/usr/bin/env node
// `fonderie brain query` — CLI over brain.json (BRAIN_PLAN.md Phase 1/2
// verification). Same ranking the MCP server uses (shared brain-lib.mjs), so
// this is a faithful check of what `brain serve` returns. No LLM.
//
//   node scripts/brain-query.mjs "let people pay"
//   node scripts/brain-query.mjs --json "add team billing"

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrain, query } from './brain-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brain = loadBrain(join(root, '.claude/skills/fonderie/brain.json'));

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const q = argv.filter((a) => a !== '--json').join(' ');
if (!q.trim()) { console.error('usage: brain-query.mjs [--json] "<question>"'); process.exit(2); }

const result = query(brain, q);
if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
if (!result.packages.length) { console.log(`no match for "${result.query}"`); process.exit(0); }

console.log(`Q: ${result.query}\n`);
for (const p of result.packages)
  console.log(`  @fonderie/${p.name}@${p.version}  requires:[${p.requires.join(', ') || '—'}]  ${p.exports.join(', ')}`);
if (result.recipe) {
  console.log(`\n  recipe: ${result.recipe.name} — ${result.recipe.when}`);
  console.log(`  wire:   ${result.recipe.packages.join(' → ')}`);
  for (const inv of result.recipe.invariants) console.log(`  ⚠ ${inv}`);
}
