import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp } from '@fonderie/core';
import { defineConfig } from '@fonderie/core';

import { toAuditEventDTO, encodeCursor, decodeCursor } from '../dtos/audit';
import { AuditEventModel } from '../models/event.model';
import { buildAuditRoutes } from '../routes';
import { AuditModule } from '../module';
import type { IAuditEvent } from '../types';

// ── helpers ───────────────────────────────────────────────────────

function makeEvent(overrides: Partial<IAuditEvent> = {}): IAuditEvent {
	return {
		id: 'evt-1',
		type: 'project.created',
		payload: { workspaceId: 'ws-1', userId: 'u-1', name: 'My Project' },
		meta: { id: 'evt-1', requestId: 'req-1' },
		createdAt: new Date('2026-01-01T00:00:00Z'),
		...overrides,
	};
}

function makeStore(rows: IAuditEvent[] = []) {
	return {
		query: async <T>(): Promise<T[]> => rows as unknown as T[],
	};
}

const appConfig = defineConfig({ db: { url: 'postgres://localhost/test' } });

function makeRequest(path: string, user?: object, workspace?: object): Request {
	return Object.assign(new Request(`http://localhost${path}`), {
		_user: user ?? null,
		_workspace: workspace ?? null,
	});
}

function makeApp(rows: IAuditEvent[] = []) {
	const store = makeStore(rows) as never;
	const mod = new AuditModule(store);
	const app = new FonderieApp(appConfig);

	// inject user + workspace from the request extensions set in makeRequest
	app.use(async (ctx, next) => {
		const req = ctx.request as Request & { _user?: object; _workspace?: object };
		(ctx as { user: object | null }).user = req._user ?? null;
		(ctx as { workspace: object | null }).workspace = req._workspace ?? null;
		return next();
	});

	mod.install(app);
	return app;
}

// ── DTO ───────────────────────────────────────────────────────────

test('toAuditEventDTO: maps fields correctly', () => {
	const dto = toAuditEventDTO(makeEvent());

	assert.equal(dto.id, 'evt-1');
	assert.equal(dto.type, 'project.created');
	assert.equal(dto.actorId, 'u-1');
	assert.equal(dto.requestId, 'req-1');
	assert.equal(dto.createdAt, '2026-01-01T00:00:00.000Z');
});

test('toAuditEventDTO: actorId is null when payload has no userId', () => {
	const dto = toAuditEventDTO(makeEvent({ payload: { workspaceId: 'ws-1' } }));
	assert.equal(dto.actorId, null);
});

test('toAuditEventDTO: requestId is null when meta has no requestId', () => {
	const dto = toAuditEventDTO(makeEvent({ meta: {} }));
	assert.equal(dto.requestId, null);
});

// ── cursor ────────────────────────────────────────────────────────

test('cursor: encode then decode round-trips', () => {
	const date = new Date('2026-01-01T00:00:00Z');
	const id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
	const decoded = decodeCursor(encodeCursor(date, id));

	assert.ok(decoded !== null);
	assert.equal(decoded.id, id);
	assert.equal(decoded.createdAt, date.toISOString());
});

test('cursor: carries Postgres text timestamps verbatim (microsecond precision)', () => {
	// The keyset cursor must not round-trip through a millisecond JS Date —
	// same-millisecond events would be skipped between pages.
	const raw = '2026-01-01 00:00:00.123456+00';
	const id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
	const decoded = decodeCursor(encodeCursor(raw, id));
	assert.equal(decoded?.createdAt, raw);
});

test('cursor: rejects non-UUID ids and oversized cursors instead of hitting the ::uuid cast', () => {
	const iso = '2026-01-01T00:00:00Z';
	assert.equal(decodeCursor(Buffer.from(`${iso},evt-abc`).toString('base64')), null);
	assert.equal(decodeCursor('A'.repeat(300)), null);
});

test('cursor: decodeCursor returns null for garbage input', () => {
	assert.equal(decodeCursor('!!!not-base64!!!'), null);
});

// ── model ─────────────────────────────────────────────────────────

test('AuditEventModel.list: passes workspaceId filter', async () => {
	const captured: unknown[][] = [];
	const store = {
		query: async <T>(_sql: string, params: unknown[]): Promise<T[]> => {
			captured.push(params);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1' });

	assert.ok(captured[0]?.includes('ws-1'));
});

test('AuditEventModel.list: appends type filter when provided', async () => {
	const sqls: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			sqls.push(sql);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', type: 'project.created' });

	assert.ok(sqls[0]?.includes('type = $'));
});

test('AuditEventModel.list: appends actorId filter when provided', async () => {
	const sqls: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			sqls.push(sql);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', actorId: 'u-1' });

	assert.ok(sqls[0]?.includes("payload->>'userId'"));
});

test('AuditEventModel.list: appends cursor filter when valid cursor provided', async () => {
	const sqls: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			sqls.push(sql);
			return [];
		},
	};

	const cursor = encodeCursor(new Date('2026-01-01T00:00:00Z'), 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001');
	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', cursor });

	assert.ok(sqls[0]?.includes('(created_at, id) <'));
});

test('AuditEventModel.list: clamps limit to 200', async () => {
	const params: unknown[][] = [];
	const store = {
		query: async <T>(_sql: string, p: unknown[]): Promise<T[]> => {
			params.push(p);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', limit: 9999 });

	// Clamped to MAX_LIMIT, plus the internal +1 over-fetch that detects a
	// next page (kept inside the model so no outer clamp can shave it off).
	const limit = params[0]?.[params[0].length - 1];
	assert.equal(limit, 201);
});

// ── pagination ────────────────────────────────────────────────────

test('AuditEventModel.list: reports hasMore and slices the page', async () => {
	const rows = Array.from({ length: 51 }, (_, i) =>
		makeEvent({ id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}` }),
	);
	const store = { query: async <T>(): Promise<T[]> => rows as T[] };
	const page = await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', limit: 50 });
	assert.equal(page.events.length, 50);
	assert.equal(page.hasMore, true);

	const small = { query: async <T>(): Promise<T[]> => [makeEvent()] as T[] };
	const one = await new AuditEventModel(small as never).list({ workspaceId: 'ws-1', limit: 50 });
	assert.equal(one.hasMore, false);
});

test('AuditEventModel.list: hasMore survives the MAX page size (the nextCursor regression)', async () => {
	// Previously the route over-fetched limit+1 and the model re-clamped to
	// 200, cancelling the over-fetch — nextCursor could never be set at
	// limit=200 and pagination silently ended at the boundary.
	const rows = Array.from({ length: 201 }, (_, i) =>
		makeEvent({ id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}` }),
	);
	const store = { query: async <T>(): Promise<T[]> => rows as T[] };
	const page = await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', limit: 200 });
	assert.equal(page.events.length, 200);
	assert.equal(page.hasMore, true);
});

test('GET /audit: emits a microsecond-precise nextCursor at the page boundary', async () => {
	const raw = '2026-01-01 00:00:00.123456+00';
	const rows = Array.from({ length: 3 }, (_, i) => ({
		...makeEvent({ id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}` }),
		createdAtRaw: raw,
	}));
	const store = { query: async <T>(): Promise<T[]> => rows as T[] };
	const routes = buildAuditRoutes(store as never);
	const handler = routes[0]![routes[0]!.length - 1] as (
		ctx: unknown,
		next: () => Promise<Response>,
	) => Promise<Response>;
	const ctx = {
		workspace: { id: 'ws-1' },
		user: { id: 'u-1' },
		meta: {},
		request: new Request('http://localhost/audit?limit=2'),
	};
	const res = await handler(ctx, async () => new Response());
	const body = (await res.json()) as {
		result: { events: unknown[]; nextCursor: string | null };
	};
	assert.equal(body.result.events.length, 2);
	assert.ok(body.result.nextCursor);
	const decoded = decodeCursor(body.result.nextCursor!);
	assert.equal(decoded?.createdAt, raw, 'cursor must carry created_at::text, not a truncated Date');
});

// ── model: date filters ───────────────────────────────────────────

test('AuditEventModel.list: appends from filter when provided', async () => {
	const sqls: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			sqls.push(sql);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', from: new Date() });

	assert.ok(sqls[0]?.includes('created_at >='));
});

test('AuditEventModel.list: appends to filter when provided', async () => {
	const sqls: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			sqls.push(sql);
			return [];
		},
	};

	await new AuditEventModel(store as never).list({ workspaceId: 'ws-1', to: new Date() });

	assert.ok(sqls[0]?.includes('created_at <='));
});

test('AuditEventModel.list: invalid cursor is silently ignored', async () => {
	const store = { query: async <T>(): Promise<T[]> => [] as T[] };

	await assert.doesNotReject(() =>
		new AuditEventModel(store as never).list({ workspaceId: 'ws-1', cursor: 'not-valid' }),
	);
});

// ── route ─────────────────────────────────────────────────────────

test('GET /audit: 401 when not authenticated', async () => {
	const app = makeApp();
	await app.boot();

	const res = await app.handle(makeRequest('/audit'));
	assert.equal(res.status, 401);
});

test('GET /audit: 422 when no workspace context', async () => {
	const app = makeApp();
	await app.boot();

	const res = await app.handle(makeRequest('/audit', { id: 'u-1' }));
	assert.equal(res.status, 422);
});

test('GET /audit: 200 with events array', async () => {
	const events = [makeEvent(), makeEvent({ id: 'evt-2' })];
	const app = makeApp(events);
	await app.boot();

	const res = await app.handle(makeRequest('/audit', { id: 'u-1' }, { id: 'ws-1' }));
	const body = (await res.json()) as { result: { events: unknown[] } };

	assert.equal(res.status, 200);
	assert.equal(body.result.events.length, 2);
});

test('GET /audit: nextCursor is null when results fit in page', async () => {
	const app = makeApp([makeEvent()]);
	await app.boot();

	const res = await app.handle(makeRequest('/audit', { id: 'u-1' }, { id: 'ws-1' }));
	const body = (await res.json()) as { result: { nextCursor: string | null } };

	assert.equal(body.result.nextCursor, null);
});
