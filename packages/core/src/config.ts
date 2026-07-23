export interface IBillingPlan {
	name: string;
	price: number | null; // null = custom/enterprise pricing
	seats: number | 'unlimited';
	interval?: 'month' | 'year';
	trialDays?: number;
}

export interface ISMTPConfig {
	host: string;
	port: number;
	secure: boolean; // true = TLS, false = STARTTLS
	user: string;
	pass: string;
}

export interface FonderieConfig {
	basePath?: string; // e.g. '/v1' — prefixes all routes; defaults to ''

	db: {
		url: string; // Standard postgres:// connection string
		// Future: adapter pattern for other vendors
		// adapter?: 'pg' | 'mysql2' | 'oracledb'  ← v2 concern
	};

	billing?: {
		provider: 'stripe';
		plans: IBillingPlan[];
		stripeSecretKey: string;
	};

	email?: {
		from: string;
		// Credentials from their .env — Fonderie never stores these
		apiKey?: string;
		smtp?: ISMTPConfig;
		provider: 'resend' | 'ses' | 'smtp';
	};

	onError?: (err: unknown) => Response;

	// Transform every JSON response body just before it is sent. Return the new
	// body, or `undefined` to leave that response untouched. This is the single,
	// adapter-agnostic seam for adapting Fonderie's `{ reason, explanation, result }`
	// envelope to an app's own contract (e.g. flat shapes an existing frontend
	// expects) WITHOUT editing handlers. Applied at the one egress point, so it
	// covers every route and every adapter. Status code, headers, and cookies are
	// preserved; only the body shape changes. Non-JSON responses pass through.
	// Opt-in: unset = current behaviour, unchanged.
	onResponse?: (body: unknown, info: { status: number; request: Request }) => unknown;
}

export function defineConfig(config: FonderieConfig): FonderieConfig {
	return config; // typed identity — same pattern as defineConfig in Vite/Nuxt
}
