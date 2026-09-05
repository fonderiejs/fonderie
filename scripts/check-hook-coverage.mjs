#!/usr/bin/env node
// Hook-coverage gate (hook-gap audit, Phase 5). Every public method on the
// typed sub-clients must be referenced by at least one hook/composable, or be
// explicitly allow-listed below with a reason. Prevents the audit's Category A
// gaps from regrowing: a new client method shipped without a hook fails CI.
//
// Run: npm run check:hook-coverage
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'packages/client/src/modules');

// Methods that legitimately have no hook. Every entry carries its reason —
// additions to this list are code-review decisions, not conveniences.
const ALLOW = new Map([
	// Internal plumbing: hooks receive tokens/scoping via the shared stores.
	['AuthClient.setAccessToken', 'internal token plumbing (hooks call it, not wrap it)'],
	['BillingClient.setAccessToken', 'redundant setter; shared TokenStore'],
	['WorkspacesClient.setAccessToken', 'redundant setter; shared TokenStore'],
	['CustomersClient.setAccessToken', 'redundant setter; shared TokenStore'],
	['AuditClient.setAccessToken', 'redundant setter; shared TokenStore'],
	['WebhooksClient.setAccessToken', 'redundant setter; shared TokenStore'],
	['BillingClient.setWorkspaceId', 'propagated by FonderieClient.setWorkspaceId'],
	['WorkspacesClient.setWorkspaceId', 'propagated by FonderieClient.setWorkspaceId'],
	['CustomersClient.setWorkspaceId', 'propagated by FonderieClient.setWorkspaceId'],
	['AuditClient.setWorkspaceId', 'propagated by FonderieClient.setWorkspaceId'],
	['WebhooksClient.setWorkspaceId', 'propagated by FonderieClient.setWorkspaceId'],
	['AuthClient.refreshTokens', 'driven by FonderieClient.doRefresh, never by UI'],
	// Read methods without a dedicated hook yet — tracked audit follow-ups.
]);

// Hook/composable sources to scan for references.
const hookDirs = readdirSync(join(root, 'packages'))
	.filter((p) => /^(react|vue)-/.test(p))
	.map((p) => {
		for (const sub of ['src/hooks', 'src/composables']) {
			const d = join(root, 'packages', p, sub);
			if (existsSync(d)) return d;
		}
		return null;
	})
	.filter(Boolean);

const hookSource = hookDirs
	.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(d, f), 'utf8')))
	.join('\n');

// Public methods: `\tname(args) {` at one-tab depth inside an exported class.
const failures = [];
let checked = 0;
for (const file of readdirSync(modulesDir).filter((f) => f.endsWith('.ts'))) {
	const src = readFileSync(join(modulesDir, file), 'utf8');
	for (const cls of src.matchAll(/(?:export )?class (\w+Client) \{([\s\S]*?)\n\}/g)) {
		const [, className, body] = cls;
		// Admin clients are covered by their own packages' hooks too — same rule.
		for (const m of body.matchAll(/\n\t(?:async )?([a-z]\w+)\(/g)) {
			const method = m[1];
			if (method === 'constructor') continue;
			checked++;
			const key = `${className}.${method}`;
			if (ALLOW.has(key)) continue;
			// Referenced as `.method(` anywhere in hook source.
			if (!hookSource.includes(`.${method}(`)) {
				failures.push(key);
			}
		}
	}
}

if (failures.length) {
	console.error(`check:hook-coverage — ${failures.length} client method(s) have no hook and no allow-list entry:`);
	for (const f of failures) console.error(`  - ${f}`);
	console.error('\nShip a hook with the method (re-export rule applies), or allow-list it WITH a reason.');
	process.exit(1);
}
console.log(`check:hook-coverage — ${checked} public client methods checked; all covered or allow-listed (${ALLOW.size} allowed).`);

// ── Leg 2: backend route → client method ─────────────────────────────────────
// Every HTTP route the @fonderie/* server packages register (as documented in
// the generated *-outcomes.md files) must be reachable through a typed client
// method — which leg 1 above then proves has a hook. Routes that are not
// app-code surfaces are allow-listed with reasons.
const ROUTE_ALLOW = new Map([
	['POST /billing/webhook', "Stripe's server-to-server callback receiver — only Stripe calls it"],
	['POST /billing/webhook/payment', "the payment provider's server-to-server callback — only the provider calls it"],
	['POST /billing/wallet/grant', 'admin-token-guarded ops surface (support grants) — not a user-client call'],
	// Wallet client methods + hooks ship in the wallet frontend cycle (audit
	// phase 5); the server surface landed first by scoped decision.
	['GET /billing/wallet', 'wallet client/hooks ship next cycle — server-first by scoped decision'],
	['GET /billing/wallet/transactions', 'wallet client/hooks ship next cycle — server-first by scoped decision'],
	['POST /billing/wallet/checkout', 'wallet client/hooks ship next cycle — server-first by scoped decision'],
	['GET /auth/google', 'browser-redirect OAuth leg — navigated to, never fetched'],
	['GET /auth/google/callback', 'browser-redirect OAuth leg — navigated to, never fetched'],
]);

const sigDir = join(root, '.claude/skills/fonderie/signatures');
const routeRows = readdirSync(sigDir)
	.filter((f) => f.endsWith('-outcomes.md'))
	.flatMap((f) =>
		[...readFileSync(join(sigDir, f), 'utf8').matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)`/gm)].map(
			(m) => ({ pkg: f.replace('-outcomes.md', ''), method: m[1], path: m[2] }),
		),
	);

// Client path templates → normalized candidates. Dynamic segments (`${...}`)
// become :param; trailing/nested template suffixes are usually query-string
// builders, so stripped variants are accepted too.
const clientSrc = readdirSync(modulesDir)
	.filter((f) => f.endsWith('.ts'))
	.map((f) => readFileSync(join(modulesDir, f), 'utf8'))
	.join('\n');
const clientPathSet = new Set();
for (const m of clientSrc.matchAll(/path: [`'"]([^`'"]+)[`'"]/g)) {
	const raw = m[1].split('?')[0];
	const paramized = raw.replace(/\$\{[^}]+\}/g, ':param');
	clientPathSet.add(paramized);
	if (/:param$/.test(paramized)) clientPathSet.add(paramized.replace(/\/?:param$/, ''));
	const cut = raw.split('$' + '{')[0];
	if (cut) clientPathSet.add(cut.replace(/\/$/, ''));
}

const normalizeRoute = (p) => p.split('?')[0].replace(/:[A-Za-z]+/g, ':param');

const uncoveredRoutes = [];
let routesChecked = 0;
for (const { method, path } of routeRows) {
	routesChecked++;
	const key = `${method} ${path}`;
	if (ROUTE_ALLOW.has(key)) continue;
	if (!clientPathSet.has(normalizeRoute(path))) uncoveredRoutes.push(key);
}

if (uncoveredRoutes.length) {
	console.error(`check:hook-coverage — ${uncoveredRoutes.length} backend route(s) unreachable from the typed client:`);
	for (const r of [...new Set(uncoveredRoutes)]) console.error(`  - ${r}`);
	console.error('\nAdd a client method (leg 1 then requires a hook), or allow-list the route WITH a reason.');
	process.exit(1);
}
console.log(
	`check:hook-coverage — ${routesChecked} backend routes checked; all client-reachable or allow-listed (${ROUTE_ALLOW.size} allowed).`,
);
