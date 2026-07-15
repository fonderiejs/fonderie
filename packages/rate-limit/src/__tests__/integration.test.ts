import assert from 'node:assert/strict';
import { test } from 'node:test';

import { StoreAdapterStore } from '../stores/store-adapter';
import { getMigrationsPath } from '../migrations';
import type { IRateLimitRule } from '../types';

// Real-engine concurrency proof. The unit-test race case exercises an
// in-process emulator of the row lock; this one drives an actual PostgreSQL
// (and, when configured, Redis), because "atomic, no race conditions" is a
// claim about the ENGINE, not about our emulator.
//
// Gated on env vars so `npm test` stays green with no database. CI sets them
// against service containers (see .github/workflows/ci.yml). Run locally with:
//   RATE_LIMIT_PG_URL=postgres://... npm test -w @fonderie/rate-limit

const PG_URL = process.env['RATE_LIMIT_PG_URL'];
const REDIS_URL = process.env['RATE_LIMIT_REDIS_URL'];

const RULE: IRateLimitRule = { capacity: 20, refillPerSec: 0.001 }; // effectively no refill during the test

test(
	'PostgreSQL: 200 concurrent consumes grant exactly capacity, never more',
	{ skip: PG_URL ? false : 'set RATE_LIMIT_PG_URL to run' },
	async () => {
		const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
		const store = new PGAdapter(PG_URL!);
		await new InternalMigrationRunner(store, getMigrationsPath()).run();
		await store.query('DELETE FROM fonderie_rate_limits WHERE key = $1', ['pg-race']);

		const limiter = new StoreAdapterStore(store);
		const attempts = 200;
		const results = await Promise.all(
			Array.from({ length: attempts }, () => limiter.consume('pg-race', RULE)),
		);
		const granted = results.filter((r) => r.allowed).length;
		assert.equal(
			granted,
			RULE.capacity,
			`granted ${granted} of ${attempts}; the upsert must serialize to exactly ${RULE.capacity}`,
		);
	},
);

test(
	'Redis: 200 concurrent consumes grant exactly capacity, never more',
	{ skip: REDIS_URL ? false : 'set RATE_LIMIT_REDIS_URL to run' },
	async () => {
		// Adapt node-redis v4's object-arg eval to the positional
		// IRedisEvalClient shape RedisStore expects.
		const { createClient } = await import('redis');
		const c = createClient({ url: REDIS_URL! });
		await c.connect();
		const client = {
			eval: (script: string, _numKeys: number, ...rest: (string | number)[]) =>
				c.eval(script, {
					keys: [String(rest[0])],
					arguments: rest.slice(1).map(String),
				}) as Promise<unknown>,
		};

		const { RedisStore } = await import('../stores/redis');
		const store = new RedisStore(client, 'itest:');
		const results = await Promise.all(
			Array.from({ length: 200 }, () => store.consume('redis-race', RULE)),
		);
		const granted = results.filter((r) => r.allowed).length;
		await c.quit();
		assert.equal(granted, RULE.capacity, `granted ${granted}; Lua eval must serialize`);
	},
);
