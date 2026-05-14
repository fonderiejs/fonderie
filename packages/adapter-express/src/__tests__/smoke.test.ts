import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
	bridge,
	adapt,
	requireAuth,
	expressRequestToWeb,
	webResponseToExpress,
	type ExpressRequest,
	type ExpressResponse,
	type ExpressNext,
} from '../index';
import type { FonderieApp, IFonderieContext } from '@fonderie-js/core';

// ── Stubs ─────────────────────────────────────────────────────────

function makeCtx(user: unknown = null, meta: Record<string, unknown> = {}): IFonderieContext {
	return {
		user,
		workspace: null,
		tenant: null,
		meta,
		request: new Request('http://localhost/'),
		_router: null as any,
	} as unknown as IFonderieContext;
}

function makeApp(user: unknown = null, meta: Record<string, unknown> = {}): FonderieApp {
	return {
		buildContext: async (req: Request) => ({ ...makeCtx(user, meta), request: req }),
		handle: async (_req: Request) => Response.json({ from: 'fonderie' }),
	} as unknown as FonderieApp;
}

function makeIncomingMessage(
	opts: { method?: string; url?: string; headers?: Record<string, string>; body?: string } = {},
): ExpressRequest {
	const req = new EventEmitter() as any;
	req.method = opts.method ?? 'GET';
	req.url = opts.url ?? '/';
	req.headers = { host: 'localhost', ...opts.headers };
	req.socket = {};
	const payload = opts.body;

	if (payload !== undefined) {
		setImmediate(() => {
			req.emit('data', Buffer.from(payload));
			req.emit('end');
		});
	} else {
		setImmediate(() => req.emit('end'));
	}

	return req as ExpressRequest;
}

function makeServerResponse() {
	const captured = {
		statusCode: 200,
		headers: {} as Record<string, string>,
		body: '',
	};
	return {
		captured,
		get statusCode() {
			return captured.statusCode;
		},
		set statusCode(v) {
			captured.statusCode = v;
		},
		setHeader(k: string, v: string) {
			captured.headers[k] = v;
		},
		end(buf: Buffer) {
			captured.body = buf.toString();
		},
	} as unknown as ExpressResponse & { captured: typeof captured };
}

// ── expressRequestToWeb ───────────────────────────────────────────

test('expressRequestToWeb: preserves method and URL', async () => {
	const req = makeIncomingMessage({ method: 'DELETE', url: '/v1/users/42' });
	const webReq = await expressRequestToWeb(req);

	assert.equal(webReq.method, 'DELETE');
	assert.ok(webReq.url.endsWith('/v1/users/42'));
});

test('expressRequestToWeb: copies request headers', async () => {
	const req = makeIncomingMessage({ headers: { 'x-custom': 'abc', authorization: 'Bearer tok' } });
	const webReq = await expressRequestToWeb(req);

	assert.equal(webReq.headers.get('x-custom'), 'abc');
	assert.equal(webReq.headers.get('authorization'), 'Bearer tok');
});

test('expressRequestToWeb: reads body for POST request', async () => {
	const req = makeIncomingMessage({ method: 'POST', body: '{"name":"fonderie"}' });
	const webReq = await expressRequestToWeb(req);
	const body = (await webReq.json()) as any;

	assert.equal(body.name, 'fonderie');
});

test('expressRequestToWeb: body is null for GET request', async () => {
	const req = makeIncomingMessage({ method: 'GET' });
	const webReq = await expressRequestToWeb(req);

	assert.equal(webReq.body, null);
});

// ── webResponseToExpress ──────────────────────────────────────────

test('webResponseToExpress: writes status, headers, and body', async () => {
	const webRes = new Response(JSON.stringify({ ok: true }), {
		status: 202,
		headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
	});
	const res = makeServerResponse() as any;

	await webResponseToExpress(webRes, res);

	assert.equal(res.captured.statusCode, 202);
	assert.equal(res.captured.headers['x-trace'], 'abc');
	assert.equal(res.captured.body, '{"ok":true}');
});

// ── bridge ────────────────────────────────────────────────────────

test('bridge: sets req._fonderie with fonderie context', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse();

	await new Promise<void>((resolve) => {
		const mw: ReturnType<typeof bridge> = bridge(makeApp({ id: 'u1' }));
		mw(req, res, (err?: unknown) => {
			assert.ok(!err, `unexpected error: ${err}`);
			assert.ok((req as any)._fonderie);
			assert.equal(((req as any)._fonderie.user as any).id, 'u1');
			resolve();
		});
	});
});

test('bridge: forwards parsed body to req.body', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse();
	const body = { order: 1 };

	const appWithBody = makeApp(null, { body });

	await new Promise<void>((resolve) => {
		bridge(appWithBody)(req, res, (err?: unknown) => {
			assert.ok(!err);
			assert.deepEqual((req as any).body, body);
			resolve();
		});
	});
});

test('bridge: calls next(err) when buildContext throws', async () => {
	const brokenApp = {
		buildContext: async () => {
			throw new Error('db down');
		},
		handle: async () => new Response(),
	} as unknown as FonderieApp;

	const req = makeIncomingMessage();
	const res = makeServerResponse();

	await new Promise<void>((resolve) => {
		bridge(brokenApp)(req, res, (err?: unknown) => {
			assert.ok(err instanceof Error);
			assert.ok((err as Error).message.includes('db down'));
			resolve();
		});
	});
});

// ── adapt ─────────────────────────────────────────────────────────

test('adapt: calls next() when fonderie middleware continues', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse();
	(req as any)._fonderie = makeCtx({ id: 'u1' });

	let nextCalled = false;
	const next: ExpressNext = () => {
		nextCalled = true;
	};

	await adapt(async (_ctx, n) => n())(req, res, next);

	assert.ok(nextCalled);
});

test('adapt: writes response when fonderie middleware short-circuits', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse() as any;
	(req as any)._fonderie = makeCtx();

	let nextCalled = false;
	const next: ExpressNext = () => {
		nextCalled = true;
	};

	await adapt(async () => Response.json({ blocked: true }, { status: 403 }))(req, res, next);

	assert.ok(!nextCalled);
	assert.equal(res.captured.statusCode, 403);
	assert.ok(res.captured.body.includes('blocked'));
});

test('adapt: calls next(error) when bridge has not run', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse();
	// _fonderie is NOT set

	await new Promise<void>((resolve) => {
		adapt(async (_ctx, n) => n())(req, res, (err?: unknown) => {
			assert.ok(err instanceof Error);
			assert.ok((err as Error).message.includes('bridge()'));
			resolve();
		});
	});
});

// ── requireAuth ───────────────────────────────────────────────────

test('requireAuth: 401 when ctx.user is null', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse() as any;
	(req as any)._fonderie = makeCtx(null);

	let nextCalled = false;
	const next: ExpressNext = () => {
		nextCalled = true;
	};

	await requireAuth(req, res, next);

	assert.ok(!nextCalled);
	assert.equal(res.captured.statusCode, 401);
});

test('requireAuth: calls next when user is set', async () => {
	const req = makeIncomingMessage();
	const res = makeServerResponse();
	(req as any)._fonderie = makeCtx({ id: 'u1' });

	let nextCalled = false;
	const next: ExpressNext = () => {
		nextCalled = true;
	};

	await requireAuth(req, res, next);

	assert.ok(nextCalled);
});
