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

// ── Billing ──────────────────────────────────────────────────────────────────

export interface IPlanFeature {
	name: string;
	description: string;
	enabled: boolean;
	limit?: number;
}

export interface IPlanDTO {
	id: string;
	planId: string;
	name: string;
	description: string;
	tier: number;
	seats: number | null;
	trialDays: number;
	pricing: {
		monthly: number; // in cents, e.g. 1999 = $19.99
		yearly: number; // in cents
		currency: string; // ISO 4217, e.g. 'USD'
	};
	features: IPlanFeature[];
	metadata: Record<string, unknown>;
}

export type SubscriberType = 'user' | 'workspace';

export interface ISubscriptionDTO {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	interval: string;
	status: string;
	cancelAtPeriodEnd: boolean;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	trialEndsAt: string | null;
	createdAt: string;
}

export interface IPlanListResult {
	plans: IPlanDTO[];
}

export interface IPlanResult {
	plan: IPlanDTO;
}

export interface ISubscriptionResult {
	subscription: ISubscriptionDTO;
}

export interface ICheckoutUrlResult {
	url: string;
}

export interface IPortalUrlResult {
	url: string;
}

export interface IUsageResult {
	metric: string;
	total: number;
	since: string;
}
