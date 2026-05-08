// Concrete types — fulfill the stubs in @fonderie-js/core
export interface IUser {
	id:              string;
	email:           string;
	firstName:       string | null;
	lastName:        string | null;
	phone:           string | null;
	profileImageUrl: string | null;
	locale:          string;
	timezone:        string;
	suspended:       boolean;
	deletedAt:       Date | null;
	createdAt:       Date;
	updatedAt:       Date;
	mfaEnabled:      boolean;
	passwordHash:    string | null;
	emailVerifiedAt: Date | null;
}

export interface ISession {
	id:        string;
	token:     string;
	userId:    string;
	userAgent: string | null;
	ipAddress: string | null;
	expiresAt: Date;
	createdAt: Date;
}

export interface IMfaChallenge {
	token:     string;
	userId:    string;
	expiresAt: Date;
	usedAt:    Date | null;
}
