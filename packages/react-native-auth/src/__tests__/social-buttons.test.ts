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

test('google follows the server on Android, and the guideline on iOS', () => {
	// Android: the guideline does not apply, so the server decides alone.
	assert.equal(resolveSocialButtons(['email', 'google'], android).google, true);
	assert.equal(resolveSocialButtons(['email'], ios).google, false);

	// iOS with apple configured: both offered, which is the compliant shape.
	assert.equal(resolveSocialButtons(['email', 'google', 'apple'], ios).google, true);
});

test('iOS: offering google without apple is SUPPRESSED, not merely warned about', () => {
	// "if we offer google we must offer apple" — so when apple is unavailable
	// the compliant build offers neither. Shipping google alone with a console
	// warning is shipping a rejectable binary.
	const r = resolveSocialButtons(['email', 'google'], ios);
	assert.equal(r.google, false, 'google must not render on iOS without apple');
	assert.equal(r.apple, false);
	assert.equal(r.appleGuidelineRisk, true, 'the cause must still be reported');

	// Android is unaffected — same server config, google still renders.
	assert.equal(resolveSocialButtons(['email', 'google'], android).google, true);
});

test('the enforcement is escapable, deliberately', () => {
	// An internal build or a review exemption may want the raw shape. The risk
	// flag is unchanged: suppressing a button fixes the binary, not the config.
	const r = resolveSocialButtons(['email', 'google'], { isIOS: true, enforceAppleGuideline: false });
	assert.equal(r.google, true);
	assert.equal(r.appleGuidelineRisk, true);
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
