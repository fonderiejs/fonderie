import type { IFonderieApp, IFonderieModule, IReadinessProblem, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import { requireAdminToken, validateAdminToken } from '@fonderie/core/middlewares';

import { attention, collectChecks, runDoctor } from './doctor';
import { adminLog, readAdminLog } from './log';
import { buildManifest } from './manifest';
import { configReport, routesReport, tokensReport } from './pages';
import type { IAdminOptions } from './types';

export const DEFAULT_ADMIN_PATH = '/_admin';
export const DEFAULT_CHECK_TIMEOUT_MS = 10_000;

// Replaced at build time (tsup env); the fallback is what tests see.
export const ADMIN_VERSION: string = process.env['FONDERIE_ADMIN_VERSION'] ?? '0.0.0-dev';

export class AdminModule implements IFonderieModule {
	readonly name = '@fonderie/admin';
	readonly version = ADMIN_VERSION;
	readonly path: string;

	constructor(private options: IAdminOptions = {}) {
		this.path = (options.path ?? DEFAULT_ADMIN_PATH).replace(/\/+$/, '');
	}

	install(app: IFonderieApp): void {
		const token = this.options.adminToken;
		if (!token) return;

		app.reserve(this.path);
		const guard = requireAdminToken(token);
		// Declared at the default path so the route table reads literally; re-based when configured.
		const at = (p: string): string => this.path + p.slice(DEFAULT_ADMIN_PATH.length);

		const store = this.options.store;
		// Collected once at boot: a duplicate name is refused here, not at request time.
		const checks = collectChecks(app, this.options.checks ?? []);
		const timeoutMs = this.options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
		const doctor = () => runDoctor(checks, timeoutMs);

		const own: Array<[string, string, Middleware]> = [
			[
				'GET',
				'/_admin',
				async () =>
					setApiResponse(
						HTTP.OK,
						'ADMIN_ATTENTION',
						'What needs attention',
						attention(app, await doctor()),
					),
			],
			[
				'GET',
				'/_admin/manifest',
				async () =>
					setApiResponse(
						HTTP.OK,
						'ADMIN_MANIFEST',
						'Deployment manifest',
						buildManifest(app, { version: this.version, log: Boolean(store) }),
					),
			],
			[
				'GET',
				'/_admin/doctor',
				async () =>
					setApiResponse(HTTP.OK, 'ADMIN_DOCTOR', 'Reconciliation checks', await doctor()),
			],
			[
				'GET',
				'/_admin/config',
				async () =>
					setApiResponse(
						HTTP.OK,
						'ADMIN_CONFIG',
						'Declared vs held',
						configReport(app, this.options.env ?? []),
					),
			],
			[
				'GET',
				'/_admin/routes',
				async () =>
					setApiResponse(HTTP.OK, 'ADMIN_ROUTES', 'Exposed routes', routesReport(app, this.name)),
			],
			[
				'GET',
				'/_admin/access/tokens',
				async () =>
					setApiResponse(HTTP.OK, 'ADMIN_TOKENS', 'Admin tokens', tokensReport(app, this.name)),
			],
		];
		if (store) {
			own.push([
				'GET',
				'/_admin/activity/admin-log',
				async (ctx) => {
					const q = new URL(ctx.request.url).searchParams;
					const limit = Number(q.get('limit')) || undefined;
					const before = q.get('before') ?? undefined;
					const page = await readAdminLog(store, {
						...(limit ? { limit } : {}),
						...(before ? { before } : {}),
					});
					return setApiResponse(HTTP.OK, 'ADMIN_LOG', 'Admin activity', page);
				},
			]);
		}
		const mounted = new Map<string, string>();
		const mount = (module: string, method: string, path: string, handlers: Middleware[]): void => {
			const key = `${method.toUpperCase()} ${path}`;
			const prior = mounted.get(key);
			if (prior) {
				throw new Error(
					`[fonderie] ${module} cannot describe ${key}: ${prior} already describes it`,
				);
			}
			mounted.set(key, module);
			// The log sits before the guard: a refused request is a row too.
			const chain = store
				? [adminLog(store, path, module), guard, ...handlers]
				: [guard, ...handlers];
			app.addRoute(method, path, ...chain);
		};

		for (const [method, path, handler] of own) mount(this.name, method, at(path), [handler]);
		for (const { module, description } of app.adminDescriptions()) {
			for (const r of description.routes ?? [])
				mount(module, r.method, this.path + r.path, r.handlers);
		}
	}

	checkReadiness(): IReadinessProblem[] {
		return validateAdminToken(this.options.adminToken, { module: this.name });
	}
}
