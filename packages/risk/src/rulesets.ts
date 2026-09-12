// Rulesets are DATA: weights, windows, and thresholds move without a deploy.
// The launch ruleset (trial.start) is the trial-abuse scorer, generalized —
// the app that consumes it maps tiers to actions (the engine never does).
import type { RuleSet, RuleSignal, RiskTier } from './types.js';

/** The reference trial-abuse ruleset. Card reuse alone is 'high' (75 > 70):
 * one free trial per physical card. Weights are illustrative and tunable. */
export const TRIAL_START_RULESET: RuleSet = {
	subject: 'trial.start',
	signals: {
		cardReuse: { weight: 75, reuse: 'card' },
		deviceReuse: { weight: 25, reuse: 'device' },
		signupVelocity: { weight: 30, velocity: 'device', window: '1 hour', over: 3 },
		ipTrials: { weight: 10, velocity: 'ip', window: '24 hours', over: 2 },
		disposableEmail: { weight: 20, attr: 'disposableEmail' },
		freshAccount: { weight: 10, attr: 'accountAgeMinutes', under: 10 },
	},
	tiers: { medium: 30, high: 70 },
};

/** The default ruleset map. Apps pass their own (merged) map to RiskEngine. */
export const DEFAULT_RULESETS: Record<string, RuleSet> = {
	'trial.start': TRIAL_START_RULESET,
};

/** `< medium` → low, `<= high` → medium, else high. */
export function tierFor(score: number, tiers: RuleSet['tiers']): RiskTier {
	if (score < tiers.medium) return 'low';
	if (score <= tiers.high) return 'medium';
	return 'high';
}

function isReuse(s: RuleSignal): s is Extract<RuleSignal, { reuse: string }> {
	return 'reuse' in s;
}
function isVelocity(s: RuleSignal): s is Extract<RuleSignal, { velocity: string }> {
	return 'velocity' in s;
}
function isAttr(s: RuleSignal): s is Extract<RuleSignal, { attr: string }> {
	return 'attr' in s;
}

const WINDOW_RE = /^\d+\s+(second|minute|hour|day|week|month)s?$/;

/** Fail fast on a malformed ruleset — a bad window would otherwise reach SQL,
 * and a non-positive weight is almost always a typo. */
export function validateRuleset(rs: RuleSet): void {
	if (!rs.subject) throw new Error('ruleset: missing subject');
	if (!rs.tiers || typeof rs.tiers.medium !== 'number' || typeof rs.tiers.high !== 'number')
		throw new Error(`ruleset ${rs.subject}: tiers.medium and tiers.high are required numbers`);
	for (const [name, sig] of Object.entries(rs.signals)) {
		if (typeof sig.weight !== 'number' || sig.weight <= 0)
			throw new Error(`ruleset ${rs.subject}.${name}: weight must be a positive number`);
		const kinds = [isReuse(sig), isVelocity(sig), isAttr(sig)].filter(Boolean).length;
		if (kinds !== 1)
			throw new Error(`ruleset ${rs.subject}.${name}: must be exactly one of reuse/velocity/attr`);
		if (isVelocity(sig)) {
			if (!WINDOW_RE.test(sig.window))
				throw new Error(`ruleset ${rs.subject}.${name}: window "${sig.window}" must be a Postgres interval like "1 hour"`);
			if (typeof sig.over !== 'number')
				throw new Error(`ruleset ${rs.subject}.${name}: velocity signal needs a numeric "over"`);
		}
	}
}

/** Does an attribute signal fire against this context's attributes? Pure. */
export function attributeFires(
	sig: Extract<RuleSignal, { attr: string }>,
	attributes: Record<string, string | number | boolean> | undefined,
): boolean {
	const v = attributes?.[sig.attr];
	if (v === undefined) return false;
	if (sig.equals !== undefined) return v === sig.equals;
	if (sig.under !== undefined) return typeof v === 'number' && v < sig.under;
	if (sig.over !== undefined) return typeof v === 'number' && v > sig.over;
	return v === true; // bare boolean attribute
}

export { isReuse, isVelocity, isAttr };
