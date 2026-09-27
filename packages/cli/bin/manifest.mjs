// fonderie config|secret|template export · diff · apply — declarative, kubectl-style.
//
//   fonderie <config|secret> export [--env e] [-o file]        current state as a manifest
//   fonderie template export [--locale l] [-o file]            HTML and multi-line text go to files next to it
//   fonderie <kind> diff  -f file [--env e | --locale l]       what apply would change (exit 1 if anything)
//   fonderie <kind> apply -f file [...] [--dry-run] [--prune] [--allow-type-change]
//   fonderie secret diff|apply --from-env-file .env            secrets straight from a .env file
//   fonderie config public                                     exactly what frontends receive
//
// A manifest is JSON, keyed by key so it diffs cleanly in a pull request:
//
//   { "apiVersion": "fonderie/v1", "kind": "ConfigSet",
//     "metadata": { "environment": "all" },
//     "entries": { "ENABLE_JOB_LISTING": { "value": true, "description": "…" } } }
//
// Secrets (kind SecretSet) name where each value comes from instead of holding
// it, so the file can be committed:
//     "STRIPE_SECRET_KEY": { "valueFrom": { "env": "STRIPE_SECRET_KEY" } }
//
// Templates (kind TemplateSet, metadata.locale) keep long bodies in their own
// files, relative to the manifest, so a copy change reviews as a copy change:
//     "auth.welcome": { "subject": "Welcome", "textFrom": { "file": "auth.welcome.txt" },
//                       "htmlFrom": { "file": "auth.welcome.html" } }
//
// The scope (environment or locale) comes from the flag or from metadata; if
// both are given they must agree, so a prod export can never be applied to the
// shared rows by forgetting --env. apply never deletes without --prune, never
// changes a config key's type without --allow-type-change, pins every update
// to the version it read, never prints a secret value, and is idempotent.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export const API_VERSION = 'fonderie/v1';

// Per-resource shape. `scope` is how rows are partitioned (environment for
// config/secret, locale for templates — null is the default locale).
const SPECS = {
	config: {
		kind: 'ConfigSet', scopeFlag: '--env', scopeMeta: 'environment', defaultScope: 'all',
		fields: ['value', 'description'], keyPattern: /^[A-Za-z][A-Za-z0-9._-]{0,127}$/,
		keyHint: 'start with a letter; letters, digits, . _ -',
		allowed: ['value', 'description'],
	},
	secret: {
		kind: 'SecretSet', scopeFlag: '--env', scopeMeta: 'environment', defaultScope: 'all',
		fields: ['value', 'description'], keyPattern: /^[A-Za-z][A-Za-z0-9._-]{0,127}$/,
		keyHint: 'start with a letter; letters, digits, . _ -',
		allowed: ['value', 'valueFrom', 'description'],
	},
	template: {
		kind: 'TemplateSet', scopeFlag: '--locale', scopeMeta: 'locale', defaultScope: null,
		fields: ['subject', 'text', 'html', 'active'], keyPattern: /^[A-Za-z0-9_][A-Za-z0-9._:-]{0,127}$/,
		keyHint: 'letters, digits, . _ : -',
		allowed: ['subject', 'text', 'textFrom', 'html', 'htmlFrom', 'active'],
	},
};

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
		if (line.trim().startsWith('#')) continue;
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!m) continue;
		let v = m[2];
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		out[m[1]] = v;
	}
	return out;
}

/**
 * Validate a manifest and resolve every value (valueFrom env, textFrom/htmlFrom
 * files relative to `baseDir`). Returns { entries, scope } — scope is
 * metadata's value, or undefined — or throws listing every problem at once.
 */
export function readManifest(resource, raw, { env = process.env, baseDir = '.' } = {}) {
	const spec = SPECS[resource];
	const problems = [];
	if (!raw || typeof raw !== 'object') throw new Error('manifest: not a JSON object');
	if (raw.apiVersion && raw.apiVersion !== API_VERSION) problems.push(`apiVersion must be "${API_VERSION}"`);
	if (raw.kind !== spec.kind) problems.push(`kind must be "${spec.kind}" for \`fonderie ${resource}\` (got ${JSON.stringify(raw.kind)})`);
	if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) problems.push('entries must be an object keyed by key');
	const entries = {};
	const fromFile = (key, field, ref) => {
		if (typeof ref?.file !== 'string') {
			problems.push(`${key}: ${field}From must be { "file": "path" }`);
			return undefined;
		}
		try {
			return readFileSync(resolve(baseDir, ref.file), 'utf8');
		} catch {
			problems.push(`${key}: ${field}From file ${ref.file} cannot be read`);
			return undefined;
		}
	};
	for (const [key, s] of Object.entries(raw.entries ?? {})) {
		if (!spec.keyPattern.test(key)) {
			problems.push(`${key}: invalid key (${spec.keyHint})`);
			continue;
		}
		if (!s || typeof s !== 'object' || Array.isArray(s)) {
			problems.push(`${key}: must be an object`);
			continue;
		}
		const unknown = Object.keys(s).filter((f) => !spec.allowed.includes(f));
		if (unknown.length) problems.push(`${key}: unknown field(s) ${unknown.join(', ')} (allowed: ${spec.allowed.join(', ')})`);

		if (resource === 'template') {
			const out = {};
			for (const field of ['text', 'html']) {
				if (s[field] !== undefined && s[`${field}From`] !== undefined) problems.push(`${key}: give ${field} or ${field}From, not both`);
				const v = s[`${field}From`] !== undefined ? fromFile(key, field, s[`${field}From`]) : s[field];
				if (v !== undefined && v !== null && typeof v !== 'string') problems.push(`${key}: ${field} must be a string`);
				out[field] = v ?? null;
			}
			if (out.text === null && s.textFrom === undefined) problems.push(`${key}: needs "text" or "textFrom": { "file": "…" } (the plain-text body is required)`);
			if (s.subject !== undefined && s.subject !== null && typeof s.subject !== 'string') problems.push(`${key}: subject must be a string`);
			if (s.active !== undefined && typeof s.active !== 'boolean') problems.push(`${key}: active must be true or false`);
			// A template is a whole document: the server replaces all of it on
			// save, so an omitted subject or html means none.
			out.subject = s.subject ?? null;
			out.active = s.active ?? true;
			entries[key] = out;
			continue;
		}

		const out = {};
		if (s.description !== undefined) out.description = String(s.description);
		if (s.valueFrom !== undefined) {
			const name = s.valueFrom?.env;
			if (typeof name !== 'string') problems.push(`${key}: valueFrom must be { "env": "NAME" }`);
			else if (env[name] === undefined) problems.push(`${key}: environment variable ${name} is not set`);
			else out.value = env[name];
		} else if (Object.hasOwn(s, 'value')) {
			out.value = s.value;
		} else {
			problems.push(`${key}: needs "value"${resource === 'secret' ? ' or "valueFrom": { "env": "NAME" }' : ''}`);
			continue;
		}
		if (resource === 'secret' && out.value !== undefined && typeof out.value !== 'string') {
			problems.push(`${key}: a secret value must be a string`);
		}
		entries[key] = out;
	}
	let scope;
	if (raw.metadata && Object.hasOwn(raw.metadata, spec.scopeMeta)) scope = raw.metadata[spec.scopeMeta];
	if (problems.length) throw new Error(`manifest has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
	return { entries, scope };
}

// Which fields differ. Config/secret: an omitted description means "leave it".
// Templates: every field is compared (the manifest holds the whole template).
function changedFields(resource, have, want) {
	if (resource === 'template') return SPECS.template.fields.filter((f) => (have[f] ?? null) !== (want[f] ?? null));
	const out = [];
	if (!sameValue(have.value, want.value)) out.push('value');
	if (want.description !== undefined && want.description !== (have.description ?? '')) out.push('description');
	return out;
}

/**
 * Compare desired entries with the current ones. `current` is
 * { key: { ...fields, version } } — for secrets `value` is the revealed
 * plaintext. Pure.
 */
export function planChanges(resource, desired, current, { prune = false, allowTypeChange = false } = {}) {
	const plan = { add: [], update: [], blocked: [], unchanged: [], remove: [], keep: [] };
	for (const [key, want] of Object.entries(desired)) {
		const have = current[key];
		if (!have) {
			plan.add.push({ key, want });
			continue;
		}
		const fields = changedFields(resource, have, want);
		if (!fields.length) {
			plan.unchanged.push({ key });
			continue;
		}
		const typeChange = resource === 'config' && fields.includes('value') && valueKind(have.value) !== valueKind(want.value);
		if (typeChange && !allowTypeChange) {
			plan.blocked.push({ key, from: valueKind(have.value), to: valueKind(want.value) });
			continue;
		}
		plan.update.push({ key, want, have, fields, typeChange });
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
const lines = (s) => (s ? s.split('\n').length : 0);

/** kubectl-style lines. Secret values are never printed. */
export function describePlan(resource, plan) {
	const out = [];
	for (const { key, want } of plan.add) {
		const detail = resource === 'config' ? ` = ${show(want.value)}` : resource === 'template' && want.subject ? ` "${want.subject}"` : '';
		out.push(`+ ${key}${detail}  (new)`);
	}
	for (const { key, want, have, fields } of plan.update) {
		const parts = fields.map((f) => {
			if (resource === 'secret' && f === 'value') return 'value changed';
			if (resource === 'config' && f === 'value') return `${show(have.value)} → ${show(want.value)}`;
			if (f === 'subject') return `subject ${show(have.subject)} → ${show(want.subject)}`;
			if (f === 'text' || f === 'html') {
				if (!want[f]) return `${f} removed`;
				if (!have[f]) return `${f} added (${lines(want[f])} lines)`;
				return `${f} changed (${lines(have[f])} → ${lines(want[f])} lines)`;
			}
			if (f === 'active') return want.active ? 'activated' : 'deactivated';
			return `${f} changed`;
		});
		out.push(`~ ${key}: ${parts.join(', ')}`);
	}
	for (const { key, from, to } of plan.blocked) out.push(`! ${key}: type ${from} → ${to} — blocked (pass --allow-type-change to change it on purpose)`);
	for (const { key } of plan.remove) out.push(`- ${key}  (deleted: --prune)`);
	if (plan.keep.length) out.push(`  ${plan.keep.length} key(s) on the server but not in the manifest — kept (pass --prune to delete): ${plan.keep.map((k) => k.key).join(', ')}`);
	if (plan.unchanged.length) out.push(`= ${plan.unchanged.length} unchanged`);
	return out;
}

export function hasChanges(plan) {
	return plan.add.length + plan.update.length + plan.remove.length > 0;
}

// Resolve the scope from the flag and the manifest's metadata; disagreeing is
// an error, not a precedence rule — that is how a prod file lands on 'all'.
export function resolveScope(resource, flagValue, metaValue) {
	const spec = SPECS[resource];
	const norm = (v) => (v === undefined ? undefined : v === '' ? spec.defaultScope : v);
	const f = norm(flagValue);
	const m = norm(metaValue);
	if (f !== undefined && m !== undefined && f !== m) {
		throw new Error(`${spec.scopeFlag} ${JSON.stringify(f)} disagrees with the manifest's metadata.${spec.scopeMeta} ${JSON.stringify(m)} — fix one of them`);
	}
	return f ?? m ?? spec.defaultScope;
}

const fileSafe = (s) => s.replace(/[^A-Za-z0-9._-]/g, '_');

// ── wiring to a live deployment ───────────────────────────────────────────

export function createManifestCommands({ argv, arg, adminJson, resourceBase }) {
	const file = arg('-f', undefined) ?? arg('--file', undefined);

	// config/secret: scope rides as ?environment=; the list for an environment
	// includes shared rows, so filter to exactly this scope. templates: the list
	// holds every locale; ?locale= addresses one row (absent = default locale).
	const scopeQuery = (resource, scope) => {
		if (resource === 'template') return scope === null ? '' : `?locale=${encodeURIComponent(scope)}`;
		return scope === 'all' ? '' : `?environment=${encodeURIComponent(scope)}`;
	};

	async function loadCurrent(resource, scope, { reveal = [] } = {}) {
		const base = await resourceBase(resource);
		const q = scopeQuery(resource, scope);
		const list = (await adminJson('GET', resource === 'template' ? base : `${base}${q}`)) ?? [];
		const current = {};
		for (const e of list) {
			if (resource === 'template') {
				if ((e.locale ?? null) !== scope) continue;
				current[e.type] = { subject: e.subject ?? null, text: e.text ?? null, html: e.html ?? null, active: e.active !== false, version: e.version };
			} else {
				if ((e.environment ?? 'all') !== scope) continue;
				current[e.key] = { value: e.value, description: e.description ?? '', version: e.version };
			}
		}
		for (const key of reveal) {
			if (current[key]) current[key].value = await adminJson('POST', `${base}/${encodeURIComponent(key)}/reveal${q}`);
		}
		return { base, current };
	}

	function desiredFromArgs(resource) {
		const envFile = arg('--from-env-file', undefined);
		if (envFile) {
			if (resource !== 'secret') throw new Error('--from-env-file is for `fonderie secret`');
			const pairs = parseEnvFile(readFileSync(envFile, 'utf8'));
			return { entries: Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, { value: v }])), scope: undefined };
		}
		if (!file) throw new Error(`usage: fonderie ${resource} ${argv[1]} -f <manifest.json>${resource === 'secret' ? ' | --from-env-file <.env>' : ''}`);
		return readManifest(resource, JSON.parse(readFileSync(file, 'utf8')), { baseDir: dirname(resolve(file)) });
	}

	async function exportCmd(resource) {
		const spec = SPECS[resource];
		const scope = resolveScope(resource, arg(spec.scopeFlag, undefined), undefined);
		const reveal = resource === 'secret' && argv.includes('--reveal');
		const { base, current } = await loadCurrent(resource, scope);
		const outFile = arg('-o', undefined) ?? arg('--output', undefined);
		const sideFiles = [];
		const entries = {};
		for (const [key, e] of Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) {
			const out = {};
			if (resource === 'template') {
				if (e.subject !== null) out.subject = e.subject;
				// With -o, HTML and multi-line text go to their own files next to
				// the manifest; to stdout everything stays inline.
				for (const [field, ext] of [['text', 'txt'], ['html', 'html']]) {
					if (e[field] === null) continue;
					if (outFile && (field === 'html' || e[field].includes('\n'))) {
						const name = `${fileSafe(key)}${scope === null ? '' : `.${fileSafe(scope)}`}.${ext}`;
						sideFiles.push([join(dirname(resolve(outFile)), name), e[field]]);
						out[`${field}From`] = { file: name };
					} else {
						out[field] = e[field];
					}
				}
				if (!e.active) out.active = false;
			} else if (resource === 'secret') {
				if (reveal) out.value = await adminJson('POST', `${base}/${encodeURIComponent(key)}/reveal${scopeQuery(resource, scope)}`);
				else out.valueFrom = { env: key.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase() };
			} else {
				out.value = e.value;
			}
			if (resource !== 'template' && e.description) out.description = e.description;
			entries[key] = out;
		}
		const manifest = { apiVersion: API_VERSION, kind: spec.kind, metadata: { [spec.scopeMeta]: scope }, entries };
		const text = `${JSON.stringify(manifest, null, 2)}\n`;
		const n = Object.keys(entries).length;
		if (outFile) {
			for (const [path, content] of sideFiles) writeFileSync(path, content);
			// 0600 when plaintext secrets are inside: readable by you only.
			writeFileSync(outFile, text, reveal ? { mode: 0o600 } : undefined);
			console.error(`wrote ${n} ${resource} entr${n === 1 ? 'y' : 'ies'} to ${basename(outFile)}${sideFiles.length ? ` (+${sideFiles.length} body file${sideFiles.length === 1 ? '' : 's'})` : ''}`);
		} else {
			process.stdout.write(text);
		}
		if (reveal) console.error('WARNING: this manifest contains secret values in plaintext. Never commit it.');
	}

	async function plan(resource) {
		const spec = SPECS[resource];
		const { entries: desired, scope: metaScope } = desiredFromArgs(resource);
		const scope = resolveScope(resource, arg(spec.scopeFlag, undefined), metaScope);
		const { base, current } = await loadCurrent(resource, scope, {
			reveal: resource === 'secret' ? Object.keys(desired) : [],
		});
		const p = planChanges(resource, desired, current, {
			prune: argv.includes('--prune'),
			allowTypeChange: argv.includes('--allow-type-change'),
		});
		return { base, scope, plan: p };
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
		const { base, scope, plan: p } = await plan(resource);
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
		const q = scopeQuery(resource, scope);
		const put = async (key, want, version, typeChange) => {
			let body;
			if (resource === 'template') {
				body = { text: want.text, active: want.active };
				if (want.subject !== null) body.subject = want.subject;
				if (want.html !== null) body.html = want.html;
			} else {
				body = { value: want.value };
				if (want.description !== undefined) body.description = want.description;
				if (scope !== 'all') body.environment = scope;
				// Only on the writes that change a type: a same-type update keeps
				// the server's guard armed even when the flag was passed.
				if (typeChange) body.allowTypeChange = true;
			}
			// Optimistic concurrency: if someone edited the key since we read it,
			// the server refuses rather than overwriting their change.
			if (version !== undefined) body.ifVersion = version;
			await adminJson('PUT', `${base}/${encodeURIComponent(key)}${q}`, body);
		};
		for (const { key, want } of p.add) await put(key, want);
		for (const { key, want, have, typeChange } of p.update) await put(key, want, have.version, typeChange);
		for (const { key } of p.remove) await adminJson('DELETE', `${base}/${encodeURIComponent(key)}${q}`);
		console.log(`\napplied: ${p.add.length} added, ${p.update.length} updated, ${p.remove.length} deleted, ${p.unchanged.length} unchanged`);
	}

	async function publicCmd() {
		const values = await adminJson('GET', '/config/public', undefined, { auth: false });
		process.stdout.write(`${JSON.stringify(values?.values ?? values, null, 2)}\n`);
	}

	return { exportCmd, diffCmd, applyCmd, publicCmd };
}
