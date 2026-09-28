#!/usr/bin/env node
// Console-reason coverage gate (localized findings). Every readiness problem,
// doctor finding and skip reason a brick emits carries `domain` + `reason`
// (AIP-193 style) so the console can say it in the operator's language. This
// gate keeps the bricks and the console dictionary in step, both ways:
//
//   - every emitted domain + reason has a sentence in the English dictionary
//     (packages/client/src/admin-i18n/en/reasons.ts) — otherwise a French
//     operator silently gets English back;
//   - every sentence in the dictionary is still emitted — otherwise it is dead
//     copy that translators keep paying for.
//
// French and Spanish completeness is a compile error already (`typeof en`).
//
// An emission is a `reason: 'UPPER_SNAKE'` literal with a `domain: '<brick>'`
// literal within WINDOW lines — they sit in the same object literal. Reasons
// with no domain nearby are API error reasons, out of scope here.
//
// Run: npm run check:reasons
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');
const WINDOW = 3;

// Files whose reasons get their domain somewhere other than next to them.
// Every entry carries its reason.
const FILE_DOMAIN = new Map([
	// Sender DNS records carry a bare `reason`; senderDnsFindings() attaches
	// domain 'courier' when it turns records into findings (reasonOf).
	['packages/courier/src/sender-dns.ts', 'courier'],
]);

function tsFiles(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) {
			if (entry !== '__tests__') out.push(...tsFiles(p));
		} else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) out.push(p);
	}
	return out;
}

const REASON = /\breason(?::|\s*=)\s*'([A-Z][A-Z0-9_]+)'/;
const DOMAIN = /\bdomain:\s*'([a-z][a-z-]*)'/;

// emitted: "domain.REASON" → first place seen
const emitted = new Map();
let files = 0;
for (const pkg of readdirSync(packagesDir)) {
	for (const file of tsFiles(join(packagesDir, pkg, 'src'))) {
		const rel = relative(root, file);
		const lines = readFileSync(file, 'utf8').split('\n');
		let hit = false;
		lines.forEach((line, i) => {
			const r = line.match(REASON);
			if (!r) return;
			let domain = FILE_DOMAIN.get(rel);
			for (let d = 0; !domain && d <= WINDOW; d++) {
				domain = (lines[i - d]?.match(DOMAIN) ?? lines[i + d]?.match(DOMAIN))?.[1];
			}
			if (!domain) return;
			hit = true;
			const key = `${domain}.${r[1]}`;
			if (!emitted.has(key)) emitted.set(key, `${rel}:${i + 1}`);
		});
		if (hit) files++;
	}
}

// Read the English dictionary as source: domain blocks of REASON: '…' entries.
const dictFile = join(packagesDir, 'client/src/admin-i18n/en/reasons.ts');
const known = new Set();
let domain = null;
for (const line of readFileSync(dictFile, 'utf8').split('\n')) {
	const open = line.match(/^\t([a-z][a-z-]*): \{$/);
	if (open) {
		domain = open[1] === 'values' ? null : open[1];
		continue;
	}
	if (/^\t\},?$/.test(line)) domain = null;
	const entry = domain && line.match(/^\t\t([A-Z][A-Z0-9_]+):/);
	if (entry) known.add(`${domain}.${entry[1]}`);
}

const missing = [...emitted].filter(([k]) => !known.has(k));
const unused = [...known].filter((k) => !emitted.has(k));

// Print the denominator: a gate that reached nothing passes vacuously.
console.log(`check:reasons — ${emitted.size} reasons emitted from ${files} files; ${known.size} in the dictionary`);
if (emitted.size === 0 || known.size === 0) {
	console.error('  ✗ nothing found — the scan or the dictionary parse is broken');
	process.exit(1);
}
for (const [k, at] of missing) console.error(`  ✗ ${k} (${at}) has no sentence in client/src/admin-i18n/en/reasons.ts`);
for (const k of unused) console.error(`  ✗ ${k} is in the dictionary but no brick emits it`);
if (missing.length || unused.length) process.exit(1);
console.log('  ✓ every emitted reason is translated, every translation is used');
