#!/usr/bin/env node
// D3 — control-matrix drift guard (SOC 2 CC4.1). Every repo-path cited as
// evidence in docs/soc2/control-matrix.md must exist, so the matrix can't
// silently reference deleted/renamed files. Tolerates the matrix's `src/`-
// omitted shorthand and skips globs / bare-dir / non-path tokens.
import { readFileSync, existsSync } from 'node:fs';

const matrix = 'docs/soc2/control-matrix.md';
if (!existsSync(matrix)) {
	// The control matrix moved to the private fonderiejs/fonderie-compliance
	// repo (2026-08-21); this guard runs there against the matrix. Nothing to
	// check in the public repo.
	console.log(`check:evidence — ${matrix} not present in this repo; skipping.`);
	process.exit(0);
}
const text = readFileSync(matrix, 'utf8');
const tokens = [...text.matchAll(/`((?:packages|\.github|docs)\/[^`]+)`/g)].map((m) => m[1]);

const missing = [];
for (const tok of [...new Set(tokens)]) {
  if (tok.includes('*') || tok.endsWith('/')) continue; // globs / dir refs — skip
  const candidates = [tok];
  const m = tok.match(/^packages\/([^/]+)\/(.+)$/);
  if (m && !tok.includes('/src/')) candidates.push(`packages/${m[1]}/src/${m[2]}`);
  if (!candidates.some((c) => existsSync(c))) missing.push(tok);
}

if (missing.length) {
  console.error(`[check-evidence] ${missing.length} control-matrix evidence path(s) missing:`);
  for (const m of missing) console.error(`  - ${m}`);
  console.error('Fix the path in docs/soc2/control-matrix.md, or restore the file.');
  process.exit(1);
}
console.log(`[check-evidence] OK — all ${tokens.length} control-matrix evidence paths resolve.`);
