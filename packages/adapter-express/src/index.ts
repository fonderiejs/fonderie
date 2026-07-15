import type { IncomingMessage, ServerResponse } from 'node:http';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie/core';
import { requireAuth as _requireAuth, resolveClientIp } from '@fonderie/core/middlewares';
// Optional peers: type-only imports (erased at runtime). The guard factories
// below load them lazily so installing this adapter never requires
// @fonderie/workspaces, @fonderie/permissions, or @fonderie/billing unless
// the corresponding guard is actually used.
import type { withWorkspace as _withWorkspace } from '@fonderie/workspaces';
import type { requirePermission as _requirePermission } from '@fonderie/permissions';

export { OPERATIONS } from '@fonderie/core';

async function loadOptionalPeer<T>(load: () => Promise<T>, pkg: string, api: string): Promise<T> {
	try {
		return await load();
	} catch (err) {
		const e = err as { code?: string; message?: string } | undefined;
		const notFound = e?.code === 'ERR_MODULE_NOT_FOUND' || e?.code === 'MODULE_NOT_FOUND';
		// Only claim the peer is missing when the unresolved specifier IS the
		// peer — a transitive failure inside an installed peer must surface
		// as-is, not as a misleading install hint.
		const missing = notFound ? /Cannot find (?:package|module) '([^']+)'/.exec(e?.message ?? '')?.[1] : undefined;
		if (missing === pkg || missing?.startsWith(pkg + '/')) {
			throw new Error(
				`[fonderie] ${api} requires the optional peer dependency "${pkg}". Install it: npm install ${pkg}`,
			);
		}
		throw err;
	}
}

export type ExpressRequest = IncomingMessage & { body?: unknown; _fonderie?: IFonderieContext };
export type ExpressResponse = ServerResponse;
export type ExpressNext = (err?: unknown) => void;

// ── Web Standard ↔ Express translation ───────────────────────────

export async function expressRequestToWeb(req: ExpressRequest): Promise<Request> {
	const encrypted = (req.socket as { encrypted?: boolean }).encrypted;
	const protocol = encrypted ? 'https' : 'http';
	const host = req.headers['host'] ?? 'localhost';
	const url = `${protocol}://${host}${req.url ?? '/'}`;

	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (!value) continue;
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v);
		} else {
			headers.set(key, value);
		}
	}

	const method = req.method ?? 'GET';
	const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
	const body = hasBody ? await readStream(req) : null;

	return new Request(url, { method, headers, body });
}

export async function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void> {
	res.statusCode = webRes.status;
	webRes.headers.forEach((value, key) => res.setHeader(key, value));
	res.end(Buffer.from(await webRes.arrayBuffer()));
}

function readStream(req: IncomingMessage): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const buf = Buffer.concat(chunks);
			// slice creates a correctly-sized ArrayBuffer (buf.buffer is a shared pool)
			resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
		});
		req.on('error', reject);
	});
}

// ── bridge ────────────────────────────────────────────────────────
//
// Express middleware. Populates req._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
// Also forwards the parsed body to req.body.
//
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp) {
	return async (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext) => {
		try {
			const webReq = await expressRequestToWeb(req);
			// Cache so the infra handler in mount() can reuse it without re-reading
			// the body stream (which can only be consumed once).
			(req as any)._fonterieReq = webReq;
			req._fonderie = await fonderie.buildContext(webReq.clone());
			const clientIp = resolveClientIp(req.socket?.remoteAddress ?? undefined, webReq.headers);
			if (clientIp) req._fonderie.meta.clientIp = clientIp;
			if (req._fonderie.meta['body'] !== undefined) {
				req.body = req._fonderie.meta['body'];
			}
			next();
		} catch (err) {
			next(err);
		}
	};
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Low-level escape hatch — wraps any fonderie Middleware into an Express
// middleware function. Use this for custom fonderie middleware; prefer the
// named exports below for the built-in fonderie guards.

export function adapt(middleware: Middleware) {
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		const ctx = req._fonderie;
		if (!ctx) {
			next(new Error('[fonderie] bridge() must be registered before adapt()'));
			return;
		}

		let continued = false;
		const result = await middleware(ctx, async () => {
			continued = true;
			return new Response();
		});

		if (continued) {
			next();
		} else {
			await webResponseToExpress(result, res);
		}
	};
}

// ── Pre-adapted middleware ────────────────────────────────────────
//
// Drop-in replacements for the fonderie middleware functions — no adapt()
// needed. Import directly from this package instead of from the source
// packages, and use them as native Express middleware.
//
//   app.get('/jobs', requireAuth, withWorkspace(store), ...)

export const requireAuth = adapt(_requireAuth);

// The three guards below wrap OPTIONAL peers, so the peer is imported lazily
// on first request — not at module load. adapt() returns an async Express
// middleware either way, so the extra await changes nothing for callers.

export function withWorkspace(store: Parameters<typeof _withWorkspace>[0]) {
	let inner: ReturnType<typeof adapt> | undefined;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/workspaces'),
				'@fonderie/workspaces',
				'withWorkspace()',
			);
			inner = adapt(mod.withWorkspace(store));
		}
		return inner(req, res, next);
	};
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
) {
	let inner: ReturnType<typeof adapt> | undefined;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/permissions'),
				'@fonderie/permissions',
				'requirePermission()',
			);
			inner = adapt(mod.requirePermission(operation, permissionKey));
		}
		return inner(req, res, next);
	};
}

export function requireFeature(key: string) {
	let inner: ReturnType<typeof adapt> | undefined;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/billing'),
				'@fonderie/billing',
				'requireFeature()',
			);
			inner = adapt(mod.requireFeature(key));
		}
		return inner(req, res, next);
	};
}

// ── mount ─────────────────────────────────────────────────────────
//
// Wires up fonderie to an Express app. Returns the same app so you can add
// routes after mount() and before app.listen() — infra is sealed lazily
// when app.listen() is first called:
//
//   const api = mount(app, fonderie)
//   api.use(buildTodoRouter(store))
//   app.listen(port)
//
// Alternatively pass a register callback to be explicit about ordering:
//
//   mount(app, fonderie, (app) => {
//     app.use(buildTodoRouter(store))
//   })

type ExpressApp = {
	use:    (...args: any[]) => any;
	all:    (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void) => void;
	listen: (...args: any[]) => any;
};

export function mount<T extends ExpressApp>(
	app: T,
	fonderie: FonderieApp,
	register?: (app: T) => void,
): T {
	const infraHandler = async (req: ExpressRequest, res: ExpressResponse) => {
		const webReq = (req as any)._fonterieReq as Request ?? await expressRequestToWeb(req);
		const webRes = await fonderie.handle(webReq);
		await webResponseToExpress(webRes, res);
	};

	app.use(bridge(fonderie));

	if (register) {
		register(app);
		app.use(infraHandler);
	} else {
		let sealed = false;
		const origListen = app.listen.bind(app);
		(app as ExpressApp).listen = (...args: any[]) => {
			if (!sealed) {
				sealed = true;
				app.use(infraHandler);
			}
			(app as ExpressApp).listen = origListen;
			return origListen(...args);
		};
	}

	return app;
}
