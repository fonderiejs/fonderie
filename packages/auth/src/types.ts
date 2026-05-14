export interface IUserPreferences {
	locale: string;
	timezone: string;
	notifications: {
		email: boolean;
		inApp: boolean;
		sms: boolean;
		push: boolean;
	};
	emailDigest: string;
	dateFormat?: string;
	timeFormat?: string;
}

// Concrete types — fulfill the stubs in @fonderie-js/core
export interface IUser {
	id: string;
	email: string | null;
	firstName: string | null;
	lastName: string | null;
	phone: string | null;
	profileImageUrl: string | null;
	locale: string;
	timezone: string;
	isActive: boolean;
	lastLogin: Date | null;
	preferences: IUserPreferences;
	suspended: boolean;
	whitelist: boolean;
	ipWhitelist: string[];
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	mfaEnabled: boolean;
	passwordHash: string | null;
	emailVerifiedAt: Date | null;
}

export interface ISession {
	id: string;
	token: string;
	userId: string;
	userAgent: string | null;
	ipAddress: string | null;
	expiresAt: Date;
	createdAt: Date;
}

export interface IMfaChallenge {
	token: string;
	userId: string;
	expiresAt: Date;
	usedAt: Date | null;
}
