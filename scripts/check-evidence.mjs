#!/usr/bin/env node
// D3 — control-matrix drift guard (SOC 2 CC4.1). Every repo-path cited as
// evidence in docs/soc2/control-matrix.md must exist, so the matrix can't
// silently reference deleted/renamed files. Tolerates the matrix's `src/`-
// omitted shorthand and skips globs / bare-dir / non-path tokens.
import { readFileSync, existsSync } from 'node:fs';

// The matrix lives in the private fonderiejs/fonderie-compliance repo since
// 2026-08-21. Set this to a local copy (fetched in CI) to restore the guard;
// the check itself is unchanged, it just reads from somewhere else.
const matrix = process.env['FONDERIE_CONTROL_MATRIX'] || 'docs/soc2/control-matrix.md';
if (!existsSync(matrix)) {
	// NOT a pass. The matrix moved to fonderiejs/fonderie-compliance
	// (2026-08-21) and an earlier version of this comment claimed "this guard
	// runs there against the matrix" — it does not. That repo has no workflows
	// at all, and it does not contain the code the matrix cites. So the control
	// is unguarded on BOTH sides and has been since the move.
	//
	// Exits 0 deliberately: a private file missing from the public repo must not
	// redden everyone's CI. But it says so plainly, because the failure this
	// whole script exists to catch is a check that looks like it ran.
	console.warn(`check:evidence — NOT RUNNING. ${matrix} is absent.`);
	console.warn('  The SOC 2 control-matrix drift guard (CC4.1) is currently enforced');
	console.warn('  by nobody: the matrix is in fonderiejs/fonderie-compliance, the code');
	console.warn('  it cites is here, and neither repo checks the pair.');
	console.warn('  To restore: fetch the matrix in CI and set FONDERIE_CONTROL_MATRIX.');
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
