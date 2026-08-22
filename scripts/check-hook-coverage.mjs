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
	['WorkspacesClient.getWorkspace', 'audit A-103 follow-up: no read hook yet'],
	['WorkspacesClient.getRole', 'audit A-103 follow-up: no read hook yet'],
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
