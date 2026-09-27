// fonderie config|secret export · diff · apply — declarative, kubectl-style.
//
//   fonderie config export [--env e] [-o file]           current state as a manifest
//   fonderie config diff   -f file [--env e]             what apply would change (exit 1 if anything)
//   fonderie config apply  -f file [--env e] [--dry-run] [--prune] [--allow-type-change]
//   fonderie config public                               exactly what frontends receive
//   fonderie secret export [--env e] [-o file] [--reveal]
//   fonderie secret diff|apply -f file | --from-env-file .env   (same flags)
//
// A manifest is JSON, keyed by key so it diffs cleanly in a pull request:
//
//   { "apiVersion": "fonderie/v1", "kind": "ConfigSet",
//     "metadata": { "environment": "all" },
//     "entries": { "ENABLE_JOB_LISTING": { "value": true, "description": "…" } } }
//
// Secrets use kind "SecretSet" and should carry `valueFrom` instead of `value`,
// so the manifest itself holds no secret and can be committed:
//
//     "STRIPE_SECRET_KEY": { "valueFrom": { "env": "STRIPE_SECRET_KEY" } }
//
// apply never deletes a key the manifest omits unless --prune is passed, never
// changes an existing config key's type unless --allow-type-change is passed,
// and never prints a secret value. Identical entries are skipped, so applying
// the same manifest twice changes nothing.

import { readFileSync, writeFileSync } from 'node:fs';

export const API_VERSION = 'fonderie/v1';
const KINDS = { config: 'ConfigSet', secret: 'SecretSet' };
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

export function valueKind(value) {
	if (typeof value === 'string') return 'text';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'boolean') return 'on/off';
	if (Array.isArray(value)) return 'list';
	if (value === null || value === undefined) return 'empty';
	return 'object';
}

// Deep, key-order-independent equality for JSON values.
export function sameValue(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
}

/** KEY=value lines, as in a .env file (comments and blanks ignored; quotes stripped). */
export function parseEnvFile(text) {
	const out = {};
	for (const line of text.split(/\r?\n/)) {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)\s*$/.exec(line);
		if (!m || line.trim().startsWith('#')) continue;
		let v = m[2];
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		out[m[1]] = v;
	}
	return out;
}

/**
 * Validate a manifest and resolve every value. Returns { entries: { key: { value,
 * description? } } } or throws an Error listing every problem at once.
 */
export function readManifest(resource, raw, env = process.env) {
	const problems = [];
	if (!raw || typeof raw !== 'object') throw new Error('manifest: not a JSON object');
	if (raw.apiVersion && raw.apiVersion !== API_VERSION) problems.push(`apiVersion must be "${API_VERSION}"`);
	if (raw.kind !== KINDS[resource]) problems.push(`kind must be "${KINDS[resource]}" for \`fonderie ${resource}\` (got ${JSON.stringify(raw.kind)})`);
	if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) problems.push('entries must be an object keyed by key');
	const entries = {};
	for (const [key, spec] of Object.entries(raw.entries ?? {})) {
		if (!KEY_PATTERN.test(key)) {
			problems.push(`${key}: invalid key (start with a letter; letters, digits, . _ -)`);
			continue;
		}
		if (!spec || typeof spec !== 'object') {
			problems.push(`${key}: must be an object with "value"${resource === 'secret' ? ' or "valueFrom"' : ''}`);
			continue;
		}
		const out = {};
		if (spec.description !== undefined) out.description = String(spec.description);
		if (spec.valueFrom !== undefined) {
			const name = spec.valueFrom?.env;
			if (typeof name !== 'string') problems.push(`${key}: valueFrom must be { "env": "NAME" }`);
			else if (env[name] === undefined) problems.push(`${key}: environment variable ${name} is not set`);
			else out.value = env[name];
		} else if (Object.hasOwn(spec, 'value')) {
			out.value = spec.value;
		} else {
			problems.push(`${key}: needs "value"${resource === 'secret' ? ' or "valueFrom": { "env": "NAME" }' : ''}`);
			continue;
		}
		if (resource === 'secret' && out.value !== undefined && typeof out.value !== 'string') {
			problems.push(`${key}: a secret value must be a string`);
		}
		entries[key] = out;
	}
	if (problems.length) throw new Error(`manifest has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
	return { entries };
}

/**
 * Compare desired entries with the current ones. `current` is
 * { key: { value, description, version } } — for secrets `value` is the revealed
 * plaintext (or undefined if it could not be read). Pure.
 */
export function planChanges(resource, desired, current, { prune = false, allowTypeChange = false } = {}) {
	const plan = { add: [], update: [], blocked: [], unchanged: [], remove: [], keep: [] };
	for (const [key, want] of Object.entries(desired)) {
		const have = current[key];
		if (!have) {
			plan.add.push({ key, want });
			continue;
		}
		const valueChanged = !sameValue(have.value, want.value);
		const descChanged = want.description !== undefined && want.description !== (have.description ?? '');
		if (!valueChanged && !descChanged) {
			plan.unchanged.push({ key });
			continue;
		}
		if (resource === 'config' && valueChanged && valueKind(have.value) !== valueKind(want.value) && !allowTypeChange) {
			plan.blocked.push({ key, from: valueKind(have.value), to: valueKind(want.value) });
			continue;
		}
		plan.update.push({ key, want, have, valueChanged, descChanged });
	}
	for (const key of Object.keys(current)) {
		if (Object.hasOwn(desired, key)) continue;
		(prune ? plan.remove : plan.keep).push({ key });
	}
	return plan;
}

const show = (v) => {
	const s = JSON.stringify(v);
	return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/** kubectl-style lines. Secret values are never printed. */
export function describePlan(resource, plan) {
	const secret = resource === 'secret';
	const lines = [];
	for (const { key, want } of plan.add) lines.push(`+ ${key}${secret ? '' : ` = ${show(want.value)}`}  (new)`);
	for (const { key, want, have, valueChanged, descChanged } of plan.update) {
		const parts = [];
		if (valueChanged) parts.push(secret ? 'value changed' : `${show(have.value)} → ${show(want.value)}`);
		if (descChanged) parts.push('description changed');
		lines.push(`~ ${key}: ${parts.join(', ')}`);
	}
	for (const { key, from, to } of plan.blocked) lines.push(`! ${key}: type ${from} → ${to} — blocked (pass --allow-type-change to change it on purpose)`);
	for (const { key } of plan.remove) lines.push(`- ${key}  (deleted: --prune)`);
	if (plan.keep.length) lines.push(`  ${plan.keep.length} key(s) on the server but not in the manifest — kept (pass --prune to delete): ${plan.keep.map((k) => k.key).join(', ')}`);
	if (plan.unchanged.length) lines.push(`= ${plan.unchanged.length} unchanged`);
	return lines;
}

export function hasChanges(plan) {
	return plan.add.length + plan.update.length + plan.remove.length > 0;
}

// ── wiring to a live deployment ───────────────────────────────────────────

export function createManifestCommands({ argv, arg, adminJson, resourceBase }) {
	const env = arg('--env', undefined);
	const envQuery = env ? `?environment=${encodeURIComponent(env)}` : '';
	const scope = env ?? 'all';
	const file = arg('-f', undefined) ?? arg('--file', undefined);

	async function loadCurrent(resource, { reveal }) {
		const base = await resourceBase(resource);
		const list = (await adminJson('GET', `${base}${envQuery}`)) ?? [];
		const current = {};
		// The list for an environment includes shared ('all') rows; a manifest
		// for one environment manages that environment's rows only.
		for (const e of list) {
			if ((e.environment ?? 'all') !== scope) continue;
			current[e.key] = { value: e.value, description: e.description ?? '', version: e.version };
		}
		if (resource === 'secret' && reveal) {
			for (const key of reveal) {
				if (!current[key]) continue;
				current[key].value = await adminJson('POST', `${base}/${encodeURIComponent(key)}/reveal${envQuery}`);
			}
		}
		return { base, current };
	}

	function desiredFromArgs(resource) {
		const envFile = arg('--from-env-file', undefined);
		if (envFile) {
			if (resource !== 'secret') throw new Error('--from-env-file is for `fonderie secret`');
			const pairs = parseEnvFile(readFileSync(envFile, 'utf8'));
			return Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, { value: v }]));
		}
		if (!file) throw new Error(`usage: fonderie ${resource} ${argv[1]} -f <manifest.json>${resource === 'secret' ? ' | --from-env-file <.env>' : ''}`);
		return readManifest(resource, JSON.parse(readFileSync(file, 'utf8'))).entries;
	}

	async function exportCmd(resource) {
		const reveal = resource === 'secret' && argv.includes('--reveal');
		const { base, current } = await loadCurrent(resource, { reveal: [] });
		const entries = {};
		for (const [key, e] of Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) {
			const out = {};
			if (resource === 'secret') {
				out.valueFrom = { env: key.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase() };
				if (reveal) {
					delete out.valueFrom;
					out.value = await adminJson('POST', `${base}/${encodeURIComponent(key)}/reveal${envQuery}`);
				}
			} else {
				out.value = e.value;
			}
			if (e.description) out.description = e.description;
			entries[key] = out;
		}
		const manifest = { apiVersion: API_VERSION, kind: KINDS[resource], metadata: { environment: scope }, entries };
		const text = `${JSON.stringify(manifest, null, 2)}\n`;
		const out = arg('-o', undefined) ?? arg('--output', undefined);
		if (out) {
			// 0600 when plaintext secrets are inside: readable by you only.
			writeFileSync(out, text, reveal ? { mode: 0o600 } : undefined);
			console.error(`wrote ${Object.keys(entries).length} ${resource} entr${Object.keys(entries).length === 1 ? 'y' : 'ies'} to ${out}`);
		} else {
			process.stdout.write(text);
		}
		if (reveal) console.error('WARNING: this manifest contains secret values in plaintext. Never commit it.');
	}

	async function plan(resource) {
		const desired = desiredFromArgs(resource);
		const { base, current } = await loadCurrent(resource, {
			reveal: resource === 'secret' ? Object.keys(desired) : [],
		});
		const p = planChanges(resource, desired, current, {
			prune: argv.includes('--prune'),
			allowTypeChange: argv.includes('--allow-type-change'),
		});
		return { base, current, plan: p };
	}

	async function diffCmd(resource) {
		const { plan: p } = await plan(resource);
		for (const line of describePlan(resource, p)) console.log(line);
		if (!hasChanges(p) && !p.blocked.length) console.log('no changes');
		// kubectl diff convention: exit 1 when there are differences.
		process.exit(hasChanges(p) || p.blocked.length ? 1 : 0);
	}

	async function applyCmd(resource) {
		const dryRun = argv.includes('--dry-run');
		const { base, plan: p } = await plan(resource);
		for (const line of describePlan(resource, p)) console.log(line);
		if (p.blocked.length) {
			console.error(`\n${p.blocked.length} type change(s) blocked — nothing applied.`);
			process.exit(2);
		}
		if (!hasChanges(p)) {
			console.log('no changes');
			return;
		}
		if (dryRun) {
			console.log('\n(dry run — nothing applied)');
			return;
		}
		const put = async (key, want, version, allowTypeChange) => {
			const body = { value: want.value };
			if (want.description !== undefined) body.description = want.description;
			if (env) body.environment = env;
			// Optimistic concurrency: if someone edited the key since we read it,
			// the server refuses rather than overwriting their change.
			if (version !== undefined) body.ifVersion = version;
			if (allowTypeChange) body.allowTypeChange = true;
			await adminJson('PUT', `${base}/${encodeURIComponent(key)}${envQuery}`, body);
		};
		for (const { key, want } of p.add) await put(key, want);
		// allowTypeChange goes only on the writes that change a type: a same-type
		// update keeps the server's guard armed even when the flag was passed.
		for (const { key, want, have } of p.update) {
			await put(key, want, have.version, resource === 'config' && valueKind(have.value) !== valueKind(want.value));
		}
		for (const { key } of p.remove) await adminJson('DELETE', `${base}/${encodeURIComponent(key)}${envQuery}`);
		console.log(`\napplied: ${p.add.length} added, ${p.update.length} updated, ${p.remove.length} deleted, ${p.unchanged.length} unchanged`);
	}

	async function publicCmd() {
		const values = await adminJson('GET', '/config/public', undefined, { auth: false });
		process.stdout.write(`${JSON.stringify(values?.values ?? values, null, 2)}\n`);
	}

	return { exportCmd, diffCmd, applyCmd, publicCmd };
}
