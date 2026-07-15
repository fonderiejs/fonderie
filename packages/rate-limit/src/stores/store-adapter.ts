import type { IStoreAdapter } from '@fonderie/store';

import type { IConsumeResult, IRateLimitRule, IRateLimitStore } from '../types';

// Distributed store over the IStoreAdapter (PostgreSQL) every Fonderie module
// already receives. Refill-then-consume happens in ONE upsert — the
// ON CONFLICT UPDATE recomputes the bucket from the stored row inside the
// row lock the statement takes, so N app instances hammering the same key
// can never both win the last token. No transaction, no read-modify-write.
//
// TIME COMES FROM THE DATABASE, not the app. `clock_timestamp()` is evaluated
// once in the VALUES clause and reused via EXCLUDED.last_refill_ms in the
// UPDATE — so every app instance measures elapsed time against ONE
// authoritative clock. This removes app-server clock skew from the refill
// math entirely (making "distributed-correct" literally true, not
// "true assuming NTP"). clock_timestamp() — not now()/transaction_timestamp()
// — because we want real wall-clock at execution, and it MUST be captured
// once: a second call would return a slightly later value and desync the two
// places `now` is used.
//
// RETURNING only sees the post-update row, which cannot distinguish
// "allowed, bucket now low" from "denied, bucket unchanged" — so the
// allow/deny verdict is computed INSIDE the statement and persisted to the
// `granted` column, then read back.
//
// Params: $1 key, $2 capacity, $3 cost, $4 refill_per_sec.
// `refilled` = min(capacity, old.tokens + elapsed_sec * refill_per_sec),
// where elapsed uses EXCLUDED.last_refill_ms (this call's DB `now`).
const REFILLED = `LEAST($2::double precision,
	fonderie_rate_limits.tokens
	+ GREATEST(0, EXCLUDED.last_refill_ms - fonderie_rate_limits.last_refill_ms) / 1000.0
	  * $4::double precision)`;

const CONSUME_SQL = `
INSERT INTO fonderie_rate_limits (key, tokens, last_refill_ms, granted)
VALUES (
	$1,
	GREATEST(0, $2::double precision - $3::double precision),
	(EXTRACT(EPOCH FROM clock_timestamp()) * 1000.0),
	$2::double precision >= $3::double precision
)
ON CONFLICT (key) DO UPDATE SET
	tokens = CASE
		WHEN ${REFILLED} >= $3::double precision THEN ${REFILLED} - $3::double precision
		ELSE ${REFILLED}
	END,
	granted = ${REFILLED} >= $3::double precision,
	last_refill_ms = EXCLUDED.last_refill_ms
RETURNING tokens, granted
`;

// Idle rows (past a full refill) are dead weight; prune them using DB time too.
const CLEAN_SQL = `
DELETE FROM fonderie_rate_limits
WHERE last_refill_ms < (EXTRACT(EPOCH FROM clock_timestamp()) * 1000.0) - $1
`;

export class StoreAdapterStore implements IRateLimitStore {
	private ops = 0;
	private static CLEAN_EVERY = 512;

	constructor(private store: IStoreAdapter) {}

	async consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult> {
		const cost = rule.cost ?? 1;

		const rows = await this.store.query<{ tokens: number | string; granted: boolean }>(
			CONSUME_SQL,
			[key, rule.capacity, cost, rule.refillPerSec],
		);
		const row = rows[0];
		if (!row) throw new Error('[rate-limit] consume returned no row');

		const tokens = Number(row.tokens);

		if (++this.ops % StoreAdapterStore.CLEAN_EVERY === 0) {
			const idleMs = Math.ceil((rule.capacity / rule.refillPerSec) * 1000);
			this.store.query(CLEAN_SQL, [idleMs]).catch(() => {});
		}

		if (row.granted) {
			return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
		}
		return {
			allowed: false,
			remaining: 0,
			retryAfterMs: Math.ceil(((cost - tokens) / rule.refillPerSec) * 1000),
		};
	}
}
