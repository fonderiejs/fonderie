export const DEFAULT_VERIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export interface IAuthConfig {
	jwtSecret:             string;
	sessionDuration?:      string;                     // default '7d'
	providers:             ('email' | 'phone' | 'google' | 'github')[];
	mfa?:                  boolean;
	verificationCooldown?: number;                     // ms, default DEFAULT_VERIFICATION_COOLDOWN
	google?: {
		clientId:     string;
		clientSecret: string;
		redirectUri:  string;
	}
}
