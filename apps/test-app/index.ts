import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import { Hono }        from 'hono';
import { serve }       from '@hono/node-server';

import { EventsModule } from '@fonderie-js/events';
import { LoggerModule } from '@fonderie-js/logger';
import { FonderieApp, defineConfig } from '@fonderie-js/core';
import { withBody } from '@fonderie-js/core/middlewares';
import { CourierModule, Channel } from '@fonderie-js/courier';
import { PGAdapter, MigrationRunner } from '@fonderie-js/store';
import { RemoteConfigModule, getConfig } from '@fonderie-js/config';
import type { IAuthConfig, IAuthRuntimeConfig } from '@fonderie-js/auth';
import { getMigrationsPath as authMigrations } from '@fonderie-js/auth/migrations';
import { getMigrationsPath as eventsMigrations } from '@fonderie-js/events/migrations';
import { getMigrationsPath as configMigrations } from '@fonderie-js/config/migrations';
import { getMigrationsPath as billingMigrations } from '@fonderie-js/billing/migrations';
import { getMigrationsPath as courierMigrations } from '@fonderie-js/courier/migrations';
import { PermissionsModule, requirePermission, OPERATIONS } from '@fonderie-js/permissions';
import { getMigrationsPath as workspacesMigrations } from '@fonderie-js/workspaces/migrations';
import { getMigrationsPath as permissionsMigrations } from '@fonderie-js/permissions/migrations';
import { AuthModule, AUTH_CONFIG_KEYS, MESSAGE_KEYS as AUTH_MESSAGE_KEYS } from '@fonderie-js/auth';
import { WorkspacesModule, withWorkspace, MESSAGE_KEYS as WS_MESSAGE_KEYS } from '@fonderie-js/workspaces';
import { BillingModule, StripeProvider, hasFeature, getPlanLimit, requireFeature } from '@fonderie-js/billing';
import { WebhooksModule } from '@fonderie-js/webhooks';
import { getMigrationsPath as webhooksMigrations } from '@fonderie-js/webhooks/migrations';
import { AuditModule } from '@fonderie-js/audit';
import { requireAuth } from '@fonderie-js/core/middlewares';
import { bridge, adapt, mount } from '@fonderie-js/adapter-hono';

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── Config ────────────────────────────────────────────────────────

const config = defineConfig({
	basePath: '/v1',
	db: {
		url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_test',
	},
})

const googleClientId     = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];
const googleCallbackUrl  = process.env['GOOGLE_CALLBACK_URL'] ?? 'http://127.0.0.1:4000/v1/auth/google/callback';

const authConfig: IAuthConfig = {
	jwtSecret:       process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	sessionDuration: '7d',
	appName:         'CrewFinding',
	providers:       ['email', 'phone', ...(googleClientId ? ['google' as const] : [])],
	...(googleClientId && googleClientSecret ? {
		google: {
			clientId:    googleClientId,
			redirectUri:  googleCallbackUrl,
			clientSecret: googleClientSecret,
		},
	} : {}),
	resolve: (ctx: { meta: Record<string, unknown> }): Partial<IAuthRuntimeConfig> => ({
		verificationCooldown: Number(getConfig(ctx, AUTH_CONFIG_KEYS.verificationCooldown)) || undefined,
		sessionDuration:      String(getConfig(ctx, AUTH_CONFIG_KEYS.sessionDuration))      || undefined,
		mfa:                  Boolean(getConfig(ctx, AUTH_CONFIG_KEYS.mfa))                 || undefined,
	}),
}

// ── Store ─────────────────────────────────────────────────────────

const store = new PGAdapter(config.db.url)

// ── Migrations ────────────────────────────────────────────────────

for (const dir of [
	eventsMigrations(),
	authMigrations(),
	permissionsMigrations(),
	workspacesMigrations(),
	billingMigrations(),
	configMigrations(),
	courierMigrations(),
	webhooksMigrations(),
]) {
	await new MigrationRunner(store, dir).run()
}

// ── Modules ───────────────────────────────────────────────────────

const logger      = new LoggerModule()
const events      = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })
const auth        = new AuthModule(store, authConfig, events.bus)

const permissions = new PermissionsModule(store)
const workspaces  = new WorkspacesModule(store, {}, events.bus)
const courier     = new CourierModule(
	{
		channels: {
			[AUTH_MESSAGE_KEYS.emailRegistration]:         [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.emailVerification]:         [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.passwordReset]:             [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.phoneOtp]:                  [Channel.SMS],
			[AUTH_MESSAGE_KEYS.mfaEnabled]:                [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.mfaDisabled]:               [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.mfaBackupCodesRegenerated]: [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.emailChanged]:              [Channel.EMAIL],
			[AUTH_MESSAGE_KEYS.phoneChanged]:              [Channel.EMAIL],
			[WS_MESSAGE_KEYS.workspaceInvitation]:         [Channel.EMAIL],
		},
		templates: {
			source:    'fs',
			directory: join(__dirname, 'templates'),
		},
		email: {
			provider: 'smtp',
			from:     'CrewFinding <noreply@crewfinding.app>',
			smtp: {
				host:   process.env['SMTP_HOST'] ?? 'smtp.ethereal.email',
				port:   Number(process.env['SMTP_PORT'] ?? 587),
				secure: process.env['SMTP_SECURE'] === 'true',
				user:   process.env['SMTP_USER'] ?? '',
				pass:   process.env['SMTP_PASS'] ?? '',
			},
		},
	},
	store,
	events.bus,
)

const remoteConfig = new RemoteConfigModule(store, {
	ttl:         30_000,
	environment: process.env['NODE_ENV'] ?? 'development',
})

const billing = new BillingModule(store, {
	provider: new StripeProvider(
		process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder',
		process.env['STRIPE_WEBHOOK_SECRET'],
	),
	rateLimit:     { backend: 'memory' },
	notifications: { warnAt: true, softHit: true },
	plans: [
		{
			name:        'free',
			description: 'Get started at no cost',
			tier:        0,
			defaults:    { warnAt: 0.8, buffer: 0 },
			policy: {
				'api-calls': { limit: 1_000,  buffer: 100, warnAt: 0.9, window: '1d' },
				'jobs':      { limit: 10 },
				'seats':     { limit: 1,      warnAt: 1.0 },
				'analytics': { enabled: false },
				'sso':       { enabled: false },
				'sla':       { enabled: false },
				'support':   { enabled: false },
			},
		},
		{
			name:        'starter',
			description: 'For small crews getting started',
			tier:        1,
			trialDays:   14,
			monthly:     { amount: 2900,  priceId: process.env['STRIPE_STARTER_MONTHLY'] ?? '' },
			yearly:      { amount: 29000, priceId: process.env['STRIPE_STARTER_YEARLY']  ?? '' },
			defaults:    { warnAt: 0.8, buffer: 0 },
			policy: {
				'api-calls': { limit: 10_000,  buffer: 500,  warnAt: 0.9, window: '1d' },
				'jobs':      { limit: 100 },
				'seats':     { limit: 5,        warnAt: 1.0 },
				'analytics': { enabled: true },
				'sso':       { enabled: false },
				'sla':       { enabled: false },
				'support':   { enabled: false },
			},
		},
		{
			name:        'pro',
			description: 'For growing companies who need more',
			tier:        2,
			monthly:     { amount: 7900,  priceId: process.env['STRIPE_PRO_MONTHLY'] ?? '' },
			yearly:      { amount: 79000, priceId: process.env['STRIPE_PRO_YEARLY']  ?? '' },
			defaults:    { warnAt: 0.85, buffer: 0 },
			policy: {
				'api-calls': { limit: 100_000, buffer: 5_000, warnAt: 0.9, window: '1d' },
				'jobs':      { limit: null },
				'seats':     { limit: 20,       warnAt: 1.0 },
				'analytics': { enabled: true },
				'sso':       { enabled: false },
				'sla':       { enabled: false },
				'support':   { enabled: false },
			},
		},
		{
			name:        'enterprise',
			description: 'Custom contracts for large organisations',
			tier:        3,
			defaults:    { warnAt: 0.9, buffer: 0 },
			policy: {
				'api-calls': { limit: null },
				'jobs':      { limit: null },
				'seats':     { limit: null },
				'analytics': { enabled: true },
				'sso':       { enabled: true },
				'sla':       { enabled: true },
				'support':   { enabled: true },
			},
		},
	],
	successUrl: 'http://localhost:4000/billing/success',
	cancelUrl:  'http://localhost:4000/billing/cancel',
})

// ── App ───────────────────────────────────────────────────────────

const webhooks = new WebhooksModule(store, {}, events.bus)
const audit    = new AuditModule(store)

const fonderie = new FonderieApp(config)
	.use(withBody)
	.register(logger)
	.register(events)
	.register(remoteConfig)
	.register(auth)
	.register(permissions)
	.register(workspaces)
	.register(courier)
	.register(billing)
	.register(webhooks)
	.register(audit)

await fonderie.boot()

// ── Hono app ──────────────────────────────────────────────────────
//
// bridge() runs fonderie's global middleware for every request, populating
// c.var._fonderie with { user, workspace, meta }.
//
// User business routes are written in plain Hono. adapt() wraps any fonderie
// middleware (requireAuth, withWorkspace, requirePermission, requireFeature)
// to run against the shared fonderie context.
//
// mount() registers fonderie's infrastructure routes (auth, billing,
// workspaces, webhooks, audit) as a catch-all — always registered LAST.

const hono = new Hono()

hono.use('*', bridge(fonderie))

// ── Health ────────────────────────────────────────────────────────

hono.get('/v1/health', async (c) => {
	const fCtx = c.get('_fonderie')
	const maintenance = getConfig(fCtx, 'maintenance.mode', false)
	if (maintenance) {
		return c.json({ error: 'Service temporarily unavailable' }, 503)
	}
	return c.json({ ok: true, ts: new Date().toISOString(), version: '0.0.1' })
})

// ── Jobs ──────────────────────────────────────────────────────────

hono.get('/v1/jobs',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.READ, 'jobs')),
	(c) => {
		const { workspace } = c.get('_fonderie')
		return c.json({ workspaceId: workspace?.id, jobs: [] })
	}
)

hono.post('/v1/jobs',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.CREATE, 'jobs')),
	(c) => c.json({ created: true }, 201)
)

hono.get('/v1/jobs/quota',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	(c) => {
		const fCtx = c.get('_fonderie')
		const limit = getPlanLimit(fCtx, 'jobs')
		return c.json({ workspaceId: fCtx.workspace?.id, limit, unlimited: limit === null })
	}
)

// ── Clients ───────────────────────────────────────────────────────

hono.get('/v1/clients',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.READ, 'clients')),
	(c) => {
		const { workspace } = c.get('_fonderie')
		return c.json({ workspaceId: workspace?.id, clients: [] })
	}
)

hono.post('/v1/clients',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.CREATE, 'clients')),
	(c) => c.json({ created: true }, 201)
)

// ── Analytics — plan-gated ────────────────────────────────────────

hono.get('/v1/analytics',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.READ, 'analytics')),
	adapt(requireFeature('analytics')),
	(c) => {
		const { workspace } = c.get('_fonderie')
		return c.json({ workspaceId: workspace?.id, metrics: [] })
	}
)

// ── SSO settings ──────────────────────────────────────────────────

hono.get('/v1/settings/sso',
	adapt(requireAuth),
	adapt(withWorkspace(store)),
	adapt(requirePermission(OPERATIONS.READ, 'settings')),
	(c) => {
		const fCtx = c.get('_fonderie')
		if (!hasFeature(fCtx, 'sso')) {
			return c.json({ error: 'SSO is not available on your current plan' }, 402)
		}
		return c.json({ sso: { enabled: false, provider: null } })
	}
)

// ── Config (dev only) ─────────────────────────────────────────────

hono.get('/v1/config',
	adapt(requireAuth),
	(c) => {
		if (process.env['NODE_ENV'] === 'production') {
			return c.json({ error: 'Not available in production' }, 403)
		}
		return c.json({ config: remoteConfig.manager.all() })
	}
)

// ── Fonderie infrastructure catch-all ────────────────────────────
// Handles: /v1/auth/*, /v1/billing/*, /v1/workspaces/*,
//          /v1/webhooks/*, /v1/audit, /v1/plans/*

mount(hono, fonderie)

// ── Serve ─────────────────────────────────────────────────────────

serve({ fetch: hono.fetch, port: 4000 }, (info) => {
	console.log(
		`\n  ƒ CrewFinding  development` +
		`\n\n  Local    http://localhost:${info.port}\n`
	)
})

// Infrastructure routes registered automatically by fonderie modules:
//
// AuthModule:        POST /v1/auth/register, /v1/auth/login, /v1/auth/logout …
// BillingModule:     GET  /v1/plans, POST /v1/billing/checkout …
// WorkspacesModule:  POST /v1/workspaces, GET /v1/workspaces/members …
// WebhooksModule:    POST /v1/webhooks, GET /v1/webhooks/:id/deliveries …
// AuditModule:       GET  /v1/audit

