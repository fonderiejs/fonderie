import { networkInterfaces }  from 'node:os';
import { createServer }       from 'node:http';

import type {
	Middleware,
	IFonderieApp,
	IFonderieContext,
	IFonderieModule,
} from './types';
import type { FonderieConfig }                       from './config';
import { Router, routerMiddleware }                  from './router';
import { compose }                                   from './compose';
import { notFoundMiddleware, defaultErrorHandler }   from './middlewares';
import { koaContextToWeb, webResponseToKoa }         from './adapters/koa';
import type { KoaContext }                           from './adapters/koa';
import type { ExpressRequest, ExpressResponse }      from './adapters/express';
import { expressRequestToWeb, webResponseToExpress } from './adapters/express';

export class FonderieApp {
	private config: FonderieConfig;
	private prefix: string;
	private router: Router = new Router();
	private middlewares: Middleware[] = [];
	private modules: Map<string, IFonderieModule> = new Map();

	constructor(config: FonderieConfig) {
		this.config = config;
		this.prefix = (config.basePath ?? '').replace(/\/$/, '');
	}

	listen(port: number, options: {
		name ? : string;version ? : string;env ? : string
	} = {}): void {
		const {
			name = 'Fonderie',
			version = '0.0.1',
			env = process.env['NODE_ENV'] ?? 'development',
		} = options;

		createServer(async (req, res) => {
			const host    = req.headers.host ?? 'localhost';
			const parsed  = new URL(`http://${host}${req.url ?? '/'}`);
			if (this.prefix) {
				parsed.pathname = parsed.pathname.replace(new RegExp(`^${this.prefix}`), '') || '/';
			}
			const url     = parsed.toString();
			const headers = new Headers();

			for (const [key, value] of Object.entries(req.headers)) {
				if (!value) {
					continue
				}

				Array.isArray(value) ?
					value.forEach(v => headers.append(key, v)) :
					headers.set(key, value);
			}

			// Read the body stream — this was missing
			const body = await new Promise < Buffer > ((resolve, reject) => {
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
			response.headers.forEach((v, k) => res.setHeader(k, v));
			res.end(Buffer.from(await response.arrayBuffer()));
		}).listen(port, () => {
			const ip = getLocalIPv4();
			const mode = env.includes('dev') ? 'development' : 'production';

			console.log(
				`\n  ƒ ${name} v${version}  ${mode}\n` +
				`\n  Local    http://localhost:${port}` +
				`\n  Network  http://${ip}:${port}\n`
			);
		});
	}

	// ─── Module registration ───────────────────────────────

	register(module: IFonderieModule): this {
		this.modules.set(module.name, module)
		return this
	}

	async boot(): Promise<this> {
		for (const module of this.modules.values()) {
			await module.install(this)
		}
		return this
	}

	// ─── Middleware ────────────────────────────────────────

	use(middleware: Middleware): this {
		this.middlewares.push(middleware)
		return this
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
		}

		// Build the pipeline: global middleware → router → 404
		const pipeline = compose([
			...this.middlewares,
			routerMiddleware(this.router),
			notFoundMiddleware(),
		])

		try {
			return await pipeline(ctx, async () => new Response('Not Found', { status: 404 }))
		} catch (err) {
			return this.config.onError?.(err) ?? defaultErrorHandler(err)
		}
	}

	// ─── Framework adapters ────────────────────────────────
	// Each adapter is just a translation layer to `this.handle()`

	// Express: npm install @fonderie-js/adapter-express
	express() {
		return async (req: ExpressRequest, res: ExpressResponse) => {
			const webRequest  = await expressRequestToWeb(req)
			const webResponse = await this.handle(webRequest)
			await webResponseToExpress(webResponse, res)
		}
	}

	// Koa: npm install @fonderie-js/adapter-koa  
	koa() {
		return async (ctx: KoaContext) => {
			const webRequest  = koaContextToWeb(ctx)
			const webResponse = await this.handle(webRequest)
			await webResponseToKoa(webResponse, ctx)
		}
	}

	// Hono needs no adapter — it speaks Web Standard natively.
	// Users wire it directly:
	//
	//   const hono = new Hono()
	//   hono.all('*', (c) => fonderie.handle(c.req.raw))
}

function getLocalIPv4(): string {
	const nets = networkInterfaces();

	for (const interfaces of Object.values(nets)) {
		if (!interfaces) {
			continue
		}

		for (const iface of interfaces) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}

	return '127.0.0.1'  // fallback if no external interface found
}
