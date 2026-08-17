import type { IReadinessProblem } from '@fonderie/core';
import type { IAuthConfig } from '../config';

const MODULE = '@fonderie/auth';

// Placeholder / dev-default secrets we never want signing tokens in production.
// These distinctive fragments won't appear in a real random secret (e.g. the
// output of `openssl rand -base64 32`), so matching one is a strong signal the
// secret was copy-pasted from an example rather than generated.
const PLACEHOLDER_SECRET =
	/dev-secret|test-secret|changeme|change-me|your[-_]secret|placeholder|example|insecure|min-32-chars/i;

// Minimum length for an HS256 signing secret — 256 bits.
const MIN_SECRET_LENGTH = 32;

// Pure production-readiness assessment (no side effects) — shared by the
// boot-time guard and `AuthModule.checkReadiness`. Evaluates "is this ready for
// production?" regardless of the current NODE_ENV.
export function collectAuthConfigProblems(config: IAuthConfig): IReadinessProblem[] {
	const problems: IReadinessProblem[] = [];
	const secret = config.jwtSecret ?? '';

	if (secret.length < MIN_SECRET_LENGTH) {
		problems.push({
			module: MODULE,
			severity: 'error',
			message: `jwtSecret must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`,
		});
	} else if (PLACEHOLDER_SECRET.test(secret)) {
		problems.push({
			module: MODULE,
			severity: 'error',
			message: 'jwtSecret looks like a placeholder or dev-default value',
		});
	}

	if (config.secureCookies === false) {
		problems.push({
			module: MODULE,
			severity: 'warning',
			message: 'secureCookies is false — auth cookies may be sent over non-HTTPS connections in production',
		});
	}

	// MFA is on but TOTP secrets have no at-rest encryption key — they'll be
	// stored plaintext. Not fatal (backward-compatible default), but a finding.
	if (config.mfa && !config.mfaSecretKey) {
		problems.push({
			module: MODULE,
			severity: 'warning',
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
