// ── Envelope ─────────────────────────────────────────────────────────────────

export interface IApiResponse<T = undefined> {
	reason: string;
	explanation: string;
	result: T;
}

export interface IApiError {
	reason: string;
	explanation: string;
	details?: unknown;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface IUserPreferences {
	locale: string;
	timezone: string;
	notifications: { email: boolean; inApp: boolean; sms: boolean; push: boolean };
	emailDigest: string;
	dateFormat: string;
	timeFormat: string;
}

export interface IUserSkill {
	name: string;
	level: string;
}

export interface IUserDTO {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	profileImageUrl: string;
	isActive: boolean;
	lastLogin: string;
	skills: IUserSkill[];
	preferences: IUserPreferences;
	isEmailVerified: boolean;
	mfaEnabled: boolean;
	suspended: boolean;
	whitelist: boolean;
	ipWhitelist: string[];
	createdAt: string;
	updatedAt: string;
}

export interface ITokens {
	access: string;
	refresh: string;
}

// ── Auth endpoint results ─────────────────────────────────────────────────────

export interface IRegisterResult {
	tokens: ITokens;
	user: IUserDTO;
}

export interface ILoginResult {
	tokens: ITokens;
	user: IUserDTO;
}

export interface IRefreshResult {
	tokens: ITokens;
}

export interface IVerifyEmailResult {
	verified: boolean;
	email: string;
}

export interface IResendVerificationResult {
	stat: string;
	message: string;
	data: {
		token: string;
		expiresAt: string;
		email: string;
	};
}

export interface IMeResult {
	user: IUserDTO;
}

export interface IMfaSetupResult {
	secret: string;
	uri: string;
}

export interface IMfaEnabledResult {
	tokens: ITokens;
	user: IUserDTO;
}

export interface IPhoneVerifyResult {
	tokens: ITokens;
	user: IUserDTO;
}
