#!/usr/bin/env node
// Catalog-coverage gate.
//
// A brick that ships a brain/ fragment but has no catalog concept is invisible:
// `fonderie query --concepts` never names it, so an agent can install every
// brick correctly and still hand-roll the capability — the exact failure the
// dogfood surfaced before the blind-spot fix (#717). The fragment tells the
// agent how the brick works; the concept is what makes it discoverable. This
// gate fails the PR that adds one without the other.
//
// Allow-list: packages that ship a fragment but are plumbing, not capabilities
// — nobody asks the catalog "how do I do the client", they ask for a feature
// whose recipe pulls the client in.
//   client — the isomorphic API client every server brick's recipe wires up
//   react, vue — the shared framework context the react-*/vue-* hooks resolve
//
// Also checked in reverse: a concept pointing at a package that does not exist
// sends the agent to install nothing.
//
// Reads packages/cli/data/knowledge.json — the shipped artifact, kept fresh by
// the docs:brain diff gate that runs earlier in this job.
//
// Run: npm run check:catalog-coverage
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');

const knowledge = JSON.parse(readFileSync(join(packagesDir, 'cli/data/knowledge.json'), 'utf8'));
const concepts = knowledge.concepts || {};

// Plumbing, not capabilities — see the header comment.
const PLUMBING = new Set(['client', 'react', 'vue']);

const covered = new Map(); // package -> [concept id, ...]
for (const [id, c] of Object.entries(concepts)) {
	if (!c.package) continue;
	const list = covered.get(c.package) ?? [];
	list.push(id);
	covered.set(c.package, list);
}

let failed = false;

for (const pkg of readdirSync(packagesDir).sort()) {
	if (!existsSync(join(packagesDir, pkg, 'brain'))) continue;
	if (PLUMBING.has(pkg)) continue;
	if (!covered.has(pkg)) {
		console.error(
			`packages/${pkg} ships a brain/ fragment but no concept names it — ` +
				`add one to .claude/skills/fonderie/brain-knowledge.json (or, if it is plumbing, the allow-list here)`,
		);
		failed = true;
	}
}

for (const [pkg, ids] of [...covered.entries()].sort()) {
	if (!existsSync(join(packagesDir, pkg, 'package.json'))) {
		console.error(`concept(s) ${ids.join(', ')} point at packages/${pkg}, which does not exist`);
		failed = true;
	}
}

if (failed) process.exit(1);
console.log('catalog coverage: every fragment-shipping brick is discoverable, every concept resolves');
