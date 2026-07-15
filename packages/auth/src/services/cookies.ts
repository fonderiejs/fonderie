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

export function tokenPairCookies(
	accessToken: string,
	refreshToken: string,
	config: IAuthConfig,
): string {
	const secure = secureAttr(config);
	return [
		`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/${secure}`,
		`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh${secure}`,
	].join(', ');
}

export function clearedTokenCookies(config: IAuthConfig): string {
	const secure = secureAttr(config);
	return [
		`access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
		`refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0${secure}`,
	].join(', ');
}
