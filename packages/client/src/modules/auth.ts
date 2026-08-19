import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IApiResponse,
	ILoginResult,
	IMeResult,
	IMfaEnabledResult,
	IMfaSetupResult,
	IRefreshResult,
	IRegisterResult,
	IResendVerificationResult,
	IVerifyEmailResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface IRegisterInput {
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
}

export interface ILoginInput {
	email: string;
	password: string;
}

export interface IResetPasswordInput {
	// The 6-digit code emailed by forgotPassword. Matches @fonderie/auth's
	// resetPasswordSchema ({ pin, password }); the route is POST /auth/email/reset.
	pin: string;
	password: string;
}

// User updates are split by @fonderie/auth into dedicated, individually
// validated routes — there is no combined /users/update endpoint.
export interface IUpdateProfileInput {
	firstName?: string;
	lastName?: string;
	avatarUrl?: string;
}

export interface IUpdatePreferencesInput {
	locale?: string;
	timezone?: string;
	notifications?: unknown;
	emailDigest?: unknown;
	dateFormat?: unknown;
	timeFormat?: unknown;
}

export interface IChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

// ── MFA sub-client ───────────────────────────────────────────────────────────

class MfaClient {
	constructor(
		private http: HttpClient,
		private token: () => string | undefined,
	) {}

	setup() {
		return this.http.request<IApiResponse<IMfaSetupResult>>({
			method: 'POST',
			path: '/auth/mfa/setup',
			token: this.token(),
		});
	}

	verify(token: string) {
		return this.http.request<IApiResponse<IMfaEnabledResult>>({
			method: 'POST',
			path: '/auth/mfa/verify',
			body: { token },
			token: this.token(),
		});
	}

	// MFA-login: complete a login that returned MFA_REQUIRED. Authenticates with
	// the temporary `mfaToken` (not the session) and verifies the TOTP `code` —
	// same route as `verify`, different auth context. Returns the completed login.
	verifyLogin(mfaToken: string, code: string) {
		return this.http.request<IApiResponse<ILoginResult>>({
			method: 'POST',
			path: '/auth/mfa/verify',
			body: { token: code },
			token: mfaToken,
		});
	}

	disable(token: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/auth/mfa/disable',
			body: { token },
			token: this.token(),
		});
	}

	// POST /auth/mfa/backup-codes (mfaTokenSchema { token }) — returns a fresh set.
	regenerateBackupCodes(token: string) {
		return this.http.request<IApiResponse<{ backupCodes: string[] }>>({
			method: 'POST',
			path: '/auth/mfa/backup-codes',
			body: { token },
			token: this.token(),
		});
	}
}

// ── Auth client ──────────────────────────────────────────────────────────────

export class AuthClient {
	readonly mfa: MfaClient;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {
		this.mfa = new MfaClient(http, () => this.tokens.get());
	}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// ── Public ─────────────────────────────────────────────────────────────────

	register(input: IRegisterInput) {
		return this.http.request<IApiResponse<IRegisterResult>>({
			method: 'POST',
			path: '/auth/register',
			body: input,
		});
	}

	login(input: ILoginInput) {
		return this.http.request<IApiResponse<ILoginResult>>({
			method: 'POST',
			path: '/auth/login',
			body: input,
		});
	}

	refreshTokens(refreshToken?: string) {
		return this.http.request<IApiResponse<IRefreshResult>>({
			method: 'POST',
			path: '/auth/refresh',
			body: refreshToken ? { refreshToken } : undefined,
		});
	}

	forgotPassword(email: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/auth/email/forgot',
			body: { email },
		});
	}

	resetPassword(input: IResetPasswordInput) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/auth/email/reset',
			body: input,
		});
	}

	verifyEmail(token: string) {
		// @fonderie/auth registers this as POST /auth/verify with body { token }
		// (verifySchema = { token: sixDigitPin }).
		return this.http.request<IApiResponse<IVerifyEmailResult>>({
			method: 'POST',
			path: '/auth/verify',
			body: { token },
			token: this.tokens.get(),
		});
	}

	// ── Protected ──────────────────────────────────────────────────────────────

	logout(refreshToken?: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/auth/logout',
			body: refreshToken ? { refreshToken } : undefined,
			token: this.tokens.get(),
		});
	}

	sendVerificationEmail() {
		// @fonderie/auth registers this as GET /auth/send-verification (requireAuth).
		return this.http.request<IApiResponse<IResendVerificationResult>>({
			method: 'GET',
			path: '/auth/send-verification',
			token: this.tokens.get(),
		});
	}

	// ── Protected + Verified ───────────────────────────────────────────────────

	getUser() {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'GET',
			path: '/users',
			token: this.tokens.get(),
		});
	}

	updateProfile(input: IUpdateProfileInput) {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'PUT',
			path: '/users/profile',
			body: input,
			token: this.tokens.get(),
		});
	}

	updatePreferences(input: IUpdatePreferencesInput) {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'PUT',
			path: '/users/preferences',
			body: input,
			token: this.tokens.get(),
		});
	}

	updateEmail(email: string) {
		return this.http.request<IApiResponse<unknown>>({
			method: 'PUT',
			path: '/users/email',
			body: { email },
			token: this.tokens.get(),
		});
	}

	updatePhone(phone: string) {
		return this.http.request<IApiResponse<unknown>>({
			method: 'PUT',
			path: '/users/phone',
			body: { phone },
			token: this.tokens.get(),
		});
	}

	changePassword(input: IChangePasswordInput) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: '/users/password',
			body: input,
			token: this.tokens.get(),
		});
	}

	// GET /users/export — the caller's own data as a portable bundle (SAR).
	exportData() {
		return this.http.request<IApiResponse<unknown>>({
			method: 'GET',
			path: '/users/export',
			token: this.tokens.get(),
		});
	}

	deleteUser() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: '/users',
			token: this.tokens.get(),
		});
	}
}
