import type { IFonderieApp, IFonderieModule, IReadinessProblem, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import { requireAdminToken, validateAdminToken } from '@fonderie/core/middlewares';

import { buildManifest } from './manifest';
import type { IAdminOptions } from './types';

export const DEFAULT_ADMIN_PATH = '/_admin';

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
		const g =
			(h: Middleware): Middleware =>
			(ctx, next) =>
				guard(ctx, () => h(ctx, next));
		// Declared at the default path so the route table reads literally; re-based when configured.
		const at = (p: string): string => this.path + p.slice(DEFAULT_ADMIN_PATH.length);

		const routes: Array<[string, string, Middleware]> = [
			[
				'GET',
				'/_admin/manifest',
				g(async () =>
					setApiResponse(
						HTTP.OK,
						'ADMIN_MANIFEST',
						'Deployment manifest',
						buildManifest(app, { version: this.version }),
					),
				),
			],
		];
		for (const [method, path, handler] of routes) app.addRoute(method, at(path), handler);
	}

	checkReadiness(): IReadinessProblem[] {
		return validateAdminToken(this.options.adminToken, { module: this.name });
	}
}
