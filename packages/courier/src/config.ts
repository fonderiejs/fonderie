import type { DefaultTemplateMap } from './types';

export interface IEmailChannelConfig {
	provider: 'resend' | 'ses' | 'smtp';
	from: string;
	/**
	 * Where replies should go, when that is not the From address.
	 *
	 * Needed as soon as you send from a dedicated sending subdomain — the shape
	 * that isolates sending reputation from the apex. Such a subdomain usually
	 * has no MX at all, so a reply to the From address bounces. Recipients DO
	 * reply to transactional mail (a question about a receipt, a "this wasn't
	 * me" about a password reset), and a bounced reply is worse than no reply:
	 * the sender believes they reached you.
	 *
	 * Set it to an address that actually receives — typically on the apex.
	 */
	replyTo?: string;
	/**
	 * What the doctor's sender-DNS check cannot discover on its own: DKIM
	 * selectors (a selector is not readable from DNS) and the envelope domain
	 * when it differs from the From domain (SPF checks the envelope). See
	 * docs/EMAIL-SETUP.md §7.
	 */
	senderDns?: { dkimSelectors?: string[]; returnPathDomain?: string };
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

	/**
	 * The product name shown in email — the app the RECIPIENT signed up for, not
	 * the framework underneath it. A user of the app has never heard of
	 * Fonderie, so an email headed "Fonderie" reads as a different company at
	 * best and as phishing at worst.
	 *
	 * Set once here rather than per message; a message may still override it by
	 * passing `brandName` in its own data. Unset falls back to EMAIL_THEME.brand.
	 */
	brandName?: string;

	// When set, exposes Bearer-guarded template admin routes (/admin/templates/*)
	// for versioned edit/history/rollback. Requires @fonderie/store (db templates).
	adminToken?: string;

	// Where templates are loaded from
	// 'db' requires @fonderie/store to be configured
	// 'fs' reads from a local directory
	templates?: {
		source: 'db' | 'fs';
		directory?: string; // for 'fs' source
		// Module-shipped default templates. The app imports each module's
		// DEFAULT_TEMPLATES (auth, workspaces, billing, …) and passes them here;
		// the resolver falls back to a default when no app override (DB row / FS
		// file) exists, before the last-resort JSON dump. Aggregated like
		// getMigrationsPath() — pass one map or an array of them.
		defaults?: DefaultTemplateMap | DefaultTemplateMap[];
	};

	// Inbound delivery-webhook verification. FAIL-CLOSED: a provider's route is
	// only registered when its key is set (an unverified endpoint would accept
	// forged delivered/opened/bounced events from anyone who finds the URL).
	delivery?: {
		signingKeys?: {
			// SendGrid signs with ECDSA, not HMAC: this is the base64
			// "Verification Key" (public key) from Settings → Mail Settings →
			// Event Webhook → Signature Verification.
			sendgrid?: string;
			mailgun?: string; // Mailgun HTTP webhook signing key (HMAC-SHA256)
		};
		// Mailtrap's webhook has NO signature scheme, so its route accepts
		// forged events by construction. Explicit dev/test opt-in only.
		allowUnverifiedMailtrap?: boolean;
	};
}
