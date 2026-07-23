import type { IAuthConfig } from '../config';

// Single source of truth for the auth token cookie pair, so every login
// path (email, phone, OAuth, MFA, refresh) sets identical attributes.
//
// Secure defaults to NODE_ENV === 'production': in production the tokens
// must never travel over plain HTTP; local HTTP dev keeps working without
// config. Override with secureCookies when the environment variable doesn't
// reflect reality (e.g. HTTPS in staging, TLS-terminating proxy quirks).

function secureAttr(config: IAuthConfig): string {
	const secure = config.secureCookies ?? process.env['NODE_ENV'] === 'production';
	return secure ? '; Secure' : '';
}

// Returns ONE string per cookie. Each must go out as its own `Set-Cookie`
// header — joining them (e.g. with ", ") is invalid HTTP and mangles the
// distinct Paths. Callers append each via `jsonWithCookies`.
export function tokenPairCookies(
	accessToken: string,
	refreshToken: string,
	config: IAuthConfig,
): string[] {
	const secure = secureAttr(config);
	return [
		`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/${secure}`,
		`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh${secure}`,
	];
}

export function clearedTokenCookies(config: IAuthConfig): string[] {
	const secure = secureAttr(config);
	return [
		`access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
		`refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0${secure}`,
	];
}

// Build a Headers object with each cookie as its OWN Set-Cookie entry. Pass it
// straight to `Response.json(body, { status, headers: cookieHeaders(...) })`. A
// plain `{ 'Set-Cookie': [...] }` init coalesces them into one comma-joined
// header (invalid); appending onto a Headers instance keeps them distinct.
export function cookieHeaders(cookies: string[]): Headers {
	const headers = new Headers();
	for (const c of cookies) headers.append('Set-Cookie', c);
	return headers;
}
