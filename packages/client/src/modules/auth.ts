import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IStepUpMethodsResult,
	IStepUpProof,
	IStepUpResult,
	IReadOptions,
	IApiResponse,
	ILoginResult,
	IMfaRequiredResult,
	IMeResult,
	IMfaEnabledResult,
	IMfaSetupResult,
	IRefreshResult,
	IRegisterResult,
	IResendVerificationResult,
	IVerifyEmailResult,
	ILoginHistoryPageResult,
	ISessionsResult,
	IAuthProvidersResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

// NOTE: the server's register/login schemas also accept a { phone } variant
// (OTP-based phone auth). It is deliberately not surfaced in the typed client
// yet — doing it properly needs a verifyPhone completion method plus hooks in
// all three frontend frameworks, which is its own cycle. Tracked in
// docs/DTO-GAP-AUDIT.md.
export interface IRegisterInput {
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
	/**
	 * The language the person is signing up in (e.g. 'fr-CA'). Stored on the
	 * account, so the verification email already arrives in it. Omitted: the
	 * app's system locale.
	 */
	locale?: string;
}

// Account deletion (docs/ACCOUNT-DELETION-DESIGN.md): a code to the channel the
// person picks, then confirm; signing in to the archived account offers to keep it.
export interface IRequestAccountDeletionInput {
	channel: 'email' | 'sms';
}

export interface IRequestAccountDeletionResult {
	channel: 'email' | 'sms';
	expiresInSeconds: number;
	/** Two-factor is on: confirm with a code from the authenticator (or a backup code) too. */
	mfaRequired: boolean;
}

export interface IConfirmAccountDeletionInput {
	code: string;
	mfaCode?: string;
}

export interface IAccountDeletionResult {
	requestedAt: string;
	/** When the account and its data are permanently deleted (ISO instant). */
	deleteOn: string;
}

export interface IRestoreAccountInput {
	/** From the ACCOUNT_PENDING_DELETION refusal — see pendingDeletionOf(). */
	restoreToken: string;
	mfaCode?: string;
}

export interface IGetLoginHistoryInput {
	outcome?: 'success' | 'failed';
	from?: Date;
	to?: Date;
	limit?: number;
	cursor?: string;
}

export interface ILoginInput {
	email: string;
	password: string;
}

// Native Sign in with Apple: the app obtains an `identityToken` from the native
// Apple sheet (e.g. expo-apple-authentication) and hands it here — the client
// only relays it to POST /auth/apple/native. `nonce` is the raw nonce the app
// passed to the native request, checked server-side against the token claim.
export interface IAppleNativeInput {
	identityToken: string;
	nonce?: string;
}

// Native Sign in with Google: the app obtains an `idToken` from the Google
// SDK (e.g. @react-native-google-signin/google-signin) and hands it here — the
// client only relays it to POST /auth/google/native.
export interface IGoogleNativeInput {
	idToken: string;
	nonce?: string;
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
	// Explicit null clears the field server-side (same pattern as
	// IUpdateWorkspaceInput); undefined leaves it untouched.
	firstName?: string | null;
	lastName?: string | null;
	avatarUrl?: string | null;
}

export interface IUpdatePreferencesInput {
	locale?: string;
	timezone?: string;
	// Replaces the stored notifications object; flags left out fall back to
	// the server defaults on read.
	notifications?: { email?: boolean; inApp?: boolean; sms?: boolean; push?: boolean };
	emailDigest?: string;
	dateFormat?: string;
	timeFormat?: string;
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

	/** Whether this client holds an access token (signed in, as far as the device knows). */
	hasAccessToken(): boolean {
		return Boolean(this.tokens.get());
	}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
		// Signing out (token → undefined) also drops the shared response cache,
		// so the hooks' logout paths can't leak one session's data to the next.
		if (!token) this.http.clearCache();
	}

	// ── Public ─────────────────────────────────────────────────────────────────

	/**
	 * Which sign-in methods this deployment can actually honour.
	 *
	 * Public — the login screen needs it before anyone has signed in. Ask the
	 * server rather than shipping a build-time flag: the flag stores the same
	 * fact twice and lets the two disagree, and the symptom is a user clicking
	 * a provider the server cannot complete and landing on the provider's own
	 * error page, which the app cannot explain.
	 */
	providers() {
		return this.http.request<IApiResponse<IAuthProvidersResult>>({
			method: 'GET',
			path: '/auth/providers',
		});
	}

	/**
	 * Disconnect the OAuth provider linked to the signed-in account.
	 *
	 * Refused with 409 PASSWORD_REQUIRED when the account has no password:
	 * removing the only credential is account deletion, not a settings toggle.
	 * Check `user.hasPassword` before offering the control so the user is asked
	 * to set a password first rather than shown an error they can't act on.
	 */
	unlinkOauth(provider: string) {
		return this.http.request<IApiResponse<null>>({
			method: 'DELETE',
			path: `/auth/oauth/${encodeURIComponent(provider)}`,
		});
	}

	register(input: IRegisterInput) {
		return this.http.request<IApiResponse<IRegisterResult>>({
			method: 'POST',
			path: '/auth/register',
			body: input,
		});
	}

	login(input: ILoginInput) {
		return this.http.request<IApiResponse<ILoginResult | IMfaRequiredResult>>({
			method: 'POST',
			path: '/auth/login',
			body: input,
		});
	}

	// Complete a native Sign in with Apple. Answers like login: a token/user
	// envelope, or — when the account has MFA — `{ mfaToken }` to finish with
	// mfa.verifyLogin (check with isMfaRequired). Requires the API to enable
	// the provider (`providers: ['apple']` + apple config).
	appleNative(input: IAppleNativeInput) {
		return this.http.request<IApiResponse<ILoginResult | IMfaRequiredResult>>({
			method: 'POST',
			path: '/auth/apple/native',
			body: input,
		});
	}

	// Complete a native Sign in with Google. Same answers as appleNative.
	// Requires the API to enable the provider with `google.nativeClientIds`.
	googleNative(input: IGoogleNativeInput) {
		return this.http.request<IApiResponse<ILoginResult | IMfaRequiredResult>>({
			method: 'POST',
			path: '/auth/google/native',
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
			// A send-action on a GET route: never serve it from the cache, or a
			// resend inside the TTL would silently no-op.
			cache: false,
		});
	}

	// ── Protected + Verified ───────────────────────────────────────────────────

	getUser(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'GET',
			path: '/users',
			token: this.tokens.get(),
			bust: opts?.bust,
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

	/** @deprecated Deletes with no proof and no notice — use requestAccountDeletion + confirmAccountDeletion. */
	deleteUser() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: '/users',
			token: this.tokens.get(),
		});
	}

	// ── Step-up: prove it's still you before a big move ─────────────────────
	// GET /auth/step-up — which proofs this account can give.
	stepUpMethods() {
		return this.http.request<IApiResponse<IStepUpMethodsResult>>({
			method: 'GET',
			path: '/auth/step-up',
			token: this.tokens.get(),
		});
	}

	// POST /auth/step-up/code — a code to the account's email or phone.
	requestStepUpCode(channel: 'email' | 'sms') {
		return this.http.request<IApiResponse<{ channel: 'email' | 'sms'; expiresInSeconds: number }>>({
			method: 'POST',
			path: '/auth/step-up/code',
			body: { channel },
			token: this.tokens.get(),
		});
	}

	// POST /auth/step-up — on success the proof is held and sent with the
	// requests that follow (five minutes), so retrying the big move works.
	async stepUp(proof: IStepUpProof) {
		const res = await this.http.request<IApiResponse<IStepUpResult>>({
			method: 'POST',
			path: '/auth/step-up',
			body: proof,
			token: this.tokens.get(),
		});
		this.http.setStepUp(res.result.stepUpToken, res.result.expiresAt);
		return res;
	}

	// POST /users/me/deletion — sends the confirmation code. 409 with the
	// blocker's reason (e.g. OWNS_TEAM_WORKSPACE) when the account can't go yet.
	requestAccountDeletion(input: IRequestAccountDeletionInput) {
		return this.http.request<IApiResponse<IRequestAccountDeletionResult>>({
			method: 'POST',
			path: '/users/me/deletion',
			body: input,
			token: this.tokens.get(),
		});
	}

	// POST /users/me/deletion/confirm — the code (+ second factor) closes the
	// account at once; it is permanently deleted on `deleteOn` unless kept.
	confirmAccountDeletion(input: IConfirmAccountDeletionInput) {
		return this.http.request<IApiResponse<IAccountDeletionResult>>({
			method: 'POST',
			path: '/users/me/deletion/confirm',
			body: input,
			token: this.tokens.get(),
		});
	}

	// POST /auth/account/restore — "Keep my account" after a sign-in answered
	// ACCOUNT_PENDING_DELETION. Signs in like login.
	restoreAccount(input: IRestoreAccountInput) {
		return this.http.request<IApiResponse<ILoginResult>>({
			method: 'POST',
			path: '/auth/account/restore',
			body: input,
		});
	}

	// ── Security surfaces (login history + active sessions) ─────────────────────

	// GET /auth/login-history — the caller's own attempts, newest first,
	// keyset-paginated (pass the previous page's nextCursor to continue).
	getLoginHistory(input: IGetLoginHistoryInput = {}, opts?: IReadOptions) {
		const params = new URLSearchParams();
		if (input.limit !== undefined) params.set('limit', String(input.limit));
		if (input.outcome) params.set('outcome', input.outcome);
		if (input.from) params.set('from', input.from.toISOString());
		if (input.to) params.set('to', input.to.toISOString());
		if (input.cursor) params.set('cursor', input.cursor);
		const qs = params.toString();
		// Single-level template (no nested backtick) so the client/route drift
		// checker can normalise the ${qs…} suffix away and match the server route.
		return this.http.request<IApiResponse<ILoginHistoryPageResult>>({
			method: 'GET',
			path: `/auth/login-history${qs ? '?' + qs : ''}`,
			token: this.tokens.get(),
			bust: opts?.bust,
		});
	}

	// GET /auth/sessions — the caller's live sessions; one is flagged current.
	listSessions(opts?: IReadOptions) {
		return this.http.request<IApiResponse<ISessionsResult>>({
			method: 'GET',
			path: '/auth/sessions',
			token: this.tokens.get(),
			bust: opts?.bust,
		});
	}

	// DELETE /auth/sessions/:id — revoke one of the caller's sessions.
	terminateSession(id: string) {
		return this.http.request<IApiResponse<{ id: string }>>({
			method: 'DELETE',
			path: `/auth/sessions/${encodeURIComponent(id)}`,
			token: this.tokens.get(),
		});
	}

	// DELETE /auth/sessions/others — revoke every session except the current one.
	terminateOtherSessions() {
		return this.http.request<IApiResponse<{ count: number }>>({
			method: 'DELETE',
			path: '/auth/sessions/others',
			token: this.tokens.get(),
		});
	}
}
