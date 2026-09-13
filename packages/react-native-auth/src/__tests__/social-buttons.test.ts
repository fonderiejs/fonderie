import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSocialButtons } from '../social-buttons';

const ios = { isIOS: true };
const android = { isIOS: false };

test('apple needs BOTH the platform and the server — never one alone', () => {
	// "It's iOS, always show Apple" is the tempting shortcut. It shows a button
	// that opens the Apple sheet, takes the user through Face ID, and THEN
	// fails on a 501, because the API has no apple config.
	assert.equal(resolveSocialButtons(['email', 'google'], ios).apple, false);

	// Server says apple, but this is Android — the provider cannot run here.
	assert.equal(resolveSocialButtons(['email', 'apple'], android).apple, false);

	// Both true is the only case that renders.
	assert.equal(resolveSocialButtons(['email', 'apple'], ios).apple, true);
});

test('google follows the server alone — it runs on either platform', () => {
	assert.equal(resolveSocialButtons(['email', 'google'], ios).google, true);
	assert.equal(resolveSocialButtons(['email', 'google'], android).google, true);
	assert.equal(resolveSocialButtons(['email'], ios).google, false);
});

test('flags the Guideline 4.8 risk: iOS offering google with no apple', () => {
	// This is a misconfigured BACKEND surfacing in the app. Apple requires
	// Sign in with Apple alongside other social logins, so this build is a
	// rejection risk — and hiding it behind an always-on Apple button would
	// trade a visible warning for an invisible broken flow.
	assert.equal(resolveSocialButtons(['email', 'google'], ios).appleGuidelineRisk, true);

	// Not a risk once apple is configured…
	assert.equal(resolveSocialButtons(['email', 'google', 'apple'], ios).appleGuidelineRisk, false);
	// …nor with no third-party login at all…
	assert.equal(resolveSocialButtons(['email'], ios).appleGuidelineRisk, false);
	// …nor on Android, where the guideline does not apply.
	assert.equal(resolveSocialButtons(['email', 'google'], android).appleGuidelineRisk, false);
});

test('an empty provider list renders nothing — the safe default', () => {
	// useAuthProviders starts empty and falls back to empty on error, so this
	// is what a screen sees while loading or when the API is unreachable.
	assert.deepEqual(resolveSocialButtons([], ios), {
		apple: false,
		google: false,
		appleGuidelineRisk: false,
	});
});
