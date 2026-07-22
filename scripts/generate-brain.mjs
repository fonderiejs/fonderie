#!/usr/bin/env node
// Builds .claude/skills/fonderie/brain.json — the shipped, versioned knowledge
// graph of the Fonderie SDK (BRAIN_PLAN.md Phase 1). Structural spine is
// extracted from source (package.json peerDependencies, the generated
// signatures/ + *-outcomes.md), then fused with the curated R2 layer
// (brain-knowledge.json: aliases, recipes, invariants). Zero LLM calls.
//
// Run via `npm run docs:brain`. Freshness enforced in CI with git diff.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sigDir = join(root, '.claude/skills/fonderie/signatures');
const pkgsDir = join(root, 'packages');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- structural extraction (per package) ------------------------------------
function extractPackages() {
  const out = {};
  for (const p of readdirSync(pkgsDir)) {
    const pj = join(pkgsDir, p, 'package.json');
    if (!existsSync(pj)) continue;
    const j = JSON.parse(readFileSync(pj, 'utf8'));
    // Only the SDK bricks (@fonderie/*) belong in the brain. Skip tooling like
    // @fonderie/cli — a different scope, not a runtime package.
    if (!j.name.startsWith('@fonderie/')) continue;
    const name = j.name.replace('@fonderie/', '');
    const requires = Object.keys(j.peerDependencies || {})
      .filter((k) => k.startsWith('@fonderie/'))
      .map((k) => k.replace('@fonderie/', ''));

    // exports: top-level symbols re-exported from src/index.ts
    const idx = read(join(pkgsDir, p, 'src/index.ts'));
    const exports = [
      ...new Set(
        [...idx.matchAll(/export \{ ([A-Za-z0-9_,\s]+) \} from/g)]
          .flatMap((m) => m[1].split(',').map((s) => s.trim()))
          .filter((x) => /^[A-Z]/.test(x)),
      ),
    ];

    // outcomes: tables + routes (+ secures derived from middleware chains)
    const oc = read(join(sigDir, `${name}-outcomes.md`));
    const tables = [...oc.matchAll(/^### `([a-z0-9_]+)`/gm)].map((m) => m[1]);
    const routes = [];
    const secures = new Set();
    for (const m of oc.matchAll(/^\| (GET|POST|PUT|DELETE|PATCH) \| `([^`]+)` \| `([^`]+)` \|/gm)) {
      const [, method, path, mw] = m;
      routes.push({ method, path, mw });
      if (/requireAuth|requireAnyAuth|withSession/.test(mw)) secures.add('auth');
      if (/ipLimit|acctLimit|rateLimit/.test(mw)) secures.add('rate-limit');
      if (/\bvalidate\(/.test(mw)) secures.add('validation');
      if (/verifyGate|requireVerified/.test(mw)) secures.add('verified-email');
    }

    // subpath exports (from the signatures doc header)
    const sig = read(join(sigDir, `${name}.md`));
    const subpaths = [...sig.matchAll(/`(@fonderie\/[a-z-]+\/[a-z-]+)`/g)].map((m) => m[1]);

    out[name] = {
      version: j.version,
      requires,
      exports,
      subpaths: [...new Set(subpaths)],
      tables,
      routeCount: routes.length,
      routes,
      secures: [...secures],
      hasSignature: sig.length > 0,
      hasOutcomes: oc.length > 0,
    };
  }
  return out;
}

// --- edges (requires + secures) ---------------------------------------------
function buildEdges(pkgs) {
  const edges = [];
  for (const [name, p] of Object.entries(pkgs)) {
    for (const dep of p.requires) edges.push({ from: name, to: dep, type: 'requires' });
    for (const s of p.secures) if (s !== 'validation' && s !== 'verified-email') edges.push({ from: name, to: s, type: 'secures-with' });
  }
  return edges;
}

// --- assemble ----------------------------------------------------------------
const knowledge = JSON.parse(read(join(root, '.claude/skills/fonderie/brain-knowledge.json')));
delete knowledge._comment;
const packages = extractPackages();
const edges = buildEdges(packages);

// build a flat search index: term -> packages (alias layer + package names + exports)
const index = {};
const add = (term, pkg) => {
  const k = term.toLowerCase();
  (index[k] ||= new Set()).add(pkg);
};
for (const name of Object.keys(packages)) add(name, name);
for (const [pkg, terms] of Object.entries(knowledge.aliases || {}))
  for (const t of terms) add(t, pkg);
for (const [pkg, p] of Object.entries(packages))
  for (const e of p.exports) add(e, pkg);

// R2 concept layer: every concept must point at a real package (and recipe,
// when named) — a dangling ref would make the enum route the model nowhere.
for (const [id, c] of Object.entries(knowledge.concepts || {})) {
  if (!packages[c.package]) throw new Error(`concept ${id}: unknown package "${c.package}"`);
  if (c.recipe && !knowledge.recipes[c.recipe]) throw new Error(`concept ${id}: unknown recipe "${c.recipe}"`);
}

const brain = {
  schema: 1,
  // No wall-clock stamp here: brain.json must be byte-reproducible from source
  // so the CI freshness gate (git diff --exit-code) is deterministic across
  // days. sdkVersions is the real freshness signal.
  sdkVersions: Object.fromEntries(Object.entries(packages).map(([n, p]) => [n, p.version])),
  packages,
  edges,
  index: Object.fromEntries(Object.entries(index).map(([k, v]) => [k, [...v]])),
  aliases: knowledge.aliases,
  concepts: knowledge.concepts || {},
  recipes: knowledge.recipes,
  invariants: knowledge.invariants,
};

const outPath = join(root, '.claude/skills/fonderie/brain.json');
writeFileSync(outPath, JSON.stringify(brain, null, 2) + '\n');

const nEdges = edges.length;
const nIndex = Object.keys(index).length;
console.log(
  `wrote brain.json: ${Object.keys(packages).length} packages, ${nEdges} edges, ` +
    `${nIndex} index terms, ${Object.keys(knowledge.concepts || {}).length} concepts, ` +
    `${Object.keys(knowledge.recipes).length} recipes, ` +
    `${Object.keys(knowledge.invariants).length} invariants`,
);
