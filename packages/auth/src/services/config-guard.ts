import type { IReadinessProblem } from '@fonderie/core';
import { MIN_SECRET_LENGTH, PLACEHOLDER_SECRET, secretStrengthProblem } from '@fonderie/core';
import type { IAuthConfig } from '../config';

const MODULE = '@fonderie/auth';

// Pure production-readiness assessment (no side effects) — shared by the
// boot-time guard and `AuthModule.checkReadiness`. Evaluates "is this ready for
// production?" regardless of the current NODE_ENV. Secret-strength rule
// (min length + placeholder denylist) is the shared @fonderie/core one.
export function collectAuthConfigProblems(config: IAuthConfig): IReadinessProblem[] {
	const problems: IReadinessProblem[] = [];
	const secret = config.jwtSecret ?? '';

	const secretProblem = secretStrengthProblem(secret);
	if (secretProblem === 'too-short') {
		problems.push({
			module: MODULE,
			severity: 'error',
			message: `jwtSecret must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`,
		});
	} else if (secretProblem === 'placeholder') {
		problems.push({
			module: MODULE,
			severity: 'error',
			message: 'jwtSecret looks like a placeholder or dev-default value',
		});
	}

	// Explicitly disabling Secure cookies ships session cookies over plaintext —
	// an error in production (fails the boot gate), a warning elsewhere.
	if (config.secureCookies === false) {
		problems.push({
			module: MODULE,
			severity: process.env['NODE_ENV'] === 'production' ? 'error' : 'warning',
			message: 'secureCookies is false — auth cookies may be sent over non-HTTPS connections in production',
		});
	}

	// Google OAuth secrets: if the provider is wired up, its clientSecret is a
	// bearer credential to Google — a placeholder or blank value is as unsafe as
	// a weak jwtSecret, so it's a boot-blocking error in production.
	if (config.google) {
		const clientSecret = config.google.clientSecret ?? '';
		if (!clientSecret || !config.google.clientId || !config.google.redirectUri) {
			problems.push({
				module: MODULE,
				severity: 'error',
				message: 'google OAuth is configured but clientId, clientSecret, or redirectUri is missing',
			});
		} else if (PLACEHOLDER_SECRET.test(clientSecret)) {
			problems.push({
				module: MODULE,
				severity: 'error',
				message: 'google.clientSecret looks like a placeholder or dev-default value',
			});
		}
	}

	// Sign in with Apple: the .p8 private key is a bearer credential to Apple. If
	// the provider is wired, its required fields must be present and the key must
	// look like a real PEM — a missing field or placeholder is a boot-blocking
	// error in production, same posture as google.clientSecret.
	if (config.apple) {
		const a = config.apple;
		if (!a.clientId || !a.teamId || !a.keyId || !a.privateKey || !a.redirectUri) {
			problems.push({
				module: MODULE,
				severity: 'error',
				message: 'apple OAuth is configured but clientId, teamId, keyId, privateKey, or redirectUri is missing',
			});
		} else if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(a.privateKey)) {
			problems.push({
				module: MODULE,
				severity: 'error',
				message: 'apple.privateKey does not look like a PEM .p8 key (expected `-----BEGIN PRIVATE KEY-----`)',
			});
		}
		// nativeClientIds is the audience allow-list for POST /auth/apple/native —
		// a native identityToken is accepted iff its aud is one of these. An empty
		// or wildcard entry would accept tokens minted for OTHER Apple apps, so
		// it's a boot-blocking error (only exact bundle ids belong here).
		if (a.nativeClientIds?.some((id) => !id || id.trim() === '' || id.includes('*'))) {
			problems.push({
				module: MODULE,
				severity: 'error',
				message: 'apple.nativeClientIds must be exact bundle ids — empty or wildcard entries would accept identity tokens minted for other apps',
			});
		}
	}

	// MFA is on but TOTP secrets have no at-rest encryption key — they'd be
	// stored plaintext. An error in production (fails the boot gate); a warning
	// elsewhere so dev/test with backward-compatible defaults still run.
	if (config.mfa && !config.mfaSecretKey) {
		problems.push({
			module: MODULE,
			severity: process.env['NODE_ENV'] === 'production' ? 'error' : 'warning',
			message: 'mfa is enabled without mfaSecretKey — TOTP secrets are stored plaintext at rest; set a 32-byte key (openssl rand -hex 32)',
		});
	}

	// A malformed key can never decrypt: catch it at boot rather than on the
	// first MFA request. 32 bytes = 64 hex chars.
	if (config.mfaSecretKey && !/^[0-9a-fA-F]{64}$/.test(config.mfaSecretKey)) {
		problems.push({
			module: MODULE,
			severity: 'error',
			message: 'mfaSecretKey must be 64 hex characters (32 bytes, e.g. `openssl rand -hex 32`)',
		});
	}

	return problems;
}

// Boot-time guard, run automatically when an `AuthModule` is constructed
// (fail-fast, before boot). In production a weak `jwtSecret` is fatal — a
// forgeable token is an auth bypass — so we refuse to boot; outside production
// the same errors are a loud warning so dev/test still run. `secureCookies`
// warnings are only surfaced in production (dev intentionally uses non-secure
// cookies over localhost).
export function validateAuthConfig(config: IAuthConfig): void {
	const isProduction = process.env['NODE_ENV'] === 'production';
	const problems = collectAuthConfigProblems(config);
	const errors = problems.filter((p) => p.severity === 'error');

	if (isProduction && errors.length > 0) {
		throw new Error(
			`[auth] insecure config — ${errors.map((e) => e.message).join('; ')}. ` +
				'Set a long, random jwtSecret (e.g. `openssl rand -base64 32`). ' +
				'Refusing to boot in production.',
		);
	}

	if (isProduction) {
		for (const p of problems) console.warn(`[auth] ${p.message}`);
	} else {
		for (const p of errors) {
			console.warn(`[auth] ${p.message} (insecure — would refuse to boot in production)`);
		}
	}
}
