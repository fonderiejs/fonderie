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
import { SCOPE_PREFIX } from './scope.mjs';

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
    // Only runtime SDK bricks belong in the brain. Skip anything that isn't a
    // @fonderie/* library: a different scope, OR tooling that ships a `bin`
    // (e.g. @fonderie/cli) — a bin package is a command, not a brick to import.
    if (!j.name.startsWith(SCOPE_PREFIX) || j.bin) continue;
    const name = j.name.replace(SCOPE_PREFIX, '');

    // Stability tier (roadmap P4): backend bricks must declare `fonderie.stability`
    // so the brain can tell load-bearing from experimental. Frontend mirrors
    // (react*/vue*) are uniformly early and default to 'beta'. Enforced here so a
    // new backend brick can't ship untiered.
    const isFrontend = /^(react|vue)/.test(name);
    const stability = j.fonderie?.stability ?? (isFrontend ? 'beta' : null);
    const STABILITY_TIERS = ['experimental', 'maturing', 'beta', 'stable'];
    if (!isFrontend && !stability) {
      throw new Error(
        `package ${name}: missing "fonderie.stability" in package.json — every backend brick must declare a tier (one of ${STABILITY_TIERS.join(', ')}). See docs/PORTFOLIO-ROADMAP.md P4.`,
      );
    }
    if (stability && !STABILITY_TIERS.includes(stability)) {
      throw new Error(`package ${name}: invalid fonderie.stability "${stability}" (expected one of ${STABILITY_TIERS.join(', ')}).`);
    }

    // `requires` is PEERS only, and stays that way: it answers "what must the
    // consumer install alongside this?", which is the question a peer range
    // exists to ask.
    const requires = Object.keys(j.peerDependencies || {})
      .filter((k) => k.startsWith(SCOPE_PREFIX))
      .map((k) => k.replace(SCOPE_PREFIX, ''));

    // `dependsOn` is the other question — what this package actually pulls in.
    // Recorded separately rather than folded into `requires`, because the edge
    // graph was built from peers alone and therefore showed NOTHING for the ~56
    // packages whose @fonderie deps are ordinary dependencies:
    // react-admin-screens really does depend on client, react-admin and two
    // screens packages, and not one of those four edges existed.
    const dependsOn = Object.keys(j.dependencies || {})
      .filter((k) => k.startsWith(SCOPE_PREFIX))
      .map((k) => k.replace(SCOPE_PREFIX, ''));

    // exports: top-level symbols re-exported from src/index.ts. `\s*` (not a
    // literal space) around the braces so this also matches Biome's multi-line
    // wrap of anything past the 100-char line width — a single-line-only regex
    // silently drops exports the moment a list gets long enough to wrap.
    const idx = read(join(pkgsDir, p, 'src/index.ts'));
    const exports = [
      ...new Set(
        [...idx.matchAll(/export\s*\{\s*([A-Za-z0-9_,\s]+)\s*\}\s*from/g)]
          .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean))
          // Headline symbols only (not every internal utility a package re-exports):
          // PascalCase (classes/modules/constants), or the useX hook/composable
          // naming convention used by the frontend packages.
          .filter((x) => /^([A-Z]|use[A-Z])/.test(x)),
      ),
    ];

    // outcomes: tables + routes (+ secures derived from middleware chains)
    const oc = read(join(sigDir, `${name}-outcomes.md`));
    const tables = [...oc.matchAll(/^### `([a-z0-9_]+)`/gm)].map((m) => m[1]);
    const routes = [];
    const secures = new Set();
    // The middleware cell is matched GREEDILY, to the last backtick before the
    // closing pipe. A handler containing a template literal puts backticks
    // INSIDE that cell; a `[^`]+` cell stops at the first of them, never finds
    // the trailing '` |', and drops the entire row — silently, because a regex
    // matching nothing is not an error. That cost 7 routes across 5 packages
    // before anyone noticed: media advertised 1 route and had 3.
    for (const m of oc.matchAll(/^\| (GET|POST|PUT|DELETE|PATCH) \| `([^`]+)` \| `(.+)` \|$/gm)) {
      const [, method, path, mw] = m;
      routes.push({ method, path, mw });
      if (/requireAuth|requireAnyAuth|withSession/.test(mw)) secures.add('auth');
      if (/ipLimit|acctLimit|rateLimit/.test(mw)) secures.add('rate-limit');
      if (/\bvalidate\(/.test(mw)) secures.add('validation');
      if (/verifyGate|requireVerified/.test(mw)) secures.add('verified-email');
    }
    // Anything SHAPED like a route row must have parsed. A doc scraper fails by
    // going quiet, so the only safe posture is to count what was skipped and
    // refuse to write a brain that is smaller than the truth.
    const rowsPresent = [...oc.matchAll(/^\| (?:GET|POST|PUT|DELETE|PATCH) \| /gm)].length;
    if (rowsPresent !== routes.length) {
      throw new Error(
        `package ${name}: ${rowsPresent} route rows in ${name}-outcomes.md, but only ` +
          `${routes.length} parsed. brain.json would under-report this package's routes — ` +
          `fix the row or the parser, do not ship the smaller number.`,
      );
    }

    // subpath exports (from the signatures doc header)
    // [a-z0-9-] on the LAST segment: '@fonderie/storage/s3' has a digit, and an
    // [a-z-] class dropped it without a word.
    const sig = read(join(sigDir, `${name}.md`));
    const subpaths = [...sig.matchAll(/`(@fonderie\/[a-z-]+\/[a-z0-9-]+)`/g)].map((m) => m[1]);

    out[name] = {
      version: j.version,
      stability,
      requires,
      dependsOn,
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
    // Real runtime deps, distinct from peers. Without these the graph claimed
    // react-admin-screens depended on nothing at all.
    for (const dep of p.dependsOn ?? []) edges.push({ from: name, to: dep, type: 'depends-on' });
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
