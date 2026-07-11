import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp } from '@fonderie/core';
import { defineConfig } from '@fonderie/core';

import { toAuditEventDTO, encodeCursor, decodeCursor } from '../dtos/audit';
import { AuditEventModel } from '../models/event.model';
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
	const id = 'evt-abc';
	const decoded = decodeCursor(encodeCursor(date, id));

	assert.ok(decoded !== null);
	assert.equal(decoded.id, id);
	assert.equal(decoded.createdAt, date.toISOString());
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

	const cursor = encodeCursor(new Date('2026-01-01T00:00:00Z'), 'evt-1');
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

	const limit = params[0]?.[params[0].length - 1];
	assert.equal(limit, 200);
});

// ── pagination ────────────────────────────────────────────────────

test('route pagination: nextCursor is set when results exceed limit', () => {
	const events = Array.from({ length: 51 }, (_, i) =>
		makeEvent({ id: `evt-${i}`, createdAt: new Date(Date.now() - i * 1000) }),
	);

	const page = events.slice(0, 50);
	const hasMore = events.length > 50;
	const lastEvent = page[page.length - 1]!;
	const nextCursor = hasMore ? encodeCursor(lastEvent.createdAt, lastEvent.id) : null;

	assert.ok(nextCursor !== null);
	const decoded = decodeCursor(nextCursor);
	assert.equal(decoded?.id, 'evt-49');
});

test('route pagination: nextCursor is null when results fit in one page', () => {
	const events = [makeEvent()];
	const hasMore = events.length > 50;
	const nextCursor = hasMore ? encodeCursor(events[0]!.createdAt, events[0]!.id) : null;

	assert.equal(nextCursor, null);
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
