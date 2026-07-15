import type { IStoreAdapter } from '@fonderie/store';

import { fullRefillMs } from '../bucket';
import type { IConsumeResult, IRateLimitRule, IRateLimitStore } from '../types';

// Distributed store over the IStoreAdapter (PostgreSQL) every Fonderie module
// already receives. Refill-then-consume happens in ONE upsert — the
// ON CONFLICT UPDATE recomputes the bucket from the stored row inside the
// row lock the statement takes, so N app instances hammering the same key
// can never both win the last token. No transaction, no read-modify-write.
//
// RETURNING only sees the post-update row, which cannot distinguish
// "allowed, bucket now low" from "denied, bucket unchanged" — so the
// allow/deny verdict is computed INSIDE the statement (from pre-update
// state) and persisted to the `granted` column, then read back.
//
// Params: $1 key, $2 capacity, $3 now_ms, $4 cost, $5 refill_per_sec.
// `refilled` = min(capacity, old.tokens + elapsed_sec * refill_per_sec).
const REFILLED = `LEAST($2::double precision,
	fonderie_rate_limits.tokens
	+ GREATEST(0, $3 - fonderie_rate_limits.last_refill_ms) / 1000.0 * $5::double precision)`;

const CONSUME_SQL = `
INSERT INTO fonderie_rate_limits (key, tokens, last_refill_ms, granted)
VALUES ($1, GREATEST(0, $2::double precision - $4::double precision), $3, $2::double precision >= $4::double precision)
ON CONFLICT (key) DO UPDATE SET
	tokens = CASE
		WHEN ${REFILLED} >= $4::double precision THEN ${REFILLED} - $4::double precision
		ELSE ${REFILLED}
	END,
	granted = ${REFILLED} >= $4::double precision,
	last_refill_ms = $3
RETURNING tokens, granted
`;

export class StoreAdapterStore implements IRateLimitStore {
	private ops = 0;
	private static CLEAN_EVERY = 512;

	constructor(private store: IStoreAdapter) {}

	async consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult> {
		const cost = rule.cost ?? 1;
		const now = Date.now();

		const rows = await this.store.query<{ tokens: number | string; granted: boolean }>(
			CONSUME_SQL,
			[key, rule.capacity, now, cost, rule.refillPerSec],
		);
		const row = rows[0];
		if (!row) throw new Error('[rate-limit] consume returned no row');

		const tokens = Number(row.tokens);

		if (++this.ops % StoreAdapterStore.CLEAN_EVERY === 0) {
			// Opportunistic expiry: rows idle past a full refill are dead weight.
			this.store
				.query('DELETE FROM fonderie_rate_limits WHERE last_refill_ms < $1', [
					now - fullRefillMs(rule),
				])
				.catch(() => {});
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
