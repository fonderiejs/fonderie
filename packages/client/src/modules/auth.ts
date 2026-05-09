import type { HttpClient }                  from '../http'
import type {
	IApiResponse,
	IRegisterResult,
	ILoginResult,
	IRefreshResult,
	IVerifyEmailResult,
	IResendVerificationResult,
	IMeResult,
	IMfaSetupResult,
	IMfaEnabledResult,
} from '../types'

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface IRegisterInput {
	email:      string
	password:   string
	firstName?: string
	lastName?:  string
}

export interface ILoginInput {
	email:    string
	password: string
}

export interface IResetPasswordInput {
	resetToken: string
	password:   string
}

export interface IUpdateUserInput {
	firstName?:   string
	lastName?:    string
	phoneNumber?: string
	avatarUrl?:   string
	locale?:      string
	timezone?:    string
	preferences?: Record<string, unknown>
}

// ── MFA sub-client ───────────────────────────────────────────────────────────

class MfaClient {
	constructor(
		private http:  HttpClient,
		private token: () => string | undefined,
	) {}

	setup() {
		return this.http.request<IApiResponse<IMfaSetupResult>>({
			method: 'POST',
			path:   '/auth/mfa/setup',
			token:  this.token(),
		})
	}

	verify(code: string) {
		return this.http.request<IApiResponse<IMfaEnabledResult>>({
			method: 'POST',
			path:   '/auth/mfa/verify',
			body:   { token: code },
			token:  this.token(),
		})
	}

	disable(code: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/mfa/disable',
			body:   { code },
			token:  this.token(),
		})
	}
}

// ── Auth client ──────────────────────────────────────────────────────────────

export class AuthClient {
	readonly mfa: MfaClient

	constructor(private http: HttpClient, private accessToken?: string) {
		this.mfa = new MfaClient(http, () => this.accessToken)
	}

	setAccessToken(token: string | undefined) {
		this.accessToken = token
	}

	// ── Public ─────────────────────────────────────────────────────────────────

	register(input: IRegisterInput) {
		return this.http.request<IApiResponse<IRegisterResult>>({
			method: 'POST',
			path:   '/auth/register',
			body:   input,
		})
	}

	login(input: ILoginInput) {
		return this.http.request<IApiResponse<ILoginResult>>({
			method: 'POST',
			path:   '/auth/login',
			body:   input,
		})
	}

	refreshTokens(refreshToken?: string) {
		return this.http.request<IApiResponse<IRefreshResult>>({
			method: 'POST',
			path:   '/auth/refresh-tokens',
			body:   refreshToken ? { refreshToken } : undefined,
		})
	}

	forgotPassword(email: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/forgot-password',
			body:   { email },
		})
	}

	resetPassword(input: IResetPasswordInput) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/reset-password',
			body:   input,
		})
	}

	verifyEmail(pin: string) {
		return this.http.request<IApiResponse<IVerifyEmailResult>>({
			method: 'POST',
			path:   '/auth/verify-email',
			body:   { pin },
		})
	}

	// ── Protected ──────────────────────────────────────────────────────────────

	logout(refreshToken?: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/logout',
			body:   refreshToken ? { refreshToken } : undefined,
			token:  this.accessToken,
		})
	}

	sendVerificationEmail() {
		return this.http.request<IApiResponse<IResendVerificationResult>>({
			method: 'POST',
			path:   '/auth/send-verification-email',
			token:  this.accessToken,
		})
	}

	// ── Protected + Verified ───────────────────────────────────────────────────

	getUser() {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'GET',
			path:   '/users',
			token:  this.accessToken,
		})
	}

	updateUser(input: IUpdateUserInput) {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'PUT',
			path:   '/users/update',
			body:   input,
			token:  this.accessToken,
		})
	}

	deleteUser() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path:   '/users',
			token:  this.accessToken,
		})
	}
}
