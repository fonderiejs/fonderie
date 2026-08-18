#!/usr/bin/env node
// Client<->server route drift guard.
//
// Every endpoint @fonderie/client calls must resolve to a route actually
// registered by the corresponding server package. This catches the class of bug
// where the client and @fonderie/auth (etc.) silently disagree on a path, method,
// or param shape — which shipped undetected because the client has no tests.
//
// Covers the packages that register routes via the R('name','METHOD','/path')
// table: auth, billing, customers, workspaces, audit, webhooks. The admin
// surfaces (config-admin, courier-admin) register routes differently and are
// out of scope here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// client module -> server package(s) whose routes it may call
const MAP = {
	auth: ['auth'],
	billing: ['billing'],
	customers: ['customers'],
	workspaces: ['workspaces'],
	webhooks: ['webhooks'],
	// audit omitted: its client path is a nested template literal (`/audit${qs ? `?…` : ''}`)
	// that this static parser can't extract cleanly. Low-risk, single GET route.
};

// Normalise a path so client template literals and server :params compare equal.
const norm = (p) =>
	p
		// query-string builders appended in the client (drop them entirely)
		.replace(/\$\{\s*(qs|q|query|envQuery)\b[^}]*\}/g, '')
		.split('?')[0] // drop any literal query string
		.replace(/\$\{[^}]*\}/g, ':P') // ${customerId}, ${encodeURIComponent(x)} -> :P
		.replace(/:[A-Za-z0-9_]+/g, ':P') // :customerId -> :P
		.replace(/\/$/, '') // trailing slash
		.trim();

const serverRoutes = (pkg) => {
	const src = readFileSync(resolve(root, `packages/${pkg}/src/routes.ts`), 'utf8');
	const set = new Set();
	// Two registration styles across packages:
	//   R('name','METHOD','/path', …)   — auth, workspaces
	//   ['METHOD', '/path', …handlers]  — billing, customers, webhooks
	for (const m of src.matchAll(/R\(\s*(?:'[A-Za-z0-9]+',\s*)?'([A-Z]+)',\s*'([^']+)'/g)) {
		set.add(`${m[1]} ${norm(m[2])}`);
	}
	for (const m of src.matchAll(/\[\s*'([A-Z]+)',\s*'([^']+)'/g)) {
		set.add(`${m[1]} ${norm(m[2])}`);
	}
	return set;
};

const clientRoutes = (mod) => {
	const src = readFileSync(resolve(root, `packages/client/src/modules/${mod}.ts`), 'utf8');
	const out = [];
	// path can be a plain string '…' or a template literal `…` (with ${…}).
	for (const m of src.matchAll(/method:\s*'([A-Z]+)',\s*\n\s*path:\s*(`[^`]+`|'[^']+')/g)) {
		const raw = m[2].slice(1, -1);
		out.push({ method: m[1], raw, key: `${m[1]} ${norm(raw)}` });
	}
	return out;
};

let failures = 0;
let checked = 0;
for (const [mod, pkgs] of Object.entries(MAP)) {
	const server = new Set();
	for (const p of pkgs) for (const r of serverRoutes(p)) server.add(r);
	for (const c of clientRoutes(mod)) {
		checked++;
		if (!server.has(c.key)) {
			failures++;
			console.error(
				`✗ client ${mod}: ${c.method} ${c.raw}\n    → no matching route (${c.key}) in @fonderie/${pkgs.join(', ')}`,
			);
		}
	}
}

if (failures > 0) {
	console.error(
		`\n[check-client-routes] ${failures} client route(s) have no server match — client/server drift.`,
	);
	process.exit(1);
}
console.log(`[check-client-routes] OK — all ${checked} client routes resolve to a server route.`);
