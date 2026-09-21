import type { IAdminCheck, IAdminCheckReport, IReadinessReport, IRouteEntry } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

export interface IAdminOptions {
	// Guards every route. Unset ⇒ the surface is not registered (404), never open.
	adminToken?: string;
	// Reserved for this module; nothing else can mount under it. Default '/_admin'.
	path?: string;
	// Checks only the application can run (pending migrations, a queue it owns).
	checks?: IAdminCheck[];
	// Per check. Default 10 000.
	checkTimeoutMs?: number;
	// Enables the admin log (every request served here, refused ones included)
	// and GET /_admin/activity/admin-log. Run the package's migrations.
	store?: IStoreAdapter;
	// The environment variables this deployment reads. Bricks never read
	// process.env — the app injects config — so only the app can say which
	// names matter. GET /_admin/config reports presence, never values.
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
	// `log` is false when no store was given: admin actions are not being recorded.
	admin: { version: string; log: boolean };
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

export interface IAdminConfigReport {
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

export interface IAdminTokensReport {
	generatedAt: string;
	// The one token guarding /_admin: its readiness verdict.
	admin: { ok: boolean; problems: IReadinessReport['problems'] };
	// Bricks still carrying their own token for the deprecated standalone routes.
	legacy: IAdminTokenEntry[];
}
