import type { IncomingMessage } from 'node:http';
import type Koa                from 'koa';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KoaMiddleware<S = any, C = any> = Koa.Middleware<S, C>;

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie/core';
import {
	requireAuth as _requireAuth,
	resolveClientIp,
	resolveCorsOptions,
	corsHeadersFor,
	type CorsOptions,
} from '@fonderie/core/middlewares';
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

// Minimal Koa shape used internally for Web Standard translation.
// Application code uses Koa's own context types (Koa.ParameterizedContext).
export interface KoaContext {
	request: {
		url: string;
		method: string;
		rawBody?: string;
		headers: Record<string, string | string[] | undefined>;
	};
	response: {
		body: unknown;
		status: number;
		set(key: string, value: string | string[]): void;
	};
	req: IncomingMessage;
	state: Record<string, unknown>;
}

export type KoaNext = () => Promise<void>;

// ── Web Standard ↔ Koa translation ───────────────────────────────

/**
 * Default cap (5 MiB) on a body this adapter reads from the socket itself —
 * i.e. when koa-bodyparser did NOT run. When it did, its own limit governs
 * `rawBody`. Configurable via bridge()/mount() options.
 */
export const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;

class PayloadTooLargeError extends Error {
	readonly fonderiePayloadTooLarge = true as const;
}

const isPayloadTooLarge = (err: unknown): boolean =>
	!!(err as { fonderiePayloadTooLarge?: boolean } | undefined)?.fonderiePayloadTooLarge;

function readStreamCapped(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
	// If the stream was already consumed/ended by an upstream middleware (some
	// body parser other than koa-bodyparser), attaching 'data'/'end' here would
	// wait for an 'end' that never re-fires → the request hangs. Resolve empty.
	if (req.readableEnded || req.destroyed) return Promise.resolve(Buffer.alloc(0));
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on('data', (chunk: Buffer) => {
			total += chunk.length;
			if (total > maxBytes) {
				// Reject WITHOUT destroying — the bridge writes the 413 first, then
				// tears the socket down, so the client sees the 413 not a reset.
				reject(new PayloadTooLargeError());
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

export async function koaContextToWeb(
	ctx: KoaContext,
	maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<Request> {
	const encrypted = (ctx.req.socket as { encrypted?: boolean }).encrypted;
	const protocol = encrypted ? 'https' : 'http';
	const host = ctx.request.headers['host'] ?? 'localhost';
	const url = `${protocol}://${host}${ctx.request.url}`;

	const headers = new Headers();
	for (const [key, value] of Object.entries(ctx.request.headers)) {
		if (!value) continue;
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v);
		} else {
			headers.set(key, value);
		}
	}

	const method = ctx.request.method.toUpperCase();
	const hasBody = method !== 'GET' && method !== 'HEAD';

	// Prefer koa-bodyparser's rawBody; otherwise read the socket ourselves
	// (capped) so a body isn't SILENTLY DROPPED when bodyparser is absent —
	// the adapter no longer hard-depends on it. Declared-oversize is refused
	// before reading a byte.
	let body: string | Uint8Array | null = null;
	if (hasBody) {
		if (ctx.request.rawBody !== undefined) {
			body = ctx.request.rawBody;
		} else {
			const declared = Number(ctx.request.headers['content-length']);
			if (Number.isFinite(declared) && declared > maxBytes) {
				throw new PayloadTooLargeError();
			}
			const buf = await readStreamCapped(ctx.req, maxBytes);
			// New Uint8Array to satisfy BodyInit (Buffer's typing isn't accepted).
			body = buf.length > 0 ? new Uint8Array(buf) : null;
		}
	}

	return new Request(url, {
		headers,
		method,
		// Cast: a Uint8Array<ArrayBufferLike> is a valid BodyInit at runtime,
		// but the lib's BodyInit union is narrower than our body variable's type.
		body: body as BodyInit | null,
	});
}

export async function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void> {
	ctx.response.status = webRes.status;
	// Set-Cookie must be forwarded as a LIST — forEach + set() would overwrite all
	// but the last cookie (and joining them into one header is invalid).
	const setCookies = webRes.headers.getSetCookie?.() ?? [];
	if (setCookies.length) ctx.response.set('Set-Cookie', setCookies);
	webRes.headers.forEach((value, key) => {
		if (key.toLowerCase() !== 'set-cookie') ctx.response.set(key, value);
	});
	// Buffer, not text(): .text() UTF-8-decodes the body, corrupting any binary
	// response (a @fonderie/media image, an invoice PDF, gzip). arrayBuffer →
	// Buffer is byte-faithful, matching the express/core-listen adapters.
	ctx.response.body = Buffer.from(await webRes.arrayBuffer());
}

// ── bridge ────────────────────────────────────────────────────────
//
// Koa middleware. Populates ctx.state._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
// Requires koa-bodyparser (or equivalent) to run first so rawBody is set.
//
//   app.use(bodyParser())
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp, options: { maxBodyBytes?: number } = {}): KoaMiddleware {
	const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	return async (ctx, next) => {
		let webReq: Request;
		try {
			webReq = await koaContextToWeb(ctx as unknown as KoaContext, maxBytes);
		} catch (err) {
			if (isPayloadTooLarge(err)) {
				ctx.response.status = 413;
				ctx.response.body = { reason: 'PAYLOAD_TOO_LARGE', explanation: 'Request body too large' };
				return;
			}
			throw err;
		}
		// No clone(): a teed request whose second branch goes unread stalls
		// past the stream's high-water mark. buildContext consumes the body
		// and core's parser re-materializes fCtx.request for downstream use.
		const fCtx = await fonderie.buildContext(webReq);
		// A global middleware short-circuited (e.g. the parser's 413) — send
		// that response instead of swallowing it.
		const early = fCtx.meta['pipelineResponse'];
		if (early instanceof Response) {
			await webResponseToKoa(early, ctx as unknown as KoaContext);
			return;
		}
		const clientIp = resolveClientIp(
			(ctx as unknown as KoaContext).req.socket?.remoteAddress ?? undefined,
			webReq.headers,
		);
		if (clientIp) fCtx.meta.clientIp = clientIp;
		ctx.state['_fonderie'] = fCtx;
		await next();
	};
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Low-level escape hatch — wraps any fonderie Middleware into a Koa
// middleware function. Use this for custom fonderie middleware; prefer the
// named exports below for the built-in fonderie guards.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adapt(middleware: Middleware): KoaMiddleware<any, any> {
	return async (ctx, next) => {
		const fCtx = (ctx.state as Record<string, unknown>)['_fonderie'] as
			| IFonderieContext
			| undefined;
		if (!fCtx) throw new Error('[fonderie] bridge() must be registered before adapt()');

		let continued = false;
		const result = await middleware(fCtx, async () => {
			continued = true;
			return new Response();
		});

		if (continued) {
			await next();
		} else {
			await webResponseToKoa(result, ctx as unknown as KoaContext);
		}
	};
}

// ── Pre-adapted middleware ────────────────────────────────────────
//
// Drop-in replacements for the fonderie middleware functions — no adapt()
// needed. Import directly from this package instead of from the source
// packages, and use them as native Koa middleware.
//
//   router.get('/jobs', requireAuth, withWorkspace(store), ...)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireAuth: KoaMiddleware<any, any> = adapt(_requireAuth);

// The three guards below wrap OPTIONAL peers, so the peer is imported lazily
// on first request — not at module load. Koa middleware is async either way,
// so the extra await changes nothing for callers.

export function withWorkspace(
	store: Parameters<typeof _withWorkspace>[0],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/workspaces'),
				'@fonderie/workspaces',
				'withWorkspace()',
			);
			inner = adapt(mod.withWorkspace(store));
		}
		return inner(ctx, next);
	};
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/permissions'),
				'@fonderie/permissions',
				'requirePermission()',
			);
			inner = adapt(mod.requirePermission(operation, permissionKey));
		}
		return inner(ctx, next);
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireFeature(key: string): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/billing'),
				'@fonderie/billing',
				'requireFeature()',
			);
			inner = adapt(mod.requireFeature(key));
		}
		return inner(ctx, next);
	};
}

// ── mount ─────────────────────────────────────────────────────────
//
// Wires up fonderie to a Koa app. Uses Koa's onion model to register a
// single wrap-around middleware: builds fonderie context, calls next()
// so user routes run, then falls back to fonderie infra only if the
// request was not handled (ctx.body is still undefined).
//
// Routes registered after mount() are included automatically — Koa
// composes all middlewares lazily at request time, not at registration.
//
//   app.use(bodyParser())
//   const api = mount(app, fonderie)   // returns same app
//   api.use(router.routes())
//   api.use(router.allowedMethods())
//   app.listen(port)

export function mount(app: Koa, fonderie: FonderieApp, options: { maxBodyBytes?: number } = {}): Koa {
	const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	app.use(async (ctx, next) => {
		let webReq: Request;
		try {
			webReq = await koaContextToWeb(ctx as unknown as KoaContext, maxBytes);
		} catch (err) {
			if (isPayloadTooLarge(err)) {
				ctx.response.status = 413;
				ctx.response.body = { reason: 'PAYLOAD_TOO_LARGE', explanation: 'Request body too large' };
				return;
			}
			throw err;
		}
		// No clone() — see bridge(). The parser re-materializes fCtx.request,
		// which the fonderie fallback below hands to handle().
		const fCtx = await fonderie.buildContext(webReq);
		const early = fCtx.meta['pipelineResponse'];
		if (early instanceof Response) {
			await webResponseToKoa(early, ctx as unknown as KoaContext);
			return;
		}
		const clientIp = resolveClientIp(
			(ctx as unknown as KoaContext).req.socket?.remoteAddress ?? undefined,
			webReq.headers,
		);
		if (clientIp) fCtx.meta.clientIp = clientIp;
		ctx.state['_fonderie'] = fCtx;
		await next();
		if (ctx.body === undefined) {
			const webRes = await fonderie.handle(fCtx.request);
			await webResponseToKoa(webRes, ctx as unknown as KoaContext);
		}
	});
	return app;
}

// ── App-level CORS ────────────────────────────────────────────────
//
// Native Koa middleware speaking core's CORS contract — same options and
// defaults as withCors, so the headers @fonderie/client sends are allowed out
// of the box. Register it on the Koa app itself so it covers EVERY route,
// including ones outside the fonderie pipeline: fonderie.use(withCors()) only
// guards the mounted basePath, and a bare router 404s a preflight for routes
// that define no OPTIONS handler.
//
//   app.use(cors({ credentials: true, origin: process.env.FRONTEND_URL! }))

export function cors(options?: CorsOptions): KoaMiddleware {
	const resolved = resolveCorsOptions(options);
	return async (ctx, next) => {
		const rawOrigin = ctx.request.headers['origin'];
		const requestOrigin = Array.isArray(rawOrigin) ? (rawOrigin[0] ?? '') : (rawOrigin ?? '');
		for (const [k, v] of Object.entries(corsHeadersFor(resolved, requestOrigin))) {
			ctx.set(k, v);
		}
		if (ctx.method === 'OPTIONS') {
			ctx.status = 204;
			return;
		}
		await next();
	};
}
