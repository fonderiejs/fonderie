#!/usr/bin/env node
// Regenerates packages/cli/data/knowledge.json from the curated
// brain-knowledge.json (concepts/recipes/invariants only). Run in docs:brain;
// CI enforces freshness with git diff so the shipped CLI can't drift from source.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const k = JSON.parse(readFileSync(join(root, '.claude/skills/fonderie/brain-knowledge.json'), 'utf8'));
writeFileSync(join(root, 'packages/cli/data/knowledge.json'),
  JSON.stringify({ concepts: k.concepts, recipes: k.recipes, invariants: k.invariants }, null, 2) + '\n');
console.log('wrote packages/cli/data/knowledge.json');
