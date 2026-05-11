import {
	FonderieApp,
	defineConfig,
} from '@fonderie-js/core'
import type { IFonderieContext } from '@fonderie-js/core'
import { withBody, requireAuth } from '@fonderie-js/core/middlewares'
import {
	PGAdapter,
	MigrationRunner,
} from '@fonderie-js/store'
import { AuthModule, AUTH_CONFIG_KEYS }           from '@fonderie-js/auth'
import type { IAuthConfig, IAuthRuntimeConfig }   from '@fonderie-js/auth'
import {
	PermissionsModule,
	requirePermission,
	OPERATIONS,
} from '@fonderie-js/permissions'
import {
	WorkspacesModule,
	withWorkspace,
} from '@fonderie-js/workspaces';

import { CourierModule }                from '@fonderie-js/courier';
import { BillingModule, StripeProvider } from '@fonderie-js/billing';
import { RemoteConfigModule, getConfig } from '@fonderie-js/config';

import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import { getMigrationsPath as authMigrations }        from '@fonderie-js/auth/migrations';
import { getMigrationsPath as permissionsMigrations } from '@fonderie-js/permissions/migrations';
import { getMigrationsPath as workspacesMigrations }  from '@fonderie-js/workspaces/migrations';
import { getMigrationsPath as billingMigrations }     from '@fonderie-js/billing/migrations';
import { getMigrationsPath as configMigrations }      from '@fonderie-js/config/migrations';
import { getMigrationsPath as courierMigrations }     from '@fonderie-js/courier/migrations';

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
			clientSecret: googleClientSecret,
			redirectUri:  googleCallbackUrl,
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

const auth        = new AuthModule(store, authConfig);

const permissions = new PermissionsModule(store);
const workspaces  = new WorkspacesModule(store);
const courier     = new CourierModule(
	{
		channels: {
			'email-registration':   ['email'],
			'email-verification':   ['email'],
			'password-reset':       ['email'],
			'workspace-invitation': ['email'],
			'phone-otp':            ['sms'],
			'mfa-enabled':                    ['email'],
			'mfa-disabled':                   ['email'],
			'mfa-backup-codes-regenerated':   ['email'],
			'email-changed':                  ['email'],
			'phone-changed':                  ['email'],
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
	plans: [
		{
			name:        'free',
			description: 'Get started at no cost',
			tier:        0,
			seats:       1,
			features: [
				{ name: 'Projects',   description: 'Up to 3 projects',    enabled: true,  limit: 3    },
				{ name: 'Storage',    description: '1 GB storage',         enabled: true,  limit: 1    },
				{ name: 'API access', description: 'Up to 1 000 req/day',  enabled: true,  limit: 1000 },
				{ name: 'Analytics',  description: 'Basic analytics',      enabled: false              },
				{ name: 'SSO',        description: 'SAML single sign-on',  enabled: false              },
				{ name: 'SLA',        description: '99.9 % uptime SLA',    enabled: false              },
				{ name: 'Support',    description: 'Dedicated support',    enabled: false              },
			],
		},
		{
			name:        'starter',
			description: 'For small teams getting started',
			tier:        1,
			seats:       5,
			trialDays:   14,
			monthly:     { amount: 2900,  priceId: process.env['STRIPE_STARTER_MONTHLY'] ?? '' },
			yearly:      { amount: 29000, priceId: process.env['STRIPE_STARTER_YEARLY']  ?? '' },
			features: [
				{ name: 'Projects',   description: 'Up to 10 projects',    enabled: true,  limit: 10    },
				{ name: 'Storage',    description: '10 GB storage',         enabled: true,  limit: 10    },
				{ name: 'API access', description: 'Up to 10 000 req/day',  enabled: true,  limit: 10000 },
				{ name: 'Analytics',  description: 'Basic analytics',       enabled: true               },
				{ name: 'SSO',        description: 'SAML single sign-on',   enabled: false              },
				{ name: 'SLA',        description: '99.9 % uptime SLA',     enabled: false              },
				{ name: 'Support',    description: 'Dedicated support',     enabled: false              },
			],
		},
		{
			name:        'pro',
			description: 'For growing teams who need more power',
			tier:        2,
			seats:       20,
			monthly:     { amount: 7900,  priceId: process.env['STRIPE_PRO_MONTHLY'] ?? '' },
			yearly:      { amount: 79000, priceId: process.env['STRIPE_PRO_YEARLY']  ?? '' },
			features: [
				{ name: 'Projects',   description: 'Unlimited projects',    enabled: true                 },
				{ name: 'Storage',    description: '100 GB storage',        enabled: true,  limit: 100    },
				{ name: 'API access', description: 'Up to 100 000 req/day', enabled: true,  limit: 100000 },
				{ name: 'Analytics',  description: 'Advanced analytics',    enabled: true                 },
				{ name: 'SSO',        description: 'SAML single sign-on',   enabled: false                },
				{ name: 'SLA',        description: '99.9 % uptime SLA',     enabled: false                },
				{ name: 'Support',    description: 'Dedicated support',     enabled: false                },
			],
		},
		{
			name:        'enterprise',
			description: 'Custom contracts for large organisations',
			tier:        3,
			seats:       null,
			features: [
				{ name: 'Projects',   description: 'Unlimited projects',   enabled: true },
				{ name: 'Storage',    description: 'Unlimited storage',    enabled: true },
				{ name: 'API access', description: 'Unlimited requests',   enabled: true },
				{ name: 'Analytics',  description: 'Custom analytics',     enabled: true },
				{ name: 'SSO',        description: 'SAML single sign-on',  enabled: true },
				{ name: 'SLA',        description: '99.9 % uptime SLA',    enabled: true },
				{ name: 'Support',    description: 'Dedicated support',    enabled: true },
			],
		},
	],
	successUrl: 'http://localhost:4000/billing/success',
	cancelUrl:  'http://localhost:4000/billing/cancel',
});

// ── App ───────────────────────────────────────────────────────────

const app = new FonderieApp(config)
  .use(withBody)
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
//   GET    /plans
//   POST   /plans
//   GET    /plans/:planId
//   PUT    /plans/:planId
//   DELETE /plans/:planId
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
