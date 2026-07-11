import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Logger } from '../logger';
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
