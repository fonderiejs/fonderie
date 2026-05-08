export interface IAuthConfig {
	jwtSecret:        string;
	sessionDuration?: string ;                         // default '7d'
	providers:        ('email' | 'google' | 'github')[];
	mfa?:             boolean;
	google?: {
		clientId:     string;
		clientSecret: string;
		redirectUri:  string;
	}
}
