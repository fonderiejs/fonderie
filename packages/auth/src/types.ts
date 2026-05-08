// Concrete types — fulfill the stubs in @fonderie-js/core
export interface IUser {
	id:              string;
	email:           string;
	suspended:       boolean;
	deletedAt:       Date | null;
	createdAt:       Date;
	mfaEnabled:      boolean;
	passwordHash:    string | null;
	emailVerifiedAt: Date | null;
}

export interface ISession {
	id:        string;
	token:     string;
	userId:    string;
	expiresAt: Date;
	createdAt: Date;
}

export interface IMfaChallenge {
	token:     string;           // short-lived, single-use
	userId:    string;
	expiresAt: Date;
}
