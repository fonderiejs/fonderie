export interface IBillingPlan {
	name:       string
	price:      number | null    // null = custom/enterprise pricing
	seats:      number | 'unlimited'
	interval?:  'month' | 'year'
	trialDays?: number
}

export interface ISMTPConfig {
	host:     string
	port:     number
	secure:   boolean            // true = TLS, false = STARTTLS
	user:     string
	pass:     string
}

export interface FonderieConfig {
	basePath?: string   // e.g. '/v1' — prefixes all routes; defaults to ''

	db: {
		url: string       // Standard postgres:// connection string
		// Future: adapter pattern for other vendors
		// adapter?: 'pg' | 'mysql2' | 'oracledb'  ← v2 concern
	}

	billing?: {
		provider: 'stripe'
		plans: IBillingPlan[]
		stripeSecretKey: string
	}

	email?: {
		from: string
		// Credentials from their .env — Fonderie never stores these
		apiKey?: string
		smtp?: ISMTPConfig
		provider: 'resend' | 'ses' | 'smtp'
	}

	onError?: (err: unknown) => Response
}

export function defineConfig(config: FonderieConfig): FonderieConfig {
	return config  // typed identity — same pattern as defineConfig in Vite/Nuxt
}
