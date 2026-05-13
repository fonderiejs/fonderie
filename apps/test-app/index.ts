import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import {
	FonderieApp,
	defineConfig,
} from '@fonderie-js/core';

import type { IFonderieContext } 		 from '@fonderie-js/core';
import { PGAdapter, MigrationRunner } 	 from '@fonderie-js/store';
import { RemoteConfigModule, getConfig } from '@fonderie-js/config';
import { LoggerModule }                  from '@fonderie-js/logger';
import { CourierModule }                 from '@fonderie-js/courier';
import { BillingModule, StripeProvider,
         hasFeature, getPlanLimit,
         requireFeature }                from '@fonderie-js/billing';
import { withBody, requireAuth } 		 from '@fonderie-js/core/middlewares';

import { AuthModule, AUTH_CONFIG_KEYS, MESSAGE_KEYS as AUTH_MESSAGE_KEYS } from '@fonderie-js/auth';
import type { IAuthConfig, IAuthRuntimeConfig }                            from '@fonderie-js/auth';
import { WorkspacesModule, withWorkspace, MESSAGE_KEYS as WS_MESSAGE_KEYS } from '@fonderie-js/workspaces';
import { PermissionsModule, requirePermission, OPERATIONS } from '@fonderie-js/permissions';

import { getMigrationsPath as authMigrations }        from '@fonderie-js/auth/migrations';
import { getMigrationsPath as configMigrations }      from '@fonderie-js/config/migrations';
import { getMigrationsPath as billingMigrations }     from '@fonderie-js/billing/migrations';
import { getMigrationsPath as courierMigrations }     from '@fonderie-js/courier/migrations';
import { getMigrationsPath as workspacesMigrations }  from '@fonderie-js/workspaces/migrations';
import { getMigrationsPath as permissionsMigrations } from '@fonderie-js/permissions/migrations';

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
	appName:         'DemoApplication',
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
	authMigrations(),
	permissionsMigrations(),
	workspacesMigrations(),
	billingMigrations(),
	configMigrations(),
	courierMigrations(),
]) {
	await new MigrationRunner(store, dir).run()
}

// ── Modules ───────────────────────────────────────────────────────

const logger      = new LoggerModule()
const auth        = new AuthModule(store, authConfig);

const permissions = new PermissionsModule(store);
const workspaces  = new WorkspacesModule(store);
const courier     = new CourierModule(
	{
		channels: {
			[AUTH_MESSAGE_KEYS.emailRegistration]:          ['email'],
			[AUTH_MESSAGE_KEYS.emailVerification]:          ['email'],
			[AUTH_MESSAGE_KEYS.passwordReset]:              ['email'],
			[AUTH_MESSAGE_KEYS.phoneOtp]:                   ['sms'],
			[AUTH_MESSAGE_KEYS.mfaEnabled]:                 ['email'],
			[AUTH_MESSAGE_KEYS.mfaDisabled]:                ['email'],
			[AUTH_MESSAGE_KEYS.mfaBackupCodesRegenerated]:  ['email'],
			[AUTH_MESSAGE_KEYS.emailChanged]:               ['email'],
			[AUTH_MESSAGE_KEYS.phoneChanged]:               ['email'],
			[WS_MESSAGE_KEYS.workspaceInvitation]:          ['email'],
		},
		templates: {
			source: 'fs', 
			directory: join(__dirname, 'templates'),
		},
		email: {
			provider: 'smtp',
			from:     'Fonderie Dev <noreply@fonderie.dev>',
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
);

const remoteConfig = new RemoteConfigModule(store, {
	ttl:         30_000,
	environment: process.env['NODE_ENV'] ?? 'development',
});

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
				'projects':  { limit: 3 },
				'seats':     { limit: 1,      warnAt: 1.0 },
				'analytics': { enabled: false },
				'sso':       { enabled: false },
				'sla':       { enabled: false },
				'support':   { enabled: false },
			},
		},
		{
			name:        'starter',
			description: 'For small teams getting started',
			tier:        1,
			trialDays:   14,
			monthly:     { amount: 2900,  priceId: process.env['STRIPE_STARTER_MONTHLY'] ?? '' },
			yearly:      { amount: 29000, priceId: process.env['STRIPE_STARTER_YEARLY']  ?? '' },
			defaults:    { warnAt: 0.8, buffer: 0 },
			policy: {
				'api-calls': { limit: 10_000,  buffer: 500,  warnAt: 0.9, window: '1d' },
				'projects':  { limit: 10 },
				'seats':     { limit: 5,        warnAt: 1.0 },
				'analytics': { enabled: true },
				'sso':       { enabled: false },
				'sla':       { enabled: false },
				'support':   { enabled: false },
			},
		},
		{
			name:        'pro',
			description: 'For growing teams who need more power',
			tier:        2,
			monthly:     { amount: 7900,  priceId: process.env['STRIPE_PRO_MONTHLY'] ?? '' },
			yearly:      { amount: 79000, priceId: process.env['STRIPE_PRO_YEARLY']  ?? '' },
			defaults:    { warnAt: 0.85, buffer: 0 },
			policy: {
				'api-calls': { limit: 100_000, buffer: 5_000, warnAt: 0.9, window: '1d' },
				'projects':  { limit: null },
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
				'projects':  { limit: null },
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
});

// ── App ───────────────────────────────────────────────────────────

const app = new FonderieApp(config)
  .use(withBody)
  .register(logger)      // request logging + requestId on ctx.meta
  .register(remoteConfig)
  .register(auth)        // populates ctx.user
  .register(permissions) // populates ctx.meta[PERMISSIONS_ENGINE_KEY]
  .register(workspaces)  // registers workspace routes
  .register(courier)     // picks up ctx.meta['message'] after each handler
  .register(billing)     // registers billing routes, syncs plans to DB

// ── Routes ────────────────────────────────────────────────────────

app.addRoute('GET', '/health', async (ctx: IFonderieContext) => {
	const maintenance = getConfig(ctx, 'maintenance.mode', false);
	if (maintenance) {
		return Response.json({ error: 'Service temporarily unavailable' }, { status: 503 });
	}

	return Response.json({ ok: true, ts: new Date().toISOString(), version: '0.0.1' });
});

// Workspace-scoped + permission-gated
app.addRoute('GET', '/workspaces/:workspaceId/projects',
	requireAuth,
	withWorkspace(store),   // resolves ctx.workspace, validates membership
	requirePermission(OPERATIONS.READ, 'projects'),
	async (ctx: IFonderieContext) => Response.json({
		workspaceId: ctx.workspace?.id,
		projects:    [],
	})
);

app.addRoute('POST', '/workspaces/:workspaceId/projects',
	requireAuth,
	withWorkspace(store),
	requirePermission(OPERATIONS.CREATE, 'projects'),
	async (ctx: IFonderieContext) => Response.json({ created: true }, { status: 201 })
);

// Config inspection (dev only)
app.addRoute('GET', '/config', requireAuth, async (ctx: IFonderieContext) => {
	const env = process.env['NODE_ENV'] ?? 'development';
	if (env === 'production') {
		return Response.json({ error: 'Not available in production' }, { status: 403 });
	}

	return Response.json({ config: remoteConfig.manager.all() });
});

// ── Billing-gated route examples ──────────────────────────────────
//
// requireFeature reads ctx.meta['billing'] set by withBilling (auto-applied
// by BillingModule). No store argument — pure in-process check.

// Feature flag gate — 402 for plans without 'analytics' enabled
app.addRoute('GET', '/workspaces/:workspaceId/analytics',
	requireAuth,
	withWorkspace(store),
	requirePermission(OPERATIONS.READ, 'analytics'),
	requireFeature('analytics'),
	async (ctx: IFonderieContext) => Response.json({
		workspaceId: ctx.workspace?.id,
		metrics:     [],
	})
);

// Inline limit check — returns remaining project quota in the response
app.addRoute('GET', '/workspaces/:workspaceId/projects/quota',
	requireAuth,
	withWorkspace(store),
	async (ctx: IFonderieContext) => {
		const limit = getPlanLimit(ctx, 'projects')
		return Response.json({
			workspaceId: ctx.workspace?.id,
			limit,
			unlimited: limit === null,
		})
	}
);

// Conditional response shape based on plan capability
app.addRoute('GET', '/workspaces/:workspaceId/settings/sso',
	requireAuth,
	withWorkspace(store),
	requirePermission(OPERATIONS.READ, 'settings'),
	async (ctx: IFonderieContext) => {
		if (!hasFeature(ctx, 'sso')) {
			return Response.json(
				{ error: 'SSO is not available on your current plan' },
				{ status: 402 },
			)
		}
		return Response.json({ sso: { enabled: false, provider: null } })
	}
);

// Routes registered automatically by modules:
//
// AuthModule:
//   POST   /auth/register
//   POST   /auth/login
//   POST   /auth/logout
//   POST   /auth/refresh
//
//   POST   /auth/email/forgot
//   POST   /auth/email/reset
//
//   GET    /auth/send-verification       (requires auth — sends to email or phone based on loginMethod)
//   POST   /auth/verify                  (requires auth — verifies email or phone OTP)
//
//   POST   /auth/mfa/setup               (requires auth + verified email + email login)
//   POST   /auth/mfa/verify              (requires auth + verified email + email login)
//   POST   /auth/mfa/disable             (requires auth + verified email + email login)
//   POST   /auth/mfa/backup-codes        (requires auth + verified email + email login)
//
//   GET    /auth/google                  (only when GOOGLE_CLIENT_ID is set)
//   GET    /auth/google/callback         (only when GOOGLE_CLIENT_ID is set)
//
//   GET    /users                        (requires auth)
//   PUT    /users/profile                (requires auth + verified email)
//   PUT    /users/preferences            (requires auth + verified email)
//   PUT    /users/email                  (requires auth + verified email)
//   PUT    /users/phone                  (requires auth + verified email)
//   DELETE /users                        (requires auth + verified email)
//
// BillingModule:
//   GET    /plans                                      (public)
//   GET    /plans/:planId                              (public)
//
//   — user-level billing (subscriber = authenticated user) —
//   GET    /billing/subscription
//   POST   /billing/checkout
//   POST   /billing/portal
//   POST   /billing/usage
//   GET    /billing/usage/:metric
//
//   — workspace-level billing (subscriber = workspaceId path param) —
//   GET    /workspaces/:workspaceId/billing/subscription
//   POST   /workspaces/:workspaceId/billing/checkout
//   POST   /workspaces/:workspaceId/billing/portal
//   POST   /workspaces/:workspaceId/billing/usage
//   GET    /workspaces/:workspaceId/billing/usage/:metric
//
//   POST   /billing/webhook
//
// WorkspacesModule:  (workspace resolved from X-Workspace-ID header unless noted)
//   POST   /workspaces
//   GET    /workspaces
//   GET    /workspaces/:id                         (path-based)
//   PUT    /workspaces/:id                         (path-based)
//   POST   /workspaces/archive
//   POST   /workspaces/restore
//   GET    /workspaces/settings
//   PUT    /workspaces/settings
//
//   GET    /workspaces/members
//   DELETE /workspaces/members/:userId
//   GET    /workspaces/members/:userId/roles
//   POST   /workspaces/members/:userId/roles
//   DELETE /workspaces/members/:userId/roles/:roleId
//
//   GET    /workspaces/invitations
//   POST   /workspaces/invitations
//   DELETE /workspaces/invitations/:inviteId
//   POST   /workspaces/invitations/accept          (no workspace context)
//
//   POST   /workspaces/roles
//   GET    /workspaces/roles
//   GET    /workspaces/roles/:roleId
//   PUT    /workspaces/roles/:roleId
//   DELETE /workspaces/roles/:roleId
//   POST   /workspaces/roles/:roleId/permissions
//
//   GET    /workspaces/:workspaceId/billing/subscription
//   POST   /workspaces/:workspaceId/billing/checkout
//   POST   /workspaces/:workspaceId/billing/portal
//   POST   /workspaces/:workspaceId/billing/usage
//   GET    /workspaces/:workspaceId/billing/usage/:metric

// ── Boot ──────────────────────────────────────────────────────────

await app.boot()

app.listen(4000, {
	name: 'Fonderie',
	version: '0.0.1',
	env: 'development'
})
