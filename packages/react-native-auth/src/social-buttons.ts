/**
 * Which social sign-in buttons a native screen should render.
 *
 * Two independent facts decide this, and using either alone is a bug:
 *
 *   the SERVER   — does this deployment hold credentials for the provider?
 *   the PLATFORM — can this device present the provider at all?
 *
 * Server alone shows an Apple button on Android, where it cannot run. Platform
 * alone ("it's iOS, always show Apple") shows a button that opens the Apple
 * sheet, takes the user through Face ID, and only then fails — because
 * POST /auth/apple/native answers 501 when the API has no apple config. A
 * button that fails after the user commits is worse than one that never
 * appeared.
 *
 * Pure on purpose: the caller passes `isIOS` (from react-native's `Platform`,
 * Expo, or a test), so this package needs no react-native dependency and the
 * rule stays unit-testable.
 */
export interface ISocialButtons {
	/** Render Sign in with Apple. */
	apple: boolean;
	/**
	 * Render Sign in with Google.
	 *
	 * On iOS this is suppressed when Apple is unavailable — see
	 * `enforceAppleGuideline`. Offering a third-party login without Apple is
	 * what Guideline 4.8 forbids, so the compliant build is the one that offers
	 * neither, not the one that offers Google and hopes.
	 */
	google: boolean;
	/**
	 * True when this iOS build would offer a third-party login with NO Apple
	 * option. App Store Review Guideline 4.8 requires Apple to be offered
	 * alongside other social logins, so this is a rejection risk — and it is a
	 * misconfigured BACKEND, not something the app should paper over by showing
	 * an Apple button that cannot work. Surface it in development.
	 */
	appleGuidelineRisk: boolean;
}

export function resolveSocialButtons(
	providers: readonly string[],
	options: {
		isIOS: boolean;
		/**
		 * On iOS, suppress OTHER social logins when Apple is unavailable.
		 * Default true, because it makes the shipped build compliant by
		 * construction: Guideline 4.8 requires Sign in with Apple alongside
		 * third-party logins, so offering neither is allowed and offering
		 * Google alone is not.
		 *
		 * Set false only if you have a reason to ship the rejectable shape —
		 * an internal build, or a review exemption. `appleGuidelineRisk` still
		 * reports the situation either way.
		 */
		enforceAppleGuideline?: boolean;
	},
): ISocialButtons {
	const serverHasApple = providers.includes('apple');
	const serverHasGoogle = providers.includes('google');
	const enforce = options.enforceAppleGuideline ?? true;

	// The risk is a property of the CONFIGURATION, so it is reported whether or
	// not we act on it — suppressing the button fixes the build, not the cause.
	const appleGuidelineRisk = options.isIOS && serverHasGoogle && !serverHasApple;

	return {
		apple: options.isIOS && serverHasApple,
		google: serverHasGoogle && !(enforce && appleGuidelineRisk),
		appleGuidelineRisk,
	};
}
