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

/**
 * Default cap on the request body this adapter will buffer, in bytes (5 MiB).
 * Without it, `readStream` would read an arbitrarily large body fully into
 * memory before any handler (or even auth) runs — a memory-exhaustion DoS.
 * Raise it via `mount()`/`bridge()` options if you accept larger uploads (e.g.
 * big `@fonderie/media` images); lower it to tighten the limit.
 */
export const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;

class PayloadTooLargeError extends Error {
	readonly fonderiePayloadTooLarge = true as const;
}

const isPayloadTooLarge = (err: unknown): boolean =>
	!!(err as { fonderiePayloadTooLarge?: boolean } | undefined)?.fonderiePayloadTooLarge;

// ── Web Standard ↔ Express translation ───────────────────────────

export async function expressRequestToWeb(
	req: ExpressRequest,
	maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<Request> {
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
	// Fast path: reject a declared-oversize body before reading a single byte.
	const declared = Number(req.headers['content-length']);
	if (hasBody && Number.isFinite(declared) && declared > maxBytes) {
		throw new PayloadTooLargeError(`Request body of ${declared} bytes exceeds the ${maxBytes}-byte limit`);
	}
	const body = hasBody ? await readStream(req, maxBytes) : null;

	return new Request(url, { method, headers, body });
}

export async function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void> {
	res.statusCode = webRes.status;
	// Set-Cookie is special: a response may carry SEVERAL, and `forEach` +
	// `setHeader` would overwrite all but the last (and coalescing them into one
	// comma-joined header is invalid). Forward the full list via getSetCookie().
	const setCookies = webRes.headers.getSetCookie?.() ?? [];
	if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
	webRes.headers.forEach((value, key) => {
		if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
	});
	res.end(Buffer.from(await webRes.arrayBuffer()));
}

function readStream(req: IncomingMessage, maxBytes: number): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on('data', (chunk: Buffer) => {
			total += chunk.length;
			// Backstop for chunked / missing / lying Content-Length: stop buffering
			// the moment we cross the cap rather than reading the whole body.
			if (total > maxBytes) {
				req.destroy();
				reject(new PayloadTooLargeError(`Request body exceeds the ${maxBytes}-byte limit`));
				return;
			}
			chunks.push(chunk);
		});
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

export function bridge(fonderie: FonderieApp, options?: { maxBodyBytes?: number }) {
	const maxBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		try {
			const webReq = await expressRequestToWeb(req, maxBytes);
			// No clone(): teeing a request and fully reading one branch while the
			// other sits unread stalls past the stream's high-water mark — so a
			// legal multi-MiB body would hang here. buildContext consumes the
			// body and core's parser re-materializes ctx.request; the infra
			// handler in mount() reuses THAT.
			req._fonderie = await fonderie.buildContext(webReq);
			(req as any)._fonterieReq = req._fonderie.request;
			// A global middleware short-circuited during context-building (e.g.
			// the parser's 413) — send that response, don't swallow it.
			const early = req._fonderie.meta['pipelineResponse'];
			if (early instanceof Response) {
				await webResponseToExpress(early, res);
				return;
			}
			const clientIp = resolveClientIp(req.socket?.remoteAddress ?? undefined, webReq.headers);
			if (clientIp) req._fonderie.meta.clientIp = clientIp;
			if (req._fonderie.meta['body'] !== undefined) {
				req.body = req._fonderie.meta['body'];
			}
			next();
		} catch (err) {
			if (isPayloadTooLarge(err)) {
				res.statusCode = 413;
				res.setHeader('content-type', 'application/json');
				res.end(JSON.stringify({ reason: 'PAYLOAD_TOO_LARGE', explanation: 'Request body too large' }));
				return;
			}
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

		// The whole invocation is guarded: under Express 4 a rejection from an
		// async middleware is an UNHANDLED rejection (possible process crash),
		// not a routed error — so throws (e.g. a store outage inside a guard)
		// must be funneled to next(err) explicitly.
		try {
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
		} catch (err) {
			next(err);
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
		try {
			if (!inner) {
				const mod = await loadOptionalPeer(
					() => import('@fonderie/workspaces'),
					'@fonderie/workspaces',
					'withWorkspace()',
				);
				inner = adapt(mod.withWorkspace(store));
			}
			return await inner(req, res, next);
		} catch (err) {
			next(err);
		}
	};
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
) {
	let inner: ReturnType<typeof adapt> | undefined;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		try {
			if (!inner) {
				const mod = await loadOptionalPeer(
					() => import('@fonderie/permissions'),
					'@fonderie/permissions',
					'requirePermission()',
				);
				inner = adapt(mod.requirePermission(operation, permissionKey));
			}
			return await inner(req, res, next);
		} catch (err) {
			next(err);
		}
	};
}

export function requireFeature(key: string) {
	let inner: ReturnType<typeof adapt> | undefined;
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		try {
			if (!inner) {
				const mod = await loadOptionalPeer(
					() => import('@fonderie/billing'),
					'@fonderie/billing',
					'requireFeature()',
				);
				inner = adapt(mod.requireFeature(key));
			}
			return await inner(req, res, next);
		} catch (err) {
			next(err);
		}
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
	options?: { maxBodyBytes?: number },
): T {
	const maxBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	const infraHandler = async (req: ExpressRequest, res: ExpressResponse) => {
		// bridge() (below) already read + capped the body and cached the request;
		// the fallback only runs if it somehow didn't, so apply the same cap.
		const webReq = (req as any)._fonterieReq as Request ?? await expressRequestToWeb(req, maxBytes);
		const webRes = await fonderie.handle(webReq);
		await webResponseToExpress(webRes, res);
	};

	app.use(bridge(fonderie, options));

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
