// Public types for @fonderie/risk. The engine is generic over a "subject" (the
// action being assessed) and returns a graded verdict — never an action.

/** A correlating value the engine may reason about. Hashed on the way in;
 * the raw value never touches the store. `kind` is an open set — 'card', 'ip',
 * 'device', 'email-domain', or anything an app defines. */
export interface Identifier {
	kind: string;
	value: string;
}

/** The evidence bag for one assessment. */
export interface RiskContext {
	/** The assessed principal, when known (a user id at login/trial). Used to
	 * exclude an actor's own prior events from "reuse". */
	actorId?: string | null;
	/** Correlating identifiers; hashed by the engine before storage/lookup. */
	identifiers: Identifier[];
	/** Non-correlating facts a ruleset's attribute signals read (e.g.
	 * accountAgeMinutes, disposableEmail). */
	attributes?: Record<string, string | number | boolean>;
}

export type RiskTier = 'low' | 'medium' | 'high';

/** One weighted reason a verdict scored as it did — explainable, for logs and
 * appeals. */
export interface RiskReason {
	signal: string;
	weight: number;
}

export interface RiskVerdict {
	score: number;
	tier: RiskTier;
	reasons: RiskReason[];
	/** Correlates the later record() call to this assessment's stored rows. */
	assessmentId: string;
}

/** The outcome an app reports back via record() — what it actually did. */
export type RiskOutcome = 'allowed' | 'challenged' | 'blocked';

// ── ruleset shapes ────────────────────────────────────────────────

/** Fires when this identifier kind was seen in a prior (non-blocked)
 * assessment of the same subject by a different actor. */
export interface ReuseSignal {
	weight: number;
	reuse: string; // identifier kind
}

/** Fires when the count of distinct assessments for this identifier kind within
 * `window` exceeds `over`. `window` is a Postgres interval string ('1 hour'). */
export interface VelocitySignal {
	weight: number;
	velocity: string; // identifier kind
	window: string;
	over: number;
}

/** Fires from a ctx attribute: `under`/`over` compare a number; `equals`
 * compares any value; with none, a truthy attribute fires. */
export interface AttributeSignal {
	weight: number;
	attr: string;
	under?: number;
	over?: number;
	equals?: string | number | boolean;
}

export type RuleSignal = ReuseSignal | VelocitySignal | AttributeSignal;

export interface RuleSet {
	subject: string;
	signals: Record<string, RuleSignal>;
	/** Score thresholds: `< medium` → low, `<= high` → medium, else high. */
	tiers: { medium: number; high: number };
}

export interface RiskEngineOptions {
	/** Ruleset per subject. Data, not code — tune weights without a deploy. */
	rulesets: Record<string, RuleSet>;
	/** HMAC pepper for identifier hashes. REQUIRED in production; a leaked
	 * store is dictionary-attackable without it. */
	pepper?: string;
	/** TTL for provisional ('pending') assessment rows (Postgres interval). */
	pendingTtl?: string;
	/** TTL for recorded (terminal-outcome) rows (Postgres interval). */
	recordTtl?: string;
}
