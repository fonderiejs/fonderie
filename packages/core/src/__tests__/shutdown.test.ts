import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '../index';
import type { IFonderieModule } from '../types';

// Why this exists: a module that acquires a resource and offers no way to
// release it keeps the process alive after shutdown, with no error and no
// output. That is not hypothetical — it hung this repo's CI for six release
// cycles (@fonderie/events held a listening socket), and @fonderie/webhooks had
// already grown a private stop() for the same reason with nothing to call it.

const config = defineConfig({ db: { url: 'postgres://localhost/test' } });

function mod(
	name: string,
	log: string[],
	extra: Partial<IFonderieModule> = {},
): IFonderieModule {
	return {
		name,
		install: () => {
			log.push(`install:${name}`);
		},
		stop: () => {
			log.push(`stop:${name}`);
		},
		...extra,
	};
}

test('shutdown() stops modules in REVERSE install order', async () => {
	const log: string[] = [];
	const app = new FonderieApp(config);
	app.register(mod('@acme/a', log));
	app.register(mod('@acme/b', log, { deps: ['@acme/a'] }));
	app.register(mod('@acme/c', log, { deps: ['@acme/b'] }));
	await app.boot();
	await app.shutdown();

	// boot installs in dependency order, so a module's dependencies must still
	// be alive while it shuts down. Only the reverse keeps that true.
	assert.deepEqual(log, [
		'install:@acme/a',
		'install:@acme/b',
		'install:@acme/c',
		'stop:@acme/c',
		'stop:@acme/b',
		'stop:@acme/a',
	]);
});

test('a module without stop() is skipped, not an error', async () => {
	const log: string[] = [];
	const app = new FonderieApp(config);
	// Block body: `log.push(...)` returns a number, and an expression-bodied
	// arrow would return it where `void | Promise<void>` is expected.
	app.register({
		name: '@acme/stateless',
		install: () => {
			log.push('install');
		},
	});
	app.register(mod('@acme/stateful', log));
	await app.boot();
	await app.shutdown();
	assert.deepEqual(log, ['install', 'install:@acme/stateful', 'stop:@acme/stateful']);
});

test('one module throwing does not strand the rest holding resources', async () => {
	const log: string[] = [];
	const app = new FonderieApp(config);
	app.register(mod('@acme/first', log));
	app.register(
		mod('@acme/broken', log, {
			deps: ['@acme/first'],
			stop: () => {
				throw new Error('socket refused to close');
			},
		}),
	);
	app.register(mod('@acme/last', log, { deps: ['@acme/broken'] }));
	await app.boot();

	// The failure must be reported — a swallowed one is a leak nobody sees.
	await assert.rejects(
		() => app.shutdown(),
		(err: Error) =>
			/failed to shut down/.test(err.message) && /socket refused to close/.test(err.message),
	);

	// …and every other module must still have been stopped. This is the whole
	// point: one brick failing to clean up cannot leave the others listening.
	assert.ok(log.includes('stop:@acme/last'), 'modules before the failure still stop');
	assert.ok(log.includes('stop:@acme/first'), 'modules after the failure still stop');
});

test('shutdown() is safe to call twice — a SIGTERM handler races an explicit call', async () => {
	let stops = 0;
	const app = new FonderieApp(config);
	app.register({ name: '@acme/x', install: () => {}, stop: () => void stops++ });
	await app.boot();
	await app.shutdown();
	await app.shutdown();
	// The app does not deduplicate; the contract is that modules' stop() is
	// idempotent, so calling twice must not throw.
	assert.equal(stops, 2, 'both calls reach the module; stop() must tolerate it');
});

test('an async stop() is awaited, not fired and forgotten', async () => {
	let released = false;
	const app = new FonderieApp(config);
	app.register({
		name: '@acme/slow',
		install: () => {},
		stop: async () => {
			await new Promise((r) => setTimeout(r, 20));
			released = true;
		},
	});
	await app.boot();
	await app.shutdown();
	assert.equal(released, true, 'shutdown() must not resolve before the resource is released');
});
