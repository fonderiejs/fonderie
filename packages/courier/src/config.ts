export interface IEmailChannelConfig {
	provider: 'resend' | 'ses' | 'smtp';
	from: string;
	apiKey?: string;
	smtp?: {
		host: string;
		port: number;
		secure: boolean;
		user: string;
		pass: string;
	};
}

export interface ISmsChannelConfig {
	provider: 'twilio' | 'vonage';
	from: string;
	accountSid?: string; // twilio
	authToken?: string; // twilio
	apiKey?: string; // vonage
	apiSecret?: string; // vonage
}

export interface IPushChannelConfig {
	provider: 'fcm';
	serviceAccount: Record<string, unknown>;
}

export const Channel = {
	EMAIL: 'email',
	SMS: 'sms',
	PUSH: 'push',
} as const satisfies Record<string, 'email' | 'sms' | 'push'>;

export interface ICourierConfig {
	// Which channels handle which message types
	// e.g. { 'password-reset': ['email'], 'new-message': ['push', 'sms'] }
	channels: Record<string, Array<'email' | 'sms' | 'push'>>;

	sms?: ISmsChannelConfig;
	push?: IPushChannelConfig;
	email?: IEmailChannelConfig;

	// Where templates are loaded from
	// 'db' requires @fonderie-js/store to be configured
	// 'fs' reads from a local directory
	templates?: {
		source: 'db' | 'fs';
		directory?: string; // for 'fs' source
	};
}
