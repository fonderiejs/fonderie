import { networkInterfaces } from 'node:os';
import { createServer, type Server } from 'node:http';

import type { Middleware, IFonderieApp, IFonderieContext, IFonderieModule } from './types';
import type { FonderieConfig } from './config';
import { Router, routerMiddleware } from './router';
import { compose } from './compose';
import { notFoundMiddleware, defaultErrorHandler } from './middlewares';
import { withBody } from './middlewares/body-parser';

export class FonderieApp {
	private config: FonderieConfig;
	private prefix: string;
	private router: Router = new Router();
	private middlewares: Middleware[] = [];
	private modules: Map<string, IFonderieModule> = new Map();

	constructor(config: FonderieConfig) {
		this.config = config;
		this.prefix = (config.basePath ?? '').replace(/\/$/, '');
		this.middlewares = [withBody];
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

		const server = createServer(async (req, res) => {
			const host = req.headers.host ?? 'localhost';
			const url = `http://${host}${req.url ?? '/'}`;
			const headers = new Headers();

			for (const [key, value] of Object.entries(req.headers)) {
				if (!value) {
					continue;
				}

				Array.isArray(value)
					? value.forEach((v) => headers.append(key, v))
					: headers.set(key, value);
			}

			// Read the body stream — this was missing
			const body = await new Promise<Buffer>((resolve, reject) => {
				const chunks: Buffer[] = [];
				req.on('data', (chunk: Buffer) => chunks.push(chunk));
				req.on('end', () => resolve(Buffer.concat(chunks)));
				req.on('error', reject);
			});

			const method = req.method ?? 'GET';
			const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());

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

	async boot(): Promise<this> {
		for (const module of topoSort([...this.modules.values()])) {
			await module.install(this);
		}
		return this;
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
			_router: this.router,
		};
		await compose(this.middlewares)(ctx, async () => new Response());
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

	async handle(request: Request): Promise<Response> {
		const ctx: IFonderieContext = {
			request,
			tenant: null,
			user: null,
			workspace: null,
			meta: {},
			_router: this.router,
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
