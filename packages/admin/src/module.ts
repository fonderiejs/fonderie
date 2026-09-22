import { readFileSync } from 'node:fs';
import type { IFonderieApp, IFonderieModule, IReadinessProblem, Middleware } from '@fonderie/core';
import { HTTP, normalizeMountPath, normalizeRequestPath, setApiResponse } from '@fonderie/core';
import { validate, validateAdminToken } from '@fonderie/core/middlewares';

import { attention, collectChecks, runDoctor } from './doctor';
import { adminLog, readAdminLog } from './log';
import { buildManifest } from './manifest';
import { configReport, routesReport, tokensReport } from './pages';
import {
	issueToken,
	issueTokenSchema,
	listTokens,
	requireAdminScope,
	revokeToken,
	scopeFor,
} from './tokens';
import { uiHtml } from './ui/html';
import type { AdminScope } from './types';
import type { IAdminOptions } from './types';

export const DEFAULT_ADMIN_PATH = '/_admin';
export const DEFAULT_CHECK_TIMEOUT_MS = 10_000;

// Replaced at build time (tsup env); the fallback is what tests see.
export const ADMIN_VERSION: string = process.env['FONDERIE_ADMIN_VERSION'] ?? '0.0.0-dev';

// A request addressed to a hostname this surface does not answer for gets the
// same 404 an unmounted surface gives — indistinguishable on purpose. A 403
// would confirm both that the surface exists and that you found the wrong door.
function requireAdminHost(hosts: readonly string[]): Middleware {
	const allowed = new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean));
	return (ctx, next) => {
		const url = new URL(ctx.request.url);
		// Match with or without the port: a configured 'admin.example.com' should
		// not stop working behind a non-default port, and a configured
		// 'localhost:3000' should still be exact. Ports are not a boundary here.
		const ok = allowed.has(url.host.toLowerCase()) || allowed.has(url.hostname.toLowerCase());
		return ok ? next() : Promise.resolve(setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Not found'));
	};
}

export class AdminModule implements IFonderieModule {
	readonly name = '@fonderie/admin';
	readonly version = ADMIN_VERSION;
	readonly path: string;
	// null = answer on any hostname.
	readonly hosts: string[] | null;

	constructor(private options: IAdminOptions = {}) {
		this.path = normalizeMountPath(options.path ?? DEFAULT_ADMIN_PATH);
		this.hosts = options.host === undefined ? null : [options.host].flat();
	}

	install(app: IFonderieApp): void {
		const token = this.options.adminToken;
		if (!token) return;

		app.reserve(this.path);
		// Declared at the default path so the route table reads literally; re-based when configured.
		const at = (p: string): string => this.path + p.slice(DEFAULT_ADMIN_PATH.length);

		const store = this.options.store;
		// First in every chain: a surface bound to another hostname must look
		// unmounted here, before anything reads a token or a body.
		const hostGuard = this.hosts ? requireAdminHost(this.hosts) : null;
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
						buildManifest(app, { version: this.version, log: Boolean(store), host: this.hosts }),
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
					setApiResponse(
						HTTP.OK,
						'ADMIN_TOKENS',
						'Admin tokens',
						tokensReport(app, this.name, store ? await listTokens(store) : null),
					),
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
		// Issuing and revoking are root-only: a scoped token can never mint one.
		const rootOnly: Array<[string, string, Middleware[]]> = store
			? [
					[
						'POST',
						'/_admin/access/tokens',
						[
							validate(issueTokenSchema),
							async (ctx) => {
								const body = ctx.meta['body'] as {
									name: string;
									scopes: AdminScope[];
									expiresInDays?: number;
								};
								const createdBy = ctx.request.headers.get('x-actor') || 'admin-token';
								const { token: plaintext, record } = await issueToken(store, {
									...body,
									createdBy,
								});
								// The plaintext is returned once and never stored.
								return setApiResponse(HTTP.CREATED, 'TOKEN_ISSUED', 'Token issued — shown once', {
									token: plaintext,
									...record,
								});
							},
						],
					],
					[
						'DELETE',
						'/_admin/access/tokens/:id',
						[
							async (ctx) => {
								const ok = await revokeToken(store, ctx.meta.params?.['id'] ?? '');
								return ok
									? setApiResponse(HTTP.OK, 'TOKEN_REVOKED', 'Token revoked')
									: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such live token');
							},
						],
					],
				]
			: [];
		const mounted = new Map<string, string>();
		const mount = (
			module: string,
			method: string,
			path: string,
			handlers: Middleware[],
			needed?: AdminScope | 'root',
		): void => {
			const key = `${method.toUpperCase()} ${path}`;
			const prior = mounted.get(key);
			if (prior) {
				throw new Error(
					`[fonderie] ${module} cannot describe ${key}: ${prior} already describes it`,
				);
			}
			mounted.set(key, module);
			// The scope comes from the route itself. The log sits before the guard:
			// a refused request is a row too.
			const guard = requireAdminScope(token, store, needed ?? scopeFor(method, path));
			const chain: Middleware[] = [
				// Logged first so a wrong-host attempt still leaves a row: the
				// caller learns nothing from a 404, the operator learns something.
				...(store ? [adminLog(store, path, module)] : []),
				...(hostGuard ? [hostGuard] : []),
				guard,
				...handlers,
			];
			app.addRoute(method, path, ...chain);
		};

		// The served dashboard. Deliberately OUTSIDE the guard: a browser
		// navigating to a page cannot send an Authorization header, and neither
		// file carries data — the HTML is a shell and the script is the same
		// bundle npm serves. The page asks for a token and sends it itself, so
		// every request that reads anything is guarded and logged as usual.
		// These two are not logged: they carry no token to attribute.
		if (this.options.ui) {
			const scriptPath = at('/_admin/ui/app.js');
			// Read on first request, not at boot: the bundle sits beside the BUILT
			// module (tsup names its IIFE output <entry>.global.js), so running from
			// source — tests, a linked checkout — has none, and that must not stop
			// an app from booting over a dashboard it may never open.
			let js: string | null = null;
			const loadJs = (): string | null => {
				if (js === null) {
					try {
						js = readFileSync(new URL('./ui/app.global.js', import.meta.url), 'utf8');
					} catch {
						js = '';
					}
				}
				return js || null;
			};
			const ui = (h: Middleware): Middleware[] => (hostGuard ? [hostGuard, h] : [h]);
			app.addRoute(
				'GET',
				at('/_admin/ui'),
				...ui(async (ctx) => {
					// From the request, not from config: this is the only place that
					// knows basePath, a moved path AND a trailing slash at once. The
					// router's own normalizer, so the href and the routing cannot
					// disagree about what this path is.
					const here = normalizeRequestPath(new URL(ctx.request.url).pathname);
					return new Response(uiHtml(`${here}/app.js`), {
						headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
					});
				}),
			);
			app.addRoute(
				'GET',
				scriptPath,
				...ui(async () => {
					const body = loadJs();
					return body
						? new Response(body, {
								headers: {
									'content-type': 'text/javascript; charset=utf-8',
									'cache-control': 'public, max-age=300',
								},
							})
						: setApiResponse(
								HTTP.SERVICE_UNAVAILABLE,
								'UI_NOT_BUILT',
								'This copy of @fonderie/admin has no built dashboard (dist/ui). Install the published package, or run its build.',
							);
				}),
			);
		}

		for (const [method, path, handler] of own) mount(this.name, method, at(path), [handler]);
		for (const [method, path, handlers] of rootOnly)
			mount(this.name, method, at(path), handlers, 'root');
		for (const { module, description } of app.adminDescriptions()) {
			for (const r of description.routes ?? [])
				mount(module, r.method, this.path + r.path, r.handlers);
		}
	}

	checkReadiness(): IReadinessProblem[] {
		return validateAdminToken(this.options.adminToken, { module: this.name });
	}
}
