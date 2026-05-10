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
	IPhoneVerifyResult,
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

// ── Phone sub-client ─────────────────────────────────────────────────────────

class PhoneClient {
	constructor(private http: HttpClient) {}

	sendVerification(phone: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/phone/send-verification',
			body:   { phone },
		})
	}

	verify(phone: string, otp: string) {
		return this.http.request<IApiResponse<IPhoneVerifyResult>>({
			method: 'POST',
			path:   '/auth/phone/verify',
			body:   { phone, otp },
		})
	}
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
	readonly phone: PhoneClient
	readonly mfa:   MfaClient

	constructor(private http: HttpClient, private accessToken?: string) {
		this.phone = new PhoneClient(http)
		this.mfa   = new MfaClient(http, () => this.accessToken)
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
			path:   '/auth/refresh',
			body:   refreshToken ? { refreshToken } : undefined,
		})
	}

	forgotPassword(email: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/email/forgot-password',
			body:   { email },
		})
	}

	resetPassword(input: IResetPasswordInput) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path:   '/auth/email/reset-password',
			body:   input,
		})
	}

	verifyEmail(pin: string) {
		return this.http.request<IApiResponse<IVerifyEmailResult>>({
			method: 'POST',
			path:   '/auth/email/verify',
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
			path:   '/auth/email/send-verification',
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
