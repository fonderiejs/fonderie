import { AuditModule }               from '@fonderie/audit';
import { AuthModule }                from '@fonderie/auth';
import { BillingModule, StripeProvider } from '@fonderie/billing';
import { FonderieApp, defineConfig } from '@fonderie/core';
import { Channel }                   from '@fonderie/courier';
import { EventsModule }              from '@fonderie/events';
import { PGAdapter }                 from '@fonderie/store';
import { WorkspacesModule }          from '@fonderie/workspaces';

// Everything the mobile starter needs, assembled from Fonderie modules:
//
//   auth        sign in / register / refresh / MFA
//   workspaces  the organization and its members and invitations
//   billing     plans and the current subscription
//   audit       the activity feed
//   events      the bus the audit log is built from
//
// The app's own resource — projects — is an ordinary table, in project.model.ts.
const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_mobile' },
})

export const store = new PGAdapter(config.db.url)

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })

const auth = new AuthModule(store, {
	jwtSecret:           process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:             'SaaS Starter',
	providers:           [Channel.EMAIL],
	// Off for local development so you can sign in the moment you register.
	// Turn it on before you ship.
	requireVerification: false,
}, events.bus)

export { config }

export const fonderie = new FonderieApp(config)
	.register(events)
	.register(auth)
	.register(new WorkspacesModule(store, {}, events.bus))
	.register(new BillingModule(store, {
		// The Stripe client is constructed lazily, so a placeholder key is fine
		// locally: listing plans and reading the subscription both come from the
		// database. You only need a real key to open a checkout session.
		provider: new StripeProvider(process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder'),
		successUrl: process.env['BILLING_SUCCESS_URL'] ?? 'saasstarter://settings/billing',
		cancelUrl:  process.env['BILLING_CANCEL_URL']  ?? 'saasstarter://settings/billing',
		// Seeded into the database on boot, so GET /plans returns these immediately.
		// Amounts are in cents. Feature names are shown verbatim by the app — put an
		// i18n key here instead if you want them translated.
		plans: [
			{
				name: 'Free', tier: 0, description: 'For trying things out',
				monthly: { amount: 0 }, yearly: { amount: 0 },
				metadata: { seats: 2, projectLimit: 3 },
			},
			{
				name: 'Pro', tier: 1, description: 'For a growing team',
				monthly: { amount: 1900, lookupKey: 'pro_monthly' },
				yearly:  { amount: 19000, lookupKey: 'pro_yearly' },
				metadata: { seats: 10, projectLimit: null },
			},
			{
				name: 'Business', tier: 2, description: 'For a whole company',
				monthly: { amount: 4900, lookupKey: 'business_monthly' },
				yearly:  { amount: 49000, lookupKey: 'business_yearly' },
				metadata: { seats: null, projectLimit: null },
			},
		],
	}))
	.register(new AuditModule(store))

await fonderie.boot()
