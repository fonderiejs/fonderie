import type { IFonderieApp, IReadinessProblem } from '@fonderie/core';

import type { IAdminManifest, IAdminModuleEntry } from './types';

export function buildManifest(app: IFonderieApp, admin: { version: string }): IAdminManifest {
	const report = app.securityReport();
	const byModule = new Map<string, IReadinessProblem[]>();
	for (const p of report.readiness.problems) {
		const list = byModule.get(p.module) ?? [];
		list.push(p);
		byModule.set(p.module, list);
	}
	const describing = new Set(app.adminDescriptions().map((d) => d.module));
	const modules: IAdminModuleEntry[] = report.modules.map(({ name, version }) => {
		const problems = byModule.get(name) ?? [];
		return {
			name,
			version: version ?? null,
			readiness: { ok: !problems.some((p) => p.severity === 'error'), problems },
			describesAdmin: describing.has(name),
		};
	});
	return {
		generatedAt: report.generatedAt,
		env: report.env,
		admin,
		modules,
		readiness: report.readiness,
		routes: app.routes(),
	};
}
