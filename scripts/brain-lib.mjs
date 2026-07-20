// Shared query logic over brain.json — the single source of truth used by both
// the CLI (scripts/brain-query.mjs, the verification tool) and the MCP server
// (scripts/brain-serve.mjs). Keeping ranking in one place means the CLI verifies
// exactly what the server serves. Zero dependencies, no LLM.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function loadBrain(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Rank packages for a phrase: sum over index terms that occur as substrings,
// weighting longer (more specific) terms higher.
export function query(brain, q) {
  q = String(q || '').toLowerCase().trim();
  const score = {};
  for (const [term, pkgs] of Object.entries(brain.index)) {
    if (q.includes(term)) for (const p of pkgs) score[p] = (score[p] || 0) + term.length;
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([p]) => p);

  let best = null, bestOverlap = 0;
  for (const [name, r] of Object.entries(brain.recipes)) {
    const overlap = r.packages.filter((p) => ranked.includes(p)).length;
    if (overlap > bestOverlap) { bestOverlap = overlap; best = { name, ...r }; }
  }

  return {
    query: q,
    packages: ranked.slice(0, 3).map((p) => ({
      name: p,
      version: brain.packages[p]?.version,
      requires: brain.packages[p]?.requires || [],
      exports: (brain.packages[p]?.exports || []).slice(0, 4),
    })),
    recipe: best && {
      name: best.name,
      when: best.when,
      packages: best.packages,
      invariants: (best.invariants || []).map((i) => brain.invariants[i]).filter(Boolean),
    },
  };
}

// R2 concept-enum path (BRAIN_PLAN.md "R2 update"): deterministic lookup, no
// ranking, nothing to miss. The intent→concept mapping happens in the caller's
// tool call (the model picks an enum value); this function only resolves it.
export function concept(brain, id) {
  const c = (brain.concepts || {})[id];
  if (!c) return null;
  const p = brain.packages[c.package];
  return {
    id,
    description: c.description,
    package: {
      name: c.package,
      version: p?.version,
      requires: p?.requires || [],
      exports: (p?.exports || []).slice(0, 4),
    },
    recipe: c.recipe ? recipe(brain, c.recipe) : null,
  };
}

export function node(brain, id) {
  const p = brain.packages[id];
  if (!p) return null;
  const edges = brain.edges.filter((e) => e.from === id || e.to === id);
  return { name: id, ...p, edges };
}

export function recipe(brain, name) {
  const r = brain.recipes[name];
  if (!r) return null;
  return { name, ...r, invariants: (r.invariants || []).map((i) => brain.invariants[i]).filter(Boolean) };
}

// R3: compare the served brain's SDK versions against what's actually installed
// in the consuming project. Returns { matched, mismatches[] }. mismatches are
// packages whose installed version differs from the brain, or that the brain
// doesn't know. Missing-from-project packages are ignored (app may not use them).
export function versionCheck(brain, projectDir) {
  const mismatches = [];
  for (const [name, brainVer] of Object.entries(brain.sdkVersions || {})) {
    const pj = join(projectDir, 'node_modules', '@fonderie', name, 'package.json');
    if (!existsSync(pj)) continue; // not installed → not relevant to this app
    let installed;
    try { installed = JSON.parse(readFileSync(pj, 'utf8')).version; } catch { continue; }
    if (installed !== brainVer) mismatches.push({ pkg: name, brain: brainVer, installed });
  }
  return { matched: mismatches.length === 0, mismatches };
}
