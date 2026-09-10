import { networkInterfaces } from 'node:os';
import { createServer, type Server } from 'node:http';

import type {
	Middleware,
	IFonderieApp,
	IFonderieContext,
	IFonderieModule,
	IReadinessProblem,
	IReadinessReport,
	ISecurityReport,
} from './types';
import type { FonderieConfig } from './config';
import { Router, routerMiddleware } from './router';
import { compose } from './compose';
import { notFoundMiddleware, defaultErrorHandler } from './middlewares';
import { bodyParser, DEFAULT_MAX_BODY_BYTES } from './middlewares/body-parser';
import { withSecurityHeaders } from './middlewares/security-headers';
import { MetricsRegistry, withMetrics } from './metrics';

// Re-exported from the body parser, which is where the cap is actually
// enforced (so every adapter's buildContext()/handle() inherits it — not
// just listen()'s transport). Kept here for import-path compatibility.
export { DEFAULT_MAX_BODY_BYTES };

class PayloadTooLargeError extends Error {
	readonly fonderiePayloadTooLarge = true as const;
}

function payloadTooLarge(res: { statusCode: number; setHeader(k: string, v: string): void; end(body?: string): void }): void {
	res.statusCode = 413;
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify({ reason: 'PAYLOAD_TOO_LARGE', explanation: 'Request body too large' }));
}

export class FonderieApp implements IFonderieApp {
	private config: FonderieConfig;
	private prefix: string;
	private router: Router = new Router();
	private middlewares: Middleware[] = [];
	private modules: Map<string, IFonderieModule> = new Map();
	readonly metrics = new MetricsRegistry();

	constructor(config: FonderieConfig) {
		this.config = config;
		this.prefix = (config.basePath ?? '').replace(/\/$/, '');
		// Body parsing first (capped at config.maxBodyBytes — the cap lives in
		// the parser so every adapter inherits it), then baseline security
		// headers (nosniff always; HSTS over HTTPS). Apps can layer more via `.use()`.
		this.middlewares = [bodyParser(config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES), withSecurityHeaders()];
		if (config.metrics) this.middlewares.push(withMetrics(this.metrics));
	}

	listen(
		port: number,
		options: {
			name?: string;
			version?: string;
			env?: string;
			quiet?: boolean; // suppress the startup banner (tests, quiet deploys)
		} = {},
	): Server {
		const {
			name = 'Fonderie',
			version = '0.0.1',
			env = process.env['NODE_ENV'] ?? 'development',
			quiet = false,
		} = options;

		const maxBodyBytes = this.config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

		const server = createServer(async (req, res) => {
			// The whole callback is guarded below (see the catch at the bottom): an
			// exception ANYWHERE here — e.g. `new Request()` throwing on a
			// fetch-spec-forbidden method like TRACE, or an absolute-form
			// request-target producing an invalid URL — would otherwise be an
			// unhandled rejection and crash the PROCESS on a single request.
			try {
			const host = req.headers.host ?? 'localhost';
			const url = `http://${host}${req.url ?? '/'}`;
			const headers = new Headers();

			for (const [key, value] of Object.entries(req.headers)) {
				if (!value) {
					continue;
				}

				if (Array.isArray(value)) {
					for (const v of value) headers.append(key, v);
				} else {
					headers.set(key, value);
				}
			}

			const method = req.method ?? 'GET';
			const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());

			// Body cap — without it a single unauthenticated request could stream
			// an arbitrarily large body fully into memory before any handler runs.
			// Fast path: reject a declared-oversize body before reading a byte.
			const declared = Number(req.headers['content-length']);
			if (hasBody && Number.isFinite(declared) && declared > maxBodyBytes) {
				// Answer FIRST, then drop the connection — destroying before the
				// write means the client sees a reset instead of the 413.
				payloadTooLarge(res);
				res.once('close', () => req.destroy());
				return;
			}

			// Read the body stream, capped as a backstop for chunked / missing /
			// lying Content-Length: stop buffering the moment the cap is crossed.
			let body: Buffer;
			try {
				body = await new Promise<Buffer>((resolve, reject) => {
					const chunks: Buffer[] = [];
					let total = 0;
					req.on('data', (chunk: Buffer) => {
						total += chunk.length;
						if (total > maxBodyBytes) {
							reject(new PayloadTooLargeError());
							req.destroy();
							return;
						}
						chunks.push(chunk);
					});
					req.on('end', () => resolve(Buffer.concat(chunks)));
					req.on('error', reject);
				});
			} catch (err) {
				if (err instanceof PayloadTooLargeError) {
					payloadTooLarge(res);
					return;
				}
				res.statusCode = 400;
				res.end();
				return;
			}

			const request = new Request(url, {
				method,
				headers,
				body: hasBody && body.length > 0 ? new Uint8Array(body) : null,
			});

			const response = await this.handle(request);

			res.statusCode = response.status;
			// Set-Cookie must be forwarded as a LIST — forEach + setHeader would
			// overwrite all but the last cookie. getSetCookie() returns each intact.
			const setCookies = response.headers.getSetCookie?.() ?? [];
			if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
			response.headers.forEach((v, k) => {
				if (k.toLowerCase() !== 'set-cookie') res.setHeader(k, v);
			});
			res.end(Buffer.from(await response.arrayBuffer()));
			} catch (err) {
				// Malformed/hostile request (TRACE, absolute-form target, bad
				// headers): answer 400 and keep the process alive.
				console.error('[fonderie] request handling failed:', (err as Error)?.message);
				try {
					if (!res.headersSent) {
						res.statusCode = 400;
						res.setHeader('content-type', 'application/json');
					}
					res.end(JSON.stringify({ reason: 'BAD_REQUEST', explanation: 'Malformed request' }));
				} catch {
					req.destroy();
				}
			}
		}).listen(port, () => {
			if (quiet) return;
			const ip = getLocalIPv4();
			const mode = env.includes('dev') ? 'development' : 'production';

			console.log(
				`\n  ƒ ${name} v${version}  ${mode}\n` +
					`\n  Local    http://localhost:${port}` +
					`\n  Network  http://${ip}:${port}\n`,
			);
		});
		return server;
	}

	// ─── Module registration ───────────────────────────────

	register(module: IFonderieModule): this {
		this.modules.set(module.name, module);
		return this;
	}

	// Aggregate every registered module's self-reported readiness problems into
	// one report. Call it before boot to gate a deploy, or from a readiness
	// endpoint. `ok` is false when any module reports an `error`-severity problem
	// (e.g. a weak jwtSecret). Modules opt in via `checkReadiness`.
	checkProductionReadiness(): IReadinessReport {
		const problems: IReadinessProblem[] = [];
		for (const module of this.modules.values()) {
			if (module.checkReadiness) problems.push(...module.checkReadiness());
		}
		return { ok: !problems.some((p) => p.severity === 'error'), problems };
	}

	// A point-in-time control-posture snapshot for SOC 2 evidence: which modules
	// are registered and the current readiness report. Serialise to a file/log
	// (e.g. on a schedule) as an audit artifact.
	securityReport(): ISecurityReport {
		return {
			generatedAt: new Date().toISOString(),
			env: process.env['NODE_ENV'] ?? 'development',
			registeredModules: [...this.modules.keys()].sort(),
			readiness: this.checkProductionReadiness(),
		};
	}

	async boot(): Promise<this> {
		// Fail closed before any side effects (transports, listeners): a
		// production deploy with an error-severity readiness problem must not boot.
		this.enforceProductionReadiness();
		for (const module of topoSort([...this.modules.values()])) {
			await module.install(this);
		}
		this.registerHealthRoutes();
		return this;
	}

	// Liveness (/healthz) and readiness (/readyz) probes. Registered unprefixed so
	// they sit at a stable path regardless of basePath. Enabled unless disabled.
	private registerHealthRoutes(): void {
		if (this.config.healthChecks === false) return;

		this.router.add('GET', '/healthz', compose([async () => Response.json({ status: 'ok' })]));

		if (this.config.metrics) {
			this.router.add(
				'GET',
				'/metrics',
				compose([
					async () =>
						new Response(this.metrics.render(), {
							status: 200,
							headers: { 'content-type': 'text/plain; version=0.0.4' },
						}),
				]),
			);
		}

		this.router.add(
			'GET',
			'/readyz',
			compose([
				async () => {
					const report = this.checkProductionReadiness();
					let dependencies = true;
					if (this.config.readyProbe) {
						try {
							dependencies = Boolean(await this.config.readyProbe());
						} catch {
							dependencies = false;
						}
					}
					const ready = report.ok && dependencies;
					// The problems list names weak secrets, placeholder tokens, and
					// dependency state — a security-posture map. It is only exposed
					// outside production (or with an explicit opt-in); the probe
					// consumer (k8s, LB) needs nothing beyond the status code.
					const exposeDetails =
						process.env['NODE_ENV'] !== 'production' || this.config.exposeReadyzDetails === true;
					return Response.json(
						{
							status: ready ? 'ready' : 'not_ready',
							dependencies,
							...(exposeDetails ? { problems: report.problems } : {}),
						},
						{ status: ready ? 200 : 503 },
					);
				},
			]),
		);
	}

	// Throws in production when `checkProductionReadiness()` reports any
	// error-severity problem, unless explicitly overridden. No-op otherwise.
	private enforceProductionReadiness(): void {
		if (process.env['NODE_ENV'] !== 'production') return;
		if (this.config.skipProductionReadinessGate) return;
		const { ok, problems } = this.checkProductionReadiness();
		if (ok) return;
		const errors = problems.filter((p) => p.severity === 'error');
		throw new Error(
			`[fonderie] refusing to boot in production — ${errors.length} readiness ` +
				`error(s): ${errors.map((e) => `${e.module}: ${e.message}`).join('; ')}. ` +
				'Fix them, or set skipProductionReadinessGate: true to override (not recommended).',
		);
	}

	// Runs global middleware only (no routing, no 404).
	// Adapter packages call this to populate user/workspace/meta into their
	// native context before handing off to user-defined route handlers.
	async buildContext(request: Request): Promise<IFonderieContext> {
		const ctx: IFonderieContext = {
			request,
			tenant: null,
			user: null,
			workspace: null,
			meta: { _buildContext: true },
		};
		let completed = false;
		const out = await compose(this.middlewares)(ctx, async () => {
			completed = true;
			return new Response();
		});
		// A global middleware that answered WITHOUT calling next() (e.g. the
		// body parser's 413) produced a real response the adapter must send —
		// context-building normally discards middleware output, so surface the
		// short-circuit explicitly for bridges to check.
		if (!completed) ctx.meta['pipelineResponse'] = out;
		delete ctx.meta['_buildContext'];
		return ctx;
	}

	// ─── Middleware ────────────────────────────────────────

	use(middleware: Middleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	// Modules call this to register their routes
	addRoute(method: string, path: string, ...handlers: Middleware[]): void {
		this.router.add(method, this.prefix + path, compose(handlers));
	}

	// ─── The core handler ──────────────────────────────────
	// This is the ONE thing every adapter calls.
	// Takes a Web Standard Request, returns a Web Standard Response.
	//
	// NOTE (known limitation): adapters call buildContext() to populate their
	// native context (running the global middleware stack) AND then call
	// handle() for requests that fall through to fonderie's own routes — so for
	// those fonderie-routed requests the global stack runs TWICE. bodyParser /
	// security-headers are idempotent, but `withMetrics` double-counts and a
	// user-added `.use()` rate-limiter consumes two tokens per request (stricter,
	// never a bypass). Deduplicating this without changing the handle(Request)
	// contract is a deliberate follow-up.

	async handle(request: Request): Promise<Response> {
		const ctx: IFonderieContext = {
			request,
			tenant: null,
			user: null,
			workspace: null,
			meta: {},
		};

		// Build the pipeline: global middleware → router → 404
		const pipeline = compose([
			...this.middlewares,
			routerMiddleware(this.router),
			notFoundMiddleware(),
		]);

		let response: Response;
		try {
			response = await pipeline(ctx, async () => new Response('Not Found', { status: 404 }));
		} catch (err) {
			response = this.config.onError?.(err) ?? defaultErrorHandler(err);
		}
		return this.config.onResponse ? this.transformResponse(response, request) : response;
	}

	// Apply config.onResponse to a JSON response body, preserving status, headers,
	// and cookies. Non-JSON responses and hooks that return `undefined` pass through.
	private async transformResponse(response: Response, request: Request): Promise<Response> {
		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('application/json')) return response;
		let body: unknown;
		try {
			body = await response.clone().json();
		} catch {
			return response; // not valid JSON after all — leave untouched
		}
		const transformed = this.config.onResponse!(body, { status: response.status, request });
		if (transformed === undefined) return response;
		// Preserve headers/cookies; drop content-length (the new body sets its own).
		const headers = new Headers(response.headers);
		headers.delete('content-length');
		headers.delete('content-type');
		return Response.json(transformed, { status: response.status, headers });
	}
}
// Framework adapters live in their own packages — no framework deps in core:
//   @fonderie/adapter-hono
//   @fonderie/adapter-express
//   @fonderie/adapter-koa

function topoSort(modules: IFonderieModule[]): IFonderieModule[] {
	const byName = new Map(modules.map((m) => [m.name, m]));
	const result: IFonderieModule[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function visit(m: IFonderieModule, path: string[]): void {
		if (visited.has(m.name)) return;
		if (visiting.has(m.name)) {
			throw new Error(`[fonderie] circular dependency: ${[...path, m.name].join(' → ')}`);
		}
		visiting.add(m.name);
		for (const dep of m.deps ?? []) {
			const found = byName.get(dep);
			if (!found)
				throw new Error(`[fonderie] "${m.name}" requires "${dep}" but it is not registered`);
			visit(found, [...path, m.name]);
		}
		visiting.delete(m.name);
		visited.add(m.name);
		result.push(m);
	}

	for (const m of modules) visit(m, []);
	return result;
}

function getLocalIPv4(): string {
	const nets = networkInterfaces();

	for (const interfaces of Object.values(nets)) {
		if (!interfaces) {
			continue;
		}

		for (const iface of interfaces) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}

	return '127.0.0.1'; // fallback if no external interface found
}
