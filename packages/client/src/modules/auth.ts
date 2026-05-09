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

export interface IUpdateMeInput {
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

	enable() {
		return this.http.request<IApiResponse<IMfaSetupResult>>({
			method: 'POST',
			path:   '/auth/mfa/enable',
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

	// Call after login/register to store the access token for subsequent requests
	setAccessToken(token: string | undefined) {
		this.accessToken = token
	}

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

	logout(refreshToken?: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/logout',
			body:   refreshToken ? { refreshToken } : undefined,
			token:  this.accessToken,
		})
	}

	refresh(refreshToken?: string) {
		return this.http.request<IApiResponse<IRefreshResult>>({
			method: 'POST',
			path:   '/auth/refresh',
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

	resendVerification() {
		return this.http.request<IApiResponse<IResendVerificationResult>>({
			method: 'POST',
			path:   '/auth/resend-verification',
			token:  this.accessToken,
		})
	}

	me() {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'GET',
			path:   '/users/me',
			token:  this.accessToken,
		})
	}

	updateMe(input: IUpdateMeInput) {
		return this.http.request<IApiResponse<IMeResult>>({
			method: 'PATCH',
			path:   '/users/me',
			body:   input,
			token:  this.accessToken,
		})
	}

	deleteMe() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path:   '/users/me',
			token:  this.accessToken,
		})
	}
}
