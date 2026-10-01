import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IAuthConfig } from '../config';
import { clientKindOf, configForClient, readAuthRuntimeConfig, SESSION_POLICY_PRESETS } from '../services/session-policy';

const base = { jwtSecret: 'x'.repeat(40), providers: ['email'] } as unknown as IAuthConfig;
const life = (c: IAuthConfig) => ({ idle: c.sessionDuration, cap: c.sessionMaxAge });

test('presets per platform when nothing is configured; an undeclared client keeps the library defaults', () => {
	assert.deepEqual(life(configForClient(base, {}, 'mobile')), { idle: '90d', cap: '365d' });
	assert.deepEqual(life(configForClient(base, {}, 'desktop')), { idle: '30d', cap: '180d' });
	assert.deepEqual(life(configForClient(base, {}, 'web')), { idle: '14d', cap: '90d' });
	assert.deepEqual(life(configForClient(base, {}, null)), { idle: undefined, cap: undefined }, 'issueTokenPair applies 90d / no cap');
	assert.equal(SESSION_POLICY_PRESETS.web.sessionDuration, '14d');
});

test('a console SHARED value overrides every platform (one setting for all)', () => {
	const runtime = { sessionDuration: '30d', sessionMaxAge: '120d' };
	for (const kind of ['mobile', 'desktop', 'web', null] as const) {
		assert.deepEqual(life(configForClient(base, runtime, kind)), { idle: '30d', cap: '120d' }, String(kind));
	}
});

test('a console per-platform value beats the console shared one, for that platform only', () => {
	const runtime = { sessionDuration: '30d', sessionPolicies: { web: { sessionDuration: '7d' } } };
	assert.equal(configForClient(base, runtime, 'web').sessionDuration, '7d');
	assert.equal(configForClient(base, runtime, 'mobile').sessionDuration, '30d');
});

test("the app's code: per-platform beats its shared value, and both beat the presets — the console beats both", () => {
	const code = { ...base, sessionDuration: '45d', sessionPolicies: { mobile: { sessionDuration: '180d' } } } as IAuthConfig;
	assert.equal(configForClient(code, {}, 'mobile').sessionDuration, '180d');
	assert.equal(configForClient(code, {}, 'web').sessionDuration, '45d', 'code shared beats the web preset');
	assert.equal(configForClient(code, { sessionDuration: '10d' }, 'mobile').sessionDuration, '10d', 'console shared beats code');
});

test('clientKindOf: the declared platform, case-insensitive; anything else is undeclared', () => {
	const h = (v?: string) => new Headers(v ? { 'x-client-kind': v } : {});
	assert.equal(clientKindOf(h('mobile')), 'mobile');
	assert.equal(clientKindOf(h(' Web ')), 'web');
	assert.equal(clientKindOf(h('tablet')), null);
	assert.equal(clientKindOf(h()), null);
});

test('readAuthRuntimeConfig: unset keys are ABSENT (never the text "undefined"); values and per-platform keys are read', () => {
	assert.deepEqual(readAuthRuntimeConfig(() => undefined), {}, 'nothing set → nothing');
	const store: Record<string, unknown> = {
		'auth.session.duration': '60d',
		'auth.session.max_age.web': '30d',
		'auth.mfa.enabled': 'true',
		'auth.verification.cooldown': '300',
		'auth.session.duration.mobile': '   ',
	};
	const out = readAuthRuntimeConfig((k) => store[k]);
	assert.deepEqual(out, {
		sessionDuration: '60d',
		mfa: true,
		verificationCooldown: 300,
		sessionPolicies: { web: { sessionMaxAge: '30d' } },
	});
});
