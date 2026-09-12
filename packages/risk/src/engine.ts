import { randomUUID } from 'node:crypto';
import type {
	RiskContext,
	RiskEngineOptions,
	RiskOutcome,
	RiskReason,
	RiskVerdict,
	RuleSet,
} from './types.js';
import { hashValue, normalizeForKind, resolvePepper } from './hashing.js';
import {
	attributeFires,
	isAttr,
	isReuse,
	isVelocity,
	tierFor,
	validateRuleset,
} from './rulesets.js';

/** The engine only ever queries — accept the store adapter or a transaction
 * handle, so it composes into an app's own transaction if wanted. */
export interface Queryable {
	query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Sum the weights of the fired signals into a score + explainable reasons.
 * Pure — the store-backed gathering happens in assess(); this is unit-testable. */
export function scoreFromFired(rs: RuleSet, fired: Iterable<string>): { score: number; reasons: RiskReason[] } {
	let score = 0;
	const reasons: RiskReason[] = [];
	for (const name of fired) {
		const sig = rs.signals[name];
		if (!sig) continue;
		score += sig.weight;
		reasons.push({ signal: name, weight: sig.weight });
	}
	return { score, reasons };
}

/**
 * The generic risk engine. `assess()` reads the signal store, scores against a
 * subject's ruleset, and returns a graded verdict — it performs NO external
 * side effect (its only write is provisional 'pending' rows in its own
 * risk_events store, so identifiers become "seen" for later assessments).
 * `record()` flips those rows to the real outcome the app carried out.
 */
export class RiskEngine {
	private readonly rulesets: Record<string, RuleSet>;
	private readonly pepper: string;
	private readonly pendingTtl: string;
	private readonly recordTtl: string;

	constructor(
		private readonly store: Queryable,
		opts: RiskEngineOptions,
	) {
		this.rulesets = opts.rulesets;
		for (const rs of Object.values(this.rulesets)) validateRuleset(rs);
		this.pepper = resolvePepper(opts.pepper);
		this.pendingTtl = opts.pendingTtl ?? '24 hours';
		this.recordTtl = opts.recordTtl ?? '90 days';
	}

	async assess(subject: string, ctx: RiskContext): Promise<RiskVerdict> {
		const rs = this.rulesets[subject];
		if (!rs) throw new Error(`@fonderie/risk: no ruleset for subject "${subject}"`);

		const actorId = ctx.actorId ?? null;
		// Hash every identifier once; last value wins per kind.
		const hashes = new Map<string, string>();
		for (const id of ctx.identifiers) {
			hashes.set(id.kind, hashValue(this.pepper, id.kind, normalizeForKind(id.kind, id.value)));
		}

		const fired = new Set<string>();
		for (const [name, sig] of Object.entries(rs.signals)) {
			if (isReuse(sig)) {
				const h = hashes.get(sig.reuse);
				if (h && (await this.reuseSeen(subject, sig.reuse, h, actorId))) fired.add(name);
			} else if (isVelocity(sig)) {
				const h = hashes.get(sig.velocity);
				if (h && (await this.velocityCount(subject, sig.velocity, h, sig.window)) > sig.over)
					fired.add(name);
			} else if (isAttr(sig)) {
				if (attributeFires(sig, ctx.attributes)) fired.add(name);
			}
		}

		const { score, reasons } = scoreFromFired(rs, fired);
		const tier = tierFor(score, rs.tiers);
		const assessmentId = randomUUID();

		// Persist the identifiers as provisional rows so this assessment counts
		// toward future reuse/velocity. record() promotes them to the real outcome.
		for (const [kind, h] of hashes) {
			await this.store.query(
				`INSERT INTO risk_events
				   (assessment_id, subject, actor_id, signal_kind, value_hash, outcome, score, expires_at)
				 VALUES ($1, $2, $3, $4, $5, 'pending', $6, now() + $7::interval)`,
				[assessmentId, subject, actorId, kind, h, score, this.pendingTtl],
			);
		}

		return { score, tier, reasons, assessmentId };
	}

	/** Report what the app actually did; flips this assessment's provisional
	 * rows to the terminal outcome and extends their retention. */
	async record(assessmentId: string, outcome: RiskOutcome): Promise<void> {
		await this.store.query(
			`UPDATE risk_events SET outcome = $2, expires_at = now() + $3::interval
			 WHERE assessment_id = $1 AND outcome = 'pending'`,
			[assessmentId, outcome, this.recordTtl],
		);
	}

	/** Retention purge — call on a timer, not the request path. */
	async purgeExpired(): Promise<void> {
		await this.store.query('DELETE FROM risk_events WHERE expires_at < now()');
	}

	private async reuseSeen(
		subject: string,
		kind: string,
		valueHash: string,
		actorId: string | null,
	): Promise<boolean> {
		const rows = await this.store.query(
			`SELECT 1 FROM risk_events
			 WHERE subject = $1 AND signal_kind = $2 AND value_hash = $3
			   AND outcome IN ('pending', 'allowed', 'challenged')
			   AND ($4::uuid IS NULL OR actor_id IS DISTINCT FROM $4::uuid)
			 LIMIT 1`,
			[subject, kind, valueHash, actorId],
		);
		return rows.length > 0;
	}

	private async velocityCount(
		subject: string,
		kind: string,
		valueHash: string,
		window: string,
	): Promise<number> {
		const rows = await this.store.query<{ n: number | string }>(
			`SELECT count(DISTINCT assessment_id)::int AS n FROM risk_events
			 WHERE subject = $1 AND signal_kind = $2 AND value_hash = $3
			   AND created_at > now() - $4::interval`,
			[subject, kind, valueHash, window],
		);
		return Number(rows[0]?.n ?? 0);
	}
}
