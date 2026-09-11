import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Logger } from '../logger';
import { requestLogger } from '../middlewares';
import { formatTraceparent, newTraceContext, parseTraceparent } from '../trace';
import type { ISpan, ITraceExporter } from '../trace';
import { ConsoleTransport } from '../transports/console';
import { FileTransport } from '../transports/file';
import type { ILogEntry, ILogTransport } from '../types';

// ── Capture transport ─────────────────────────────────────────────

function makeCapture(): { transport: ILogTransport; entries: ILogEntry[] } {
	const entries: ILogEntry[] = [];
	return {
		entries,
		transport: {
			write: (e) => {
				entries.push(e);
			},
		},
	};
}

// ── Logger ────────────────────────────────────────────────────────

test('Logger: writes info entry to transport', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });

	logger.info('hello world');

	assert.equal(entries.length, 1);
	assert.equal(entries[0]!.level, 'info');
	assert.equal(entries[0]!.message, 'hello world');
	assert.ok(entries[0]!.timestamp);
});

test('Logger: respects minimum level — drops entries below threshold', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ level: 'warn', transports: [transport] });

	logger.debug('ignored');
	logger.info('also ignored');
	logger.warn('included');

	assert.equal(entries.length, 1);
	assert.equal(entries[0]!.level, 'warn');
});

test('Logger: all levels write correctly', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ level: 'debug', transports: [transport] });

	logger.debug('d');
	logger.info('i');
	logger.warn('w');
	logger.error('e');
	logger.fatal('f');

	assert.deepEqual(
		entries.map((e) => e.level),
		['debug', 'info', 'warn', 'error', 'fatal'],
	);
});

test('Logger: attaches extra context fields to entry', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });

	logger.info('request complete', { requestId: 'abc-123', duration: 42 });

	assert.equal(entries[0]!['requestId'], 'abc-123');
	assert.equal(entries[0]!['duration'], 42);
});

test('Logger: serialises Error into error field', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });

	const err = new Error('something broke');
	logger.error('operation failed', err);

	assert.ok(entries[0]!.error);
	assert.equal(entries[0]!.error!.message, 'something broke');
	assert.ok(entries[0]!.error!.stack);
});

test('Logger: non-Error passed to error() does not set error field', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });

	logger.error('bad value', 'a string', {});

	assert.equal(entries[0]!.error, undefined);
});

// ── child ─────────────────────────────────────────────────────────

test('Logger.child: inherits parent context', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });
	const child = logger.child({ requestId: 'req-1' });

	child.info('child message');

	assert.equal(entries[0]!['requestId'], 'req-1');
});

test('Logger.child: child context overrides parent context', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });
	const child = logger.child({ requestId: 'parent' }).child({ requestId: 'child' });

	child.info('override');

	assert.equal(entries[0]!['requestId'], 'child');
});

test('Logger.child: parent is not affected by child context', () => {
	const { transport, entries } = makeCapture();
	const logger = new Logger({ transports: [transport] });
	const child = logger.child({ requestId: 'child-only' });

	logger.info('from parent');
	child.info('from child');

	assert.equal(entries[0]!['requestId'], undefined);
	assert.equal(entries[1]!['requestId'], 'child-only');
});

// ── multiple transports ───────────────────────────────────────────

test('Logger: writes to all registered transports', () => {
	const a = makeCapture();
	const b = makeCapture();
	const logger = new Logger({ transports: [a.transport, b.transport] });

	logger.info('broadcast');

	assert.equal(a.entries.length, 1);
	assert.equal(b.entries.length, 1);
});

// ── ConsoleTransport ──────────────────────────────────────────────

test('ConsoleTransport: satisfies ILogTransport interface', () => {
	const t = new ConsoleTransport();
	assert.ok(typeof t.write === 'function');
});

// ── FileTransport ─────────────────────────────────────────────────

test('FileTransport: satisfies ILogTransport interface', () => {
	const t = new FileTransport('/tmp/fonderie-test.log');
	assert.ok(typeof t.write === 'function');
});

test('FileTransport: writes JSON line to file', async () => {
	const { readFileSync, unlinkSync, existsSync } = await import('node:fs');
	const path = `/tmp/fonderie-logger-test-${Date.now()}.log`;

	const t = new FileTransport(path);
	t.write({ level: 'info', message: 'file test', timestamp: new Date().toISOString() });

	const line = readFileSync(path, 'utf8').trim();
	const parsed = JSON.parse(line) as ILogEntry;
	assert.equal(parsed.level, 'info');
	assert.equal(parsed.message, 'file test');

	if (existsSync(path)) unlinkSync(path);
});

// ── LoggerModule ──────────────────────────────────────────────────

test('LoggerModule: satisfies IFonderieModule interface', async () => {
	const { LoggerModule } = await import('../module');
	const mod = new LoggerModule();

	assert.equal(mod.name, '@fonderie/logger');
	assert.ok(typeof mod.install === 'function');
	assert.ok(mod.logger instanceof Logger);
});

// ── B3: canonical security-event helper ─────────────────────────────────
import { logSecurityEvent } from '../security-event';

test('logSecurityEvent: success → info with canonical fields', () => {
	let level = '';
	let ctx: Record<string, unknown> = {};
	const fake = {
		info: (_m: string, c?: Record<string, unknown>) => { level = 'info'; ctx = c ?? {}; },
		warn: (_m: string, c?: Record<string, unknown>) => { level = 'warn'; ctx = c ?? {}; },
	} as any;
	logSecurityEvent(fake, { action: 'auth.login', outcome: 'success', actorId: 'u1', workspaceId: 'w1' });
	assert.equal(level, 'info');
	assert.equal(ctx['event'], 'security');
	assert.equal(ctx['action'], 'auth.login');
	assert.equal(ctx['outcome'], 'success');
	assert.equal(ctx['actorId'], 'u1');
});

test('logSecurityEvent: failure/denied → warn', () => {
	let level = '';
	const fake = { info: () => { level = 'info'; }, warn: () => { level = 'warn'; } } as any;
	logSecurityEvent(fake, { action: 'authz.permission_denied', outcome: 'denied' });
	assert.equal(level, 'warn');
});

// ── requestLogger: correlation id accept + echo ──────────────────────────────
test('requestLogger honours a safe inbound X-Request-ID and echoes it; mints one otherwise', async () => {
	const logger = new Logger({ transports: [{ write: () => {} }] });
	const mw = requestLogger(logger);

	const run = async (headers: Record<string, string>) => {
		const ctx = { request: new Request('http://x/jobs', { headers }), meta: {} } as any;
		const res = await mw(ctx, async () => new Response(null, { status: 200 }));
		return { requestId: ctx.meta['requestId'] as string, echoed: res.headers.get('X-Request-Id') };
	};

	// A safe inbound id is honoured on ctx.meta and echoed in the response.
	const a = await run({ 'X-Request-ID': 'abc-123' });
	assert.equal(a.requestId, 'abc-123');
	assert.equal(a.echoed, 'abc-123');

	// An unsafe id (chars outside the bounded token set) is rejected → fresh uuid.
	const b = await run({ 'X-Request-ID': 'a/b c' });
	assert.notEqual(b.requestId, 'a/b c');
	assert.match(b.requestId, /^[0-9a-f-]{36}$/);
	assert.equal(b.echoed, b.requestId);

	// No inbound id → one is minted and echoed.
	const c = await run({});
	assert.match(c.requestId, /^[0-9a-f-]{36}$/);
	assert.equal(c.echoed, c.requestId);
});

// ── W3C trace context ────────────────────────────────────────────────────────
test('trace: parseTraceparent validates + parses; formatTraceparent round-trips', () => {
	const p = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
	assert.equal(p?.traceId, '0af7651916cd43dd8448eb211c80319c');
	assert.equal(p?.spanId, 'b7ad6b7169203331');
	assert.equal(p?.sampled, true);
	assert.equal(parseTraceparent('00-nothex-b7ad6b7169203331-01'), null);
	assert.equal(parseTraceparent(`00-${'0'.repeat(32)}-b7ad6b7169203331-01`), null); // all-zero trace
	assert.equal(parseTraceparent('99-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'), null); // bad version
	assert.equal(parseTraceparent(null), null);
	assert.match(formatTraceparent(newTraceContext()), /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
});

test('requestLogger: continues an inbound trace, echoes traceparent, emits a span', async () => {
	const spans: ISpan[] = [];
	const exporter: ITraceExporter = { export: (s) => { spans.push(s); } };
	const logger = new Logger({ transports: [{ write: () => {} }] });
	const mw = requestLogger(logger, exporter);

	const inboundTrace = '11111111111111111111111111111111';
	const inboundSpan = '2222222222222222';
	const ctx = {
		request: new Request('http://x/jobs', {
			headers: { traceparent: `00-${inboundTrace}-${inboundSpan}-01` },
		}),
		meta: {} as Record<string, unknown>,
		user: { id: 'u1' },
	} as any;
	const res = await mw(ctx, async () => new Response(null, { status: 200 }));

	// Same trace, fresh server span, inbound span as parent.
	assert.equal(ctx.meta['traceId'], inboundTrace);
	assert.match(ctx.meta['spanId'] as string, /^[0-9a-f]{16}$/);
	assert.notEqual(ctx.meta['spanId'], inboundSpan);
	assert.equal(res.headers.get('traceparent'), `00-${inboundTrace}-${ctx.meta['spanId']}-01`);

	// One span exported with the right ids + attributes.
	assert.equal(spans.length, 1);
	assert.equal(spans[0]!.traceId, inboundTrace);
	assert.equal(spans[0]!.parentSpanId, inboundSpan);
	assert.equal(spans[0]!.status, 200);
	assert.equal(spans[0]!.attributes['enduser.id'], 'u1');
	assert.match(spans[0]!.startUnixNano, /^\d+$/);
});

test('requestLogger: starts a fresh trace when none is inbound', async () => {
	const logger = new Logger({ transports: [{ write: () => {} }] });
	const mw = requestLogger(logger);
	const ctx = { request: new Request('http://x/jobs'), meta: {} as Record<string, unknown> } as any;
	const res = await mw(ctx, async () => new Response(null, { status: 204 }));
	assert.match(ctx.meta['traceId'] as string, /^[0-9a-f]{32}$/);
	assert.equal(res.headers.get('traceparent'), `00-${ctx.meta['traceId']}-${ctx.meta['spanId']}-01`);
});
