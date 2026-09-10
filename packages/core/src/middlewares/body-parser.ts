import type { Middleware } from '../types';
import { setApiResponse, HTTP } from '../response';

/**
 * Default cap on the request body the pipeline will buffer, in bytes (5 MiB).
 * Enforced HERE, in the body parser, so EVERY entry point inherits it — the
 * built-in listen() server, and all adapters' buildContext()/handle() paths.
 * (An uncapped parser was a memory-exhaustion DoS on any adapter whose
 * transport didn't add its own cap, e.g. adapter-hono on node-server.)
 */
export const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;

class PayloadTooLargeError extends Error {
	readonly fonderiePayloadTooLarge = true as const;
}

// Read the request body as text, refusing to buffer past maxBytes: a
// Content-Length fast path rejects declared-oversize bodies without reading a
// byte, and the streamed read stops the moment a chunked/lying body crosses
// the cap. Returns null when there is no body stream.
//
// Deliberately CONSUMES the original stream instead of clone()-ing it:
// clone() tees the stream, and a tee applies backpressure from BOTH branches
// — with the second branch never read, any body larger than the stream's
// high-water mark stalls the read forever. The caller re-materializes
// ctx.request from the buffered text so downstream raw-body readers (e.g.
// webhook signature verification) keep working.
async function readTextCapped(req: Request, maxBytes: number): Promise<string | null> {
	const declared = Number(req.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) {
		throw new PayloadTooLargeError();
	}

	if (!req.body) return null;

	const reader = req.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => undefined);
			throw new PayloadTooLargeError();
		}
		chunks.push(value);
	}

	const merged = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		merged.set(c, offset);
		offset += c.byteLength;
	}
	return new TextDecoder().decode(merged);
}

/**
 * Build the body-parsing middleware with an explicit byte cap. The core app
 * wires this with `config.maxBodyBytes`; the bare `withBody` export below
 * keeps the default cap for direct users.
 */
export function bodyParser(maxBytes: number = DEFAULT_MAX_BODY_BYTES): Middleware {
	return async (ctx, next) => {
		const method = ctx.request.method.toUpperCase();

		if (method === 'GET' || method === 'HEAD') {
			return next();
		}

		// Universal Content-Length cap — regardless of content-type. The parser
		// only READS json/form bodies (so only those get the streamed cap), but
		// a declared-oversize body of ANY type (notably multipart, which the
		// parser hands to the route) must be refused here — otherwise, on an
		// adapter with no transport-level cap (adapter-hono on node-server), a
		// large multipart upload buffered by the route is an unbounded-memory
		// DoS. The route still owns the chunked/no-Content-Length streaming case.
		const declared = Number(ctx.request.headers.get('content-length'));
		if (Number.isFinite(declared) && declared > maxBytes) {
			return setApiResponse(HTTP.PAYLOAD_TOO_LARGE, 'PAYLOAD_TOO_LARGE', 'Request body too large');
		}

		const ct = ctx.request.headers.get('content-type') ?? '';

		try {
			if (ct.includes('application/json') || ct.includes('application/x-www-form-urlencoded')) {
				const raw = await readTextCapped(ctx.request, maxBytes);
				// The read consumed the original stream — re-materialize the request
				// so handlers that need the RAW body (webhook signature checks)
				// can still read it.
				if (raw !== null) {
					ctx.request = new Request(ctx.request.url, {
						method: ctx.request.method,
						headers: ctx.request.headers,
						body: raw.length > 0 ? raw : null,
					});
				}
				if (ct.includes('application/json')) {
					const text = raw?.trim() ?? '';
					ctx.meta.body = text ? JSON.parse(text) : {};
				} else {
					ctx.meta.body = Object.fromEntries(new URLSearchParams(raw ?? ''));
				}
			}
			// multipart/form-data left to the handler — no dep-free way to parse it
		} catch (err) {
			if ((err as { fonderiePayloadTooLarge?: boolean } | null)?.fonderiePayloadTooLarge) {
				return setApiResponse(
					HTTP.PAYLOAD_TOO_LARGE,
					'PAYLOAD_TOO_LARGE',
					'Request body too large',
				);
			}
			return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Invalid request body');
		}

		return next();
	};
}

// Backward-compatible bare middleware with the default cap.
export const withBody: Middleware = bodyParser();
