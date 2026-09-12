// @fonderie/risk — a generic signal → meaning → decision engine.
//
// It DECIDES, it never ENFORCES: assess() reads signals and returns a graded
// verdict with reasons; the application maps that verdict to an action (deny,
// challenge, step-up MFA, cancel, alert) and owns every external side effect.
// See docs/RISK-BRICK-DESIGN.md.

export { RiskEngine, scoreFromFired } from './engine.js';
export type { Queryable } from './engine.js';
export {
	DEFAULT_RULESETS,
	TRIAL_START_RULESET,
	tierFor,
	attributeFires,
	validateRuleset,
} from './rulesets.js';
export {
	hashValue,
	ipBucket,
	normalizeForKind,
	resolvePepper,
} from './hashing.js';
export type {
	Identifier,
	RiskContext,
	RiskTier,
	RiskReason,
	RiskVerdict,
	RiskOutcome,
	ReuseSignal,
	VelocitySignal,
	AttributeSignal,
	RuleSignal,
	RuleSet,
	RiskEngineOptions,
} from './types.js';
