import type { IReadinessReport, IRouteEntry } from '@fonderie/core';

export interface IAdminOptions {
	// Guards every route. Unset ⇒ the surface is not registered (404), never open.
	adminToken?: string;
	// Reserved for this module; nothing else can mount under it. Default '/_admin'.
	path?: string;
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
	admin: { version: string };
	modules: IAdminModuleEntry[];
	readiness: IReadinessReport;
	routes: IRouteEntry[];
}
