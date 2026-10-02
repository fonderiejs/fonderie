#!/usr/bin/env node
// Every published package's dependency on another @fonderie package must be a
// real range that includes the version in this repo.
//
// WHY: 54 packages depended on their siblings at "*". npm treats an installed
// version as satisfying "*", so upgrading @fonderie/react-native-media left
// @fonderie/react-media at the old version — without the fix the upgrade was
// for. Apps kept stale code with no error anywhere. A caret range forces the
// inner package forward, and changesets (updateInternalDependencies) keeps the
// ranges current on every release.
//
// Accepted: ^x.y.z, >=x.y.z, x.y.z. Checked against the local version.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkgs = readdirSync(join(root, 'packages'))
	.map((d) => join(root, 'packages', d, 'package.json'))
	.filter((f) => existsSync(f))
	.map((f) => ({ file: f, json: JSON.parse(readFileSync(f, 'utf8')) }));
const local = Object.fromEntries(pkgs.map((p) => [p.json.name, p.json.version]));

const parse = (v) => {
	const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
	return m ? m.slice(1).map(Number) : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Whether `version` satisfies `range` (^x.y.z, >=x.y.z or x.y.z); null = unsupported form. */
export function satisfies(range, version) {
	const v = parse(version);
	if (!v) return null;
	let m;
	if ((m = /^\^(\d+\.\d+\.\d+)$/.exec(range))) {
		const r = parse(m[1]);
		if (cmp(v, r) < 0) return false;
		// Caret: the left-most non-zero part is fixed.
		if (r[0] > 0) return v[0] === r[0];
		if (r[1] > 0) return v[0] === 0 && v[1] === r[1];
		return v[0] === 0 && v[1] === 0 && v[2] === r[2];
	}
	if ((m = /^>=(\d+\.\d+\.\d+)$/.exec(range))) return cmp(v, parse(m[1])) >= 0;
	if (/^\d+\.\d+\.\d+$/.test(range)) return range === version;
	return null;
}

const problems = [];
let checked = 0;
for (const { json } of pkgs) {
	if (json.private) continue;
	for (const section of ['dependencies', 'peerDependencies']) {
		for (const [dep, range] of Object.entries(json[section] ?? {})) {
			if (!dep.startsWith('@fonderie/')) continue;
			checked++;
			if (!(dep in local)) {
				problems.push(`${json.name} ${section}: ${dep} is not a package in this repo`);
				continue;
			}
			const ok = satisfies(range, local[dep]);
			if (ok === null) problems.push(`${json.name} ${section}: ${dep} "${range}" — use ^${local[dep]} (a "*" or tag never forces an upgrade)`);
			else if (!ok) problems.push(`${json.name} ${section}: ${dep} "${range}" excludes the local ${local[dep]}`);
		}
	}
}

// The denominator: a gate that reached nothing must not pass quietly.
if (checked === 0) {
	console.error('check:internal-ranges found no @fonderie dependencies to check — the scan is broken.');
	process.exit(1);
}
if (problems.length) {
	console.error(`check:internal-ranges: ${problems.length} problem(s) in ${checked} internal dependencies:\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log(`check:internal-ranges: ${checked} internal dependencies across ${pkgs.filter((p) => !p.json.private).length} packages — all real ranges that include the local version.`);
