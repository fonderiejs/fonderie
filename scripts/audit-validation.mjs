#!/usr/bin/env node
// Audits route-level request validation: every body-taking route (POST/PUT/
// PATCH) must either wire validate(<schema>) or appear in the EXEMPT list
// below with a reason. Run via `npm run audit:validation`; exits non-zero on
// any unvalidated route, so CI can gate on it.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Each exemption is individually verified: the handler reads no request
// body, or the payload is provider-shaped and gated by signature
// verification instead. Adding a route here requires the same verification.
const EXEMPT = new Map([
	['POST /billing/webhook', 'Stripe-shaped payload; signature-verified in handler'],
	['POST /courier/delivery/sendgrid', 'provider webhook; signature-verified'],
	['POST /courier/delivery/mailgun', 'provider webhook; signature-verified'],
	['POST /courier/delivery/mailtrap', 'provider webhook'],
	['POST /billing/portal', 'no body read — subscriber resolved from ctx'],
	['POST /webhooks/:endpointId/test', 'no body read — builds outgoing payload'],
	['POST /auth/mfa/setup', 'no body read — generates TOTP secret'],
	['POST /workspaces/archive', 'no body read — workspace from ctx'],
	['POST /workspaces/restore', 'no body read'],
	['POST /customers/:customerId/unblacklist', 'no body read'],
	['PUT /customers/:customerId/emails/:emailId/primary', 'params only'],
	['PUT /customers/:customerId/phones/:phoneId/primary', 'params only'],
	['PUT /customers/:customerId/addresses/:addrId/primary', 'params only'],
	['PUT /customers/:customerId/relationships/:relatedId/primary', 'params only'],
]);

const pkgs = readdirSync(join(root, 'packages')).filter((d) =>
	existsSync(join(root, 'packages', d, 'src')),
);

let total = 0;
let validated = 0;
let exempt = 0;
const problems = [];

for (const pkg of pkgs) {
	const files = [];
	const walk = (d) => {
		for (const f of readdirSync(d)) {
			const p = join(d, f);
			if (statSync(p).isDirectory()) {
				if (!f.includes('__tests__')) walk(p);
			} else if (f.endsWith('.ts') && !f.endsWith('.test.ts')) {
				files.push(p);
			}
		}
	};
	walk(join(root, 'packages', pkg, 'src'));

	for (const file of files) {
		const src = readFileSync(file, 'utf8');
		for (const re of [
			/\[\s*'(POST|PUT|PATCH)'\s*,\s*'(\/[^']*)'\s*,([\s\S]*?)\]/g,
			/addRoute\(\s*'(POST|PUT|PATCH)'\s*,\s*'(\/[^']*)'\s*,([\s\S]*?)\)/g,
		]) {
			let m;
			while ((m = re.exec(src))) {
				const [, method, route, handlers] = m;
				total++;
				const key = `${method} ${route}`;
				if (/validate\(/.test(handlers)) validated++;
				else if (EXEMPT.has(key)) exempt++;
				else problems.push(`${pkg}: ${key} (${relative(root, file)})`);
			}
		}
	}
}

console.log(
	`body-taking routes: ${total} | validated: ${validated} | verified-exempt: ${exempt} | unvalidated: ${problems.length}`,
);
for (const p of problems) console.error('  UNVALIDATED  ' + p);
process.exit(problems.length ? 1 : 0);
