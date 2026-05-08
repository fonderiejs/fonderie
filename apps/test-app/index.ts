import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import {
	FonderieApp,
	defineConfig,
	bodyParserMiddleware
} from '@fonderie-js/core'
import {
	PGAdapter,
	MigrationRunner,
} from '@fonderie-js/store'
import {
	AuthModule,
	requireAuth
} from '@fonderie-js/auth'
import {
	PermissionsModule,
	requirePermission,
	OPERATIONS,
} from '@fonderie-js/permissions'
import {
	WorkspacesModule, 
	workspaceContextMiddleware,
} from '@fonderie-js/workspaces';

import { CourierModule }                                    from '@fonderie-js/courier';

import { BillingModule, StripeProvider, requirePlan }      from '@fonderie-js/billing';

import { RemoteConfigModule, getConfig }                   from '@fonderie-js/config';

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── Config ────────────────────────────────────────────────────────

const config = defineConfig({
	basePath: '/v1',
	db: {
		url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_test',
	},
	auth: {
		jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
		sessionDuration: '7d',
		providers: ['email'],
	},
})

// ── Store ─────────────────────────────────────────────────────────

const store = new PGAdapter(config.db.url)

// ── Migrations ────────────────────────────────────────────────────

const migrations = new MigrationRunner(store, join(__dirname, 'migrations/sql'))
await migrations.run()

// ── Modules ───────────────────────────────────────────────────────

const auth        = new AuthModule(store, config.auth!);
const permissions = new PermissionsModule(store);
const workspaces  = new WorkspacesModule(store);
const courier     = new CourierModule(
	{
		channels: {
			'email-verification':   ['email'],
			'password-reset':       ['email'],
			'workspace-invitation': ['email'],
		},
		templates: {
			source: 'fs', 
			directory: join(__dirname, 'templates'),
		},
		email: {
			provider: 'smtp',
			from:     'Fonderie Dev <noreply@fonderie.dev>',
			smtp: {
				host:   'smtp.ethereal.email',
				port:   587,
				secure: false,
				user:   process.env['SMTP_USER'] ?? '',
				pass:   process.env['SMTP_PASS'] ?? '',
			},
		},
	},
	store,
);

const billing = new BillingModule(store, {
	provider: new StripeProvider(
		process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder',
		process.env['STRIPE_WEBHOOK_SECRET'],
	),
	plans: [
		{
			name:  'free',
			seats: 1,
		},
		{
			name:      'starter',
			seats:     5,
			trialDays: 14,
			monthly:   { amount: 49,  priceId: process.env['STRIPE_STARTER_MONTHLY'] ?? '' },
			yearly:    { amount: 490, priceId: process.env['STRIPE_STARTER_YEARLY']  ?? '' },
		},
		{
			name:    'pro',
			seats:   20,
			monthly: { amount: 149,  priceId: process.env['STRIPE_PRO_MONTHLY'] ?? '' },
			yearly:  { amount: 1490, priceId: process.env['STRIPE_PRO_YEARLY']  ?? '' },
		},
		{
			name:  'enterprise',
			seats: null,
		},
	],
	successUrl: 'http://localhost:3000/billing/success',
	cancelUrl:  'http://localhost:3000/billing/cancel',
});

const remoteConfig = new RemoteConfigModule(store, {
	ttl:         30_000,                                    // refresh every 30 seconds
	environment: process.env['NODE_ENV'] ?? 'development',
});

// ── App ───────────────────────────────────────────────────────────

const app = new FonderieApp(config)
  .use(bodyParserMiddleware())
  .register(remoteConfig) 
  .register(auth)        // populates ctx.user
  .register(permissions) // populates ctx.meta[PERMISSIONS_ENGINE_KEY]
  .register(workspaces)  // registers workspace routes
  .register(courier)     // picks up ctx.meta['message'] after each handler
  .register(billing)     // registers billing routes, syncs plans to DB

// ── Routes ────────────────────────────────────────────────────────

app.addRoute('GET', '/health', async (ctx) => {
	const maintenance = getConfig(ctx, 'maintenance.mode', false);
	if (maintenance) {
		return Response.json({ error: 'Service temporarily unavailable' }, { status: 503 });
	}

	return Response.json({ ok: true, ts: new Date().toISOString(), version: '0.0.1' });
});


// Workspace-scoped + permission-gated
app.addRoute('GET', '/workspaces/:workspaceId/projects',
	requireAuth(),
	workspaceContextMiddleware(store),   // resolves ctx.workspace, validates membership
	requirePermission(OPERATIONS.READ, 'projects'),
	async (ctx) => Response.json({
		workspaceId: ctx.workspace?.id,
		projects:    [],
	})
);

app.addRoute('POST', '/workspaces/:workspaceId/projects',
	requireAuth(),
	workspaceContextMiddleware(store),
	requirePermission(OPERATIONS.CREATE, 'projects'),
	async (ctx) => Response.json({ created: true }, { status: 201 })
);

// Public param route
app.addRoute('GET', '/users/:id', async (ctx) => {
	const params = ctx.meta['params'] as { id: string }
	return Response.json({ userId: params.id });
});

// Config inspection (dev only)
app.addRoute('GET', '/config', requireAuth(), async (ctx) => {
	const env = process.env['NODE_ENV'] ?? 'development';
	if (env === 'production') {
		return Response.json({ error: 'Not available in production' }, { status: 403 });
	}

	return Response.json({ config: remoteConfig.manager.all() });
});

// Routes registered automatically by modules:
//
// AuthModule:
//   POST   /auth/register
//   POST   /auth/login
//   POST   /auth/logout
//   POST   /auth/refresh
//   POST   /auth/verify-email
//   POST   /auth/forgot-password
//   POST   /auth/reset-password
//   POST   /auth/mfa/enable
//   POST   /auth/mfa/verify
//   POST   /auth/mfa/disable
//   GET    /users/me
//   PATCH  /users/me
//   DELETE /users/me
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
//   GET    /workspaces/members
//   DELETE /workspaces/members/:userId
//   GET    /workspaces/members/:userId/roles
//   POST   /workspaces/members/:userId/roles
//   DELETE /workspaces/members/:userId/roles/:roleId
//   GET    /workspaces/invitations
//   POST   /workspaces/invitations
//   DELETE /workspaces/invitations/:inviteId
//   POST   /workspaces/invitations/accept          (no workspace context)
//   POST   /workspaces/roles
//   GET    /workspaces/roles
//   GET    /workspaces/roles/:roleId
//   PUT    /workspaces/roles/:roleId
//   DELETE /workspaces/roles/:roleId
//   POST   /workspaces/roles/:roleId/permissions
//
// BillingModule:
//   GET    /billing/plans
//   POST   /billing/plans
//   GET    /billing/plans/:planId
//   PUT    /billing/plans/:planId
//   DELETE /billing/plans/:planId
//   POST   /billing/webhook
//   GET    /workspaces/:workspaceId/billing/subscription
//   POST   /workspaces/:workspaceId/billing/checkout
//   POST   /workspaces/:workspaceId/billing/portal
//   POST   /workspaces/:workspaceId/billing/usage
//   GET    /workspaces/:workspaceId/billing/usage/:metric

// ── Boot ──────────────────────────────────────────────────────────

await app.boot()

app.listen(3000, {
	name: 'Fonderie',
	version: '0.0.1',
	env: 'development'
})
