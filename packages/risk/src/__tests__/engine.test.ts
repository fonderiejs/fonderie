import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RiskEngine, scoreFromFired, type Queryable } from '../engine.js';
import {
	TRIAL_START_RULESET,
	DEFAULT_RULESETS,
	tierFor,
	attributeFires,
	validateRuleset,
} from '../rulesets.js';
import { hashValue, ipBucket, normalizeForKind, resolvePepper } from '../hashing.js';
import type { RuleSet } from '../types.js';

const PEPPER = 'test-pepper-not-a-placeholder-1234567890';

// ── pure scoring / tiers ──────────────────────────────────────────

test('scoreFromFired + tierFor: card reuse alone is high', () => {
	const { score, reasons } = scoreFromFired(TRIAL_START_RULESET, ['cardReuse']);
	assert.equal(score, 75);
	assert.equal(tierFor(score, TRIAL_START_RULESET.tiers), 'high');
	assert.deepEqual(reasons, [{ signal: 'cardReuse', weight: 75 }]);
});

test('tierFor: boundaries — <30 low, 30..70 medium, >70 high', () => {
	const t = TRIAL_START_RULESET.tiers;
	assert.equal(tierFor(0, t), 'low');
	assert.equal(tierFor(29, t), 'low');
	assert.equal(tierFor(30, t), 'medium');
	assert.equal(tierFor(70, t), 'medium');
	assert.equal(tierFor(71, t), 'high');
});

test('scoreFromFired: device reuse + disposable email = medium', () => {
	const { score } = scoreFromFired(TRIAL_START_RULESET, ['deviceReuse', 'disposableEmail']);
	assert.equal(score, 45);
	assert.equal(tierFor(score, TRIAL_START_RULESET.tiers), 'medium');
});

test('scoreFromFired: unknown fired signal is ignored', () => {
	const { score } = scoreFromFired(TRIAL_START_RULESET, ['nope']);
	assert.equal(score, 0);
});

// ── attribute firing ──────────────────────────────────────────────

test('attributeFires: under / over / equals / bare boolean', () => {
	assert.equal(attributeFires({ weight: 1, attr: 'age', under: 10 }, { age: 5 }), true);
	assert.equal(attributeFires({ weight: 1, attr: 'age', under: 10 }, { age: 15 }), false);
	assert.equal(attributeFires({ weight: 1, attr: 'n', over: 3 }, { n: 4 }), true);
	assert.equal(attributeFires({ weight: 1, attr: 'plan', equals: 'free' }, { plan: 'free' }), true);
	assert.equal(attributeFires({ weight: 1, attr: 'disp' }, { disp: true }), true);
	assert.equal(attributeFires({ weight: 1, attr: 'disp' }, { disp: false }), false);
	assert.equal(attributeFires({ weight: 1, attr: 'missing' }, {}), false);
});

// ── hashing / PII firewall ────────────────────────────────────────

test('hashValue: deterministic, peppered, domain-separated', () => {
	assert.equal(hashValue(PEPPER, 'card', 'x'), hashValue(PEPPER, 'card', 'x'));
	assert.notEqual(hashValue(PEPPER, 'card', 'x'), hashValue(PEPPER, 'ip', 'x'));
	assert.notEqual(hashValue(PEPPER, 'card', 'x'), hashValue('other-pepper-abcdefghijklmnop-000', 'card', 'x'));
	assert.match(hashValue(PEPPER, 'card', 'x'), /^[0-9a-f]{64}$/);
});

test('ipBucket: v4 passthrough, v6 /64, v4-mapped resolves to v4', () => {
	assert.equal(ipBucket('203.0.113.7'), '203.0.113.7');
	assert.equal(ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
	assert.equal(ipBucket('::ffff:203.0.113.7'), '203.0.113.7');
	assert.notEqual(ipBucket('::ffff:203.0.113.7'), ipBucket('::ffff:198.51.100.9'));
});

test('normalizeForKind: ip bucketed, others lowercased/trimmed', () => {
	assert.equal(normalizeForKind('email-domain', '  Gmail.COM '), 'gmail.com');
	assert.equal(normalizeForKind('ip', ' 203.0.113.7 '), '203.0.113.7');
});

test('resolvePepper: dev fallback out of prod; throws in prod; rejects placeholder/short', () => {
	const orig = process.env.NODE_ENV;
	try {
		process.env.NODE_ENV = 'development';
		assert.ok(resolvePepper());
		assert.equal(resolvePepper(PEPPER), PEPPER);
		assert.notEqual(resolvePepper('change-me-long-random-string'), 'change-me-long-random-string');
		process.env.NODE_ENV = 'production';
		assert.throws(() => resolvePepper(), /required in production/);
		assert.throws(() => resolvePepper('too-short'), /required in production/);
		assert.equal(resolvePepper(PEPPER), PEPPER); // a real one is fine in prod
	} finally {
		process.env.NODE_ENV = orig;
	}
});

// ── ruleset validation ────────────────────────────────────────────

test('validateRuleset: the shipped trial ruleset is valid', () => {
	validateRuleset(TRIAL_START_RULESET);
	assert.ok(DEFAULT_RULESETS['trial.start']);
});

test('validateRuleset: rejects bad window, bad weight, multi-kind signal', () => {
	const bad = (signals: RuleSet['signals']): RuleSet => ({ subject: 's', signals, tiers: { medium: 30, high: 70 } });
	assert.throws(() => validateRuleset(bad({ v: { weight: 1, velocity: 'ip', window: '1h', over: 2 } })), /Postgres interval/);
	assert.throws(() => validateRuleset(bad({ w: { weight: 0, reuse: 'card' } })), /positive number/);
	// multi-kind: both reuse and attr
	assert.throws(
		() => validateRuleset(bad({ m: { weight: 1, reuse: 'card', attr: 'x' } as never })),
		/exactly one of/,
	);
});

// ── engine.assess against a fake store ────────────────────────────

interface Recorded { sql: string; params: unknown[] }
function fakeStore(cfg: {
	reuseKinds?: Set<string>; // signal_kinds that should read as "seen elsewhere"
	velocity?: Record<string, number>; // signal_kind -> count
} = {}): Queryable & { calls: Recorded[] } {
	const calls: Recorded[] = [];
	return {
		calls,
		async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
			calls.push({ sql, params });
			if (sql.includes('SELECT 1 FROM risk_events')) {
				const kind = params[1] as string;
				return (cfg.reuseKinds?.has(kind) ? [{}] : []) as T[];
			}
			if (sql.includes('count(DISTINCT assessment_id)')) {
				const kind = params[1] as string;
				return [{ n: cfg.velocity?.[kind] ?? 0 }] as unknown as T[];
			}
			return [] as T[]; // INSERT / UPDATE / DELETE
		},
	};
}

test('assess: clean signals → low, and every identifier is persisted pending', async () => {
	const store = fakeStore();
	const engine = new RiskEngine(store, { rulesets: DEFAULT_RULESETS, pepper: PEPPER });
	const v = await engine.assess('trial.start', {
		actorId: 'user-1',
		identifiers: [
			{ kind: 'card', value: 'fp_abc' },
			{ kind: 'device', value: 'dev_1' },
			{ kind: 'ip', value: '203.0.113.7' },
		],
		attributes: { accountAgeMinutes: 120, disposableEmail: false },
	});
	assert.equal(v.tier, 'low');
	assert.equal(v.score, 0);
	const inserts = store.calls.filter((c) => c.sql.includes('INSERT INTO risk_events'));
	assert.equal(inserts.length, 3, 'one pending row per identifier');
	assert.ok(inserts.every((c) => c.sql.includes("'pending'") && c.params.length === 7));
});

test('assess: reused card → high verdict with a reason', async () => {
	const store = fakeStore({ reuseKinds: new Set(['card']) });
	const engine = new RiskEngine(store, { rulesets: DEFAULT_RULESETS, pepper: PEPPER });
	const v = await engine.assess('trial.start', {
		actorId: 'user-2',
		identifiers: [{ kind: 'card', value: 'fp_reused' }],
	});
	assert.equal(v.tier, 'high');
	assert.ok(v.reasons.some((r) => r.signal === 'cardReuse' && r.weight === 75));
});

test('assess: device velocity over threshold + fresh account → medium', async () => {
	const store = fakeStore({ velocity: { device: 5 } });
	const engine = new RiskEngine(store, { rulesets: DEFAULT_RULESETS, pepper: PEPPER });
	const v = await engine.assess('trial.start', {
		identifiers: [{ kind: 'device', value: 'dev_burst' }],
		attributes: { accountAgeMinutes: 2 },
	});
	// signupVelocity(30) + freshAccount(10) = 40 → medium
	assert.equal(v.score, 40);
	assert.equal(v.tier, 'medium');
});

test('assess: unknown subject throws', async () => {
	const engine = new RiskEngine(fakeStore(), { rulesets: DEFAULT_RULESETS, pepper: PEPPER });
	await assert.rejects(() => engine.assess('nope.subject', { identifiers: [] }), /no ruleset/);
});

test('record: flips the assessment rows to the outcome', async () => {
	const store = fakeStore();
	const engine = new RiskEngine(store, { rulesets: DEFAULT_RULESETS, pepper: PEPPER });
	await engine.record('a-1', 'blocked');
	const upd = store.calls.find((c) => c.sql.includes('UPDATE risk_events'));
	assert.ok(upd);
	assert.equal(upd?.params[0], 'a-1');
	assert.equal(upd?.params[1], 'blocked');
});
