import type { IAuthConfig } from '../config';

// Placeholder / dev-default secrets we never want signing tokens in production.
// These distinctive fragments won't appear in a real random secret (e.g. the
// output of `openssl rand -base64 32`), so matching one is a strong signal the
// secret was copy-pasted from an example rather than generated.
const PLACEHOLDER_SECRET =
	/dev-secret|test-secret|changeme|change-me|your[-_]secret|placeholder|example|insecure|min-32-chars/i;

// Minimum length for an HS256 signing secret — 256 bits.
const MIN_SECRET_LENGTH = 32;

// Production-readiness guard for the auth config. Called automatically when an
// `AuthModule` is constructed (fail-fast, before boot), and exported so an app
// can run its own preflight. In production a weak `jwtSecret` is fatal — a
// forgeable token is an auth bypass — so we refuse to boot; outside production
// the same problems are a loud warning so dev/test still run.
export function validateAuthConfig(config: IAuthConfig): void {
	const isProduction = process.env['NODE_ENV'] === 'production';
	const secret = config.jwtSecret ?? '';
	const problems: string[] = [];

	if (secret.length < MIN_SECRET_LENGTH) {
		problems.push(
			`jwtSecret must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`,
		);
	}
	if (PLACEHOLDER_SECRET.test(secret)) {
		problems.push('jwtSecret looks like a placeholder or dev-default value');
	}

	if (problems.length > 0) {
		const message =
			`[auth] insecure config — ${problems.join('; ')}. ` +
			'Set a long, random jwtSecret (e.g. `openssl rand -base64 32`).';
		if (isProduction) {
			throw new Error(`${message} Refusing to boot in production.`);
		}
		console.warn(`${message} (permitted outside production)`);
	}

	// Cookies without Secure in production means tokens can traverse plain HTTP.
	if (isProduction && config.secureCookies === false) {
		console.warn(
			'[auth] secureCookies is false in production — auth cookies may be sent over non-HTTPS connections.',
		);
	}
}
