import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	background,
	isServerlessRuntime,
	resolveBackgroundMode,
	setBackgroundRunner,
} from '../background';

// Detached work is abandoned when the platform freezes the instance after the
// response — silently, since the code that would log the failure never runs.
// These lock in WHERE we wait, and that a long-running host is never guessed at.

test('serverless platforms are detected by their own markers', () => {
	for (const key of [
		'VERCEL',
		'AWS_LAMBDA_FUNCTION_NAME',
		'FUNCTION_TARGET',
		'K_SERVICE',
		'FUNCTIONS_WORKER_RUNTIME',
	]) {
		assert.equal(isServerlessRuntime({ [key]: '1' }), true, `${key} should mean serverless`);
	}
});

test('EC2 / Docker / bare metal are never MISdetected — they are the fallback', () => {
	// There is no reliable "I am long-running" signal, so anything unrecognised
	// must keep today's behaviour rather than be guessed at.
	assert.equal(isServerlessRuntime({}), false);
	assert.equal(isServerlessRuntime({ NODE_ENV: 'production', HOSTNAME: 'ip-10-0-1-23' }), false);
	assert.equal(isServerlessRuntime({ DOCKER: 'true', KUBERNETES_SERVICE_HOST: '10.0.0.1' }), false);
	assert.equal(resolveBackgroundMode({}), 'detach', 'unknown host keeps the current behaviour');
});

test('auto resolves to await on serverless, detach elsewhere', () => {
	assert.equal(resolveBackgroundMode({ VERCEL: '1' }), 'await');
	assert.equal(resolveBackgroundMode({}), 'detach');
});

test('an explicit setting always wins over detection', () => {
	assert.equal(resolveBackgroundMode({ VERCEL: '1', FONDERIE_BACKGROUND_TASKS: 'detach' }), 'detach');
	assert.equal(resolveBackgroundMode({ FONDERIE_BACKGROUND_TASKS: 'await' }), 'await');
	assert.equal(resolveBackgroundMode({ FONDERIE_BACKGROUND_TASKS: ' AWAIT ' }), 'await', 'tolerant');
	assert.equal(resolveBackgroundMode({ FONDERIE_BACKGROUND_TASKS: 'nonsense' }), 'detach', 'falls back to detection');
});

test('await mode actually waits for the work to finish', async () => {
	process.env['FONDERIE_BACKGROUND_TASKS'] = 'await';
	try {
		let done = false;
		await background(new Promise<void>((r) => setTimeout(() => { done = true; r(); }, 30)));
		assert.equal(done, true, 'the work must have completed before we returned');
	} finally {
		delete process.env['FONDERIE_BACKGROUND_TASKS'];
	}
});

test('a hung provider degrades to lost work, never a hung request', async () => {
	process.env['FONDERIE_BACKGROUND_TASKS'] = 'await';
	process.env['FONDERIE_BACKGROUND_TIMEOUT_MS'] = '40';
	try {
		const started = Date.now();
		await background(new Promise(() => {})); // never settles
		assert.ok(Date.now() - started < 1000, 'must give up rather than hang the request');
	} finally {
		delete process.env['FONDERIE_BACKGROUND_TASKS'];
		delete process.env['FONDERIE_BACKGROUND_TIMEOUT_MS'];
	}
});

test('a rejection never propagates to the request that triggered it', async () => {
	process.env['FONDERIE_BACKGROUND_TASKS'] = 'await';
	try {
		await background(Promise.reject(new Error('smtp exploded')));
	} finally {
		delete process.env['FONDERIE_BACKGROUND_TASKS'];
	}
});

test('a platform runner (waitUntil) takes over and does not delay the response', async () => {
	const handed: Promise<unknown>[] = [];
	setBackgroundRunner((w) => handed.push(w));
	try {
		process.env['FONDERIE_BACKGROUND_TASKS'] = 'await';
		const started = Date.now();
		await background(new Promise((r) => setTimeout(r, 200)));
		assert.ok(Date.now() - started < 100, 'handed off, not awaited');
		assert.equal(handed.length, 1);
	} finally {
		setBackgroundRunner(null);
		delete process.env['FONDERIE_BACKGROUND_TASKS'];
	}
});
