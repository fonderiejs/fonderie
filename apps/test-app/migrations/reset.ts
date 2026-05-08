import { PGAdapter } from '@fonderie-js/store';

const store = new PGAdapter(
	process.env['DATABASE_URL'] ?? 'postgres://fonderie:fonderie@localhost:5432/fonderie_test'
);

// Drop in reverse dependency order so FK constraints don't block
await store.query(`
	DROP TABLE IF EXISTS
		fonderie_usage_records,
		fonderie_subscriptions,
		fonderie_plans,
		fonderie_role_permissions,
		fonderie_workspace_invitations,
		fonderie_role_user_workspaces,
		fonderie_roles,
		fonderie_workspaces,
		fonderie_config,
		fonderie_mfa_challenges,
		fonderie_sessions,
		fonderie_password_resets,
		fonderie_email_verifications,
		fonderie_users,
		fonderie_courier_templates,
		fonderie_message_log,
		fonderie_migrations
	CASCADE
`);

console.log('[reset] all fonderie tables dropped');
process.exit(0);
