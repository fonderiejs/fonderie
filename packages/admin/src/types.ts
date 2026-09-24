import type { IAdminCheck, IAdminCheckReport, IReadinessReport, IRouteEntry } from '@fonderie/core';
import type { IStoreAdapter, MigrationImpact } from '@fonderie/store';

export interface IAdminOptions {
	// Guards every route. Unset ⇒ the surface is not registered (404), never open.
	adminToken?: string;
	// Reserved for this module; nothing else can mount under it. Default '/_admin'.
	path?: string;
	// Checks only the application can run (pending migrations, a queue it owns).
	checks?: IAdminCheck[];
	// Per check. Default 10 000.
	checkTimeoutMs?: number;
	/**
	 * The ordered migration sets this deployment applies, exactly as its own
	 * applier runs them — brick directories and the app's own, interleaved.
	 * Unset ⇒ the migrations routes are not registered at all.
	 *
	 * Pass the SAME constant the applier reads. The order is the app's to
	 * declare and this surface must never infer it: bricks and app migrations
	 * depend on each other across the list, and a panel guessing that order
	 * would eventually guess wrong in a way that only shows on a fresh database.
	 */
	migrations?: ReadonlyArray<IMigrationSet>;
	// Serve the built dashboard at <path>/ui. Off by default: it is 200 KB of
	// JavaScript most deployments reach through their own frontend instead.
	ui?: boolean;
	/**
	 * Answer only for requests addressed to this hostname (or one of these);
	 * anything else gets the same 404 an unmounted surface gives. Port optional:
	 * 'admin.example.com' also matches 'admin.example.com:8443'.
	 *
	 * ⚠️ NOT an access control. The `Host` header is set by the client, so this
	 * is only worth anything when something upstream decides the hostname and
	 * your origin is not reachable around it. Same footgun as `trustProxy` in
	 * @fonderie/core's client-ip middleware.
	 *
	 * What it DOES buy, concretely: on a platform that gives every deployment a
	 * permanent URL of its own (`project-abc.vercel.app`), that URL answers
	 * whatever your custom domain answers — walking straight around anything you
	 * put in front of the domain. Binding the surface to the domain closes that
	 * hole while the rest of the app keeps serving on both.
	 *
	 * What it does NOT buy: protection from someone sending the right `Host` to
	 * your origin directly. Only the edge can stop that — a WAF/firewall rule on
	 * the admin path, or an origin locked to the proxy.
	 */
	host?: string | string[];
	// Enables the admin log (every request served here, refused ones included)
	// and GET /_admin/activity/admin-log. Run the package's migrations.
	store?: IStoreAdapter;
	// The environment variables this deployment reads. Bricks never read
	// process.env — the app injects config — so only the app can say which
	// names matter. GET /_admin/environment reports presence, never values.
	env?: string[];
}

export interface IAdminModuleEntry {
	name: string;
	// null when the module does not report one.
	version: string | null;
	readiness: IReadinessReport;
	// Whether the module implements describeAdmin() — silence is visible, not "nothing".
	describesAdmin: boolean;
}

export interface IAdminManifest {
	generatedAt: string;
	env: string;
	// `log` is false when no store was given: admin actions are not being
	// recorded. `host` is null when the surface answers on any hostname.
	admin: { version: string; log: boolean; host: string[] | null };
	modules: IAdminModuleEntry[];
	readiness: IReadinessReport;
	routes: IRouteEntry[];
}

export interface IAdminCheckResult extends IAdminCheckReport {
	name: string;
	module: string;
	durationMs: number;
}

export interface IAdminDoctorReport {
	generatedAt: string;
	ok: boolean;
	checks: IAdminCheckResult[];
}

export interface IAdminAttentionItem {
	source: string;
	severity: 'error' | 'advice';
	message: string;
}

export interface IAdminAttention {
	generatedAt: string;
	ok: boolean;
	items: IAdminAttentionItem[];
}

export interface IAdminLogEntry {
	id: string;
	at: string;
	actor: string;
	method: string;
	path: string;
	route: string;
	module: string;
	status: number;
	durationMs: number;
	requestId: string | null;
	clientIp: string | null;
}

export interface IAdminLogPage {
	entries: IAdminLogEntry[];
	// Pass as `before` for the next page; null at the end.
	next: string | null;
}

export interface IAdminEnvEntry {
	name: string;
	set: boolean;
}

export interface IAdminEnvironmentReport {
	generatedAt: string;
	readiness: IReadinessReport;
	// Readiness problems grouped by module, modules with none included.
	modules: Array<{ name: string; problems: IReadinessReport['problems'] }>;
	env: IAdminEnvEntry[];
}

export type AdminRouteGuard = 'admin' | 'probe' | 'app';

export interface IAdminRouteEntry extends IRouteEntry {
	// 'admin': behind this module's token. 'probe': core's health routes.
	// 'app': everything else — whether it needs a session is not derivable here.
	guard: AdminRouteGuard;
}

export interface IAdminRoutesReport {
	generatedAt: string;
	routes: IAdminRouteEntry[];
}

export interface IAdminTokenEntry {
	module: string;
	// Whether a legacy per-module adminToken is set (the standalone surface).
	set: boolean;
}

// read: every GET except secret reveal · write: every mutation · secrets: anything under /secrets.
export type AdminScope = 'read' | 'write' | 'secrets';

// An issued token, never its hash or plaintext.
export interface IAdminTokenRecord {
	id: string;
	name: string;
	scopes: AdminScope[];
	createdBy: string;
	createdAt: string;
	expiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
}

export interface IAdminTokensReport {
	generatedAt: string;
	// The bootstrap token guarding /_admin (the root): its readiness verdict.
	admin: { ok: boolean; problems: IReadinessReport['problems'] };
	// Bricks still carrying their own token for the deprecated standalone routes.
	legacy: IAdminTokenEntry[];
	// Issued scoped tokens; null when no store was given (issuing is off).
	issued: IAdminTokenRecord[] | null;
}

// One entry of the app's migration sequence: a label and the directory holding
// that module's .sql files. Structurally identical to the app's own
// MIGRATION_STEPS so the same constant feeds the applier and this surface.
export type IMigrationSet = readonly [name: string, dir: string];

export interface IAdminPendingMigration {
	file: string;
	impact: MigrationImpact;
	// The statements that earned a 'destructive' label, as written — so the
	// operator reads WHAT would be lost rather than a generic warning.
	destructive: string[];
}

export interface IAdminMigrationModule {
	name: string;
	pending: IAdminPendingMigration[];
	// The first EARLIER module that is behind, or null. Order is the app's and
	// migrations depend on each other across it, so a module with something
	// unapplied in front of it cannot be applied yet.
	blockedBy: string | null;
	// Whether the panel will apply this one: something to do, nothing in front
	// of it, and nothing in it that deletes data.
	appliable: boolean;
}

export interface IAdminMigrationsReport {
	// False when this database has no fonderie_migrations rows — a first
	// install, where "destructive" has nothing to destroy.
	everApplied: boolean;
	modules: IAdminMigrationModule[];
}
