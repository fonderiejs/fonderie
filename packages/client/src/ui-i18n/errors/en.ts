// What a screen says when the server refuses, by the server's reason code
// (FonderieApiError.reason). `{name}` values come from the error's `details`;
// a message whose values are missing is not used (localizeApiError falls back
// to the generic message for the status). English readers get the server's
// own sentence; these are for every other language — English is canonical
// here so the other languages can be typed against it.
const errors = {
	generic: {
		validation: 'Some of the information you entered is not valid. Please check it and try again.',
		badRequest: "That request couldn't be completed. Please check and try again.",
		unauthorized: 'Your session has ended. Please sign in again.',
		forbidden: "You don't have permission to do that.",
		notFound: "We couldn't find what you were looking for.",
		conflict: 'That conflicts with something that already exists.',
		paymentRequired: 'Your current plan does not include this.',
		tooMany: 'Too many attempts. Please wait a moment and try again.',
		tooLarge: 'That is too large to upload.',
		server: 'Something went wrong on our side. Please try again in a moment.',
		unavailable: 'This is not available right now.',
		network: "We couldn't reach the server. Check your connection and try again.",
	},
	reasons: {
		// Sign-in and account
		INVALID_CREDENTIALS: 'The email or password is incorrect.',
		ACCOUNT_SUSPENDED: 'This account is suspended. Please contact support.',
		USER_ALREADY_EXISTS: 'An account with this email already exists.',
		EMAIL_IN_USE: 'This email is already in use.',
		PHONE_IN_USE: 'This phone number is already in use.',
		VERIFICATION_FAILED: 'That code is incorrect or has expired.',
		VERIFICATION_COOLDOWN: 'Please wait a moment before requesting a new code.',
		PASSWORD_RESET_FAILED: 'That reset code is incorrect or has expired.',
		INVALID_CODE: 'That code is incorrect. Please try again.',
		INVALID_CREDENTIAL: 'Your current password is incorrect.',
		MFA_REQUIRED: 'Please complete two-factor verification to continue.',
		MFA_NOT_ENABLED: 'Two-factor authentication is not turned on.',
		EMAIL_NOT_VERIFIED: 'Please verify your email address first.',
		PHONE_NOT_VERIFIED: 'Please verify your phone number first.',
		NO_EMAIL_ON_ACCOUNT: 'There is no email address on this account.',
		NO_PHONE_ON_ACCOUNT: 'There is no phone number on this account.',
		PASSWORD_REQUIRED: 'Set a password before removing this sign-in method — it is currently your only one.',
		EMAIL_LOGIN_REQUIRED: 'Please sign in with your email and password to do this.',
		GOOGLE_AUTH_FAILED: "Signing in with Google didn't work. Please try again.",
		APPLE_AUTH_FAILED: "Signing in with Apple didn't work. Please try again.",
		NOT_LINKED: 'That sign-in method is not connected to your account.',
		// Teams
		SEAT_LIMIT_REACHED: "Your plan's member limit ({limit}) has been reached. Upgrade to invite more.",
		INVALID_ROLE: "That role can't be given in this workspace.",
		INVITATION_NOT_FOUND: 'This invitation no longer exists.',
		INVITATION_FAILED: "This invitation can't be accepted. It may have expired or been used already.",
		MEMBER_NOT_FOUND: 'That person is not a member of this workspace.',
		OWNER_CANNOT_LEAVE: 'Transfer ownership to another member before leaving.',
		OWNER_REQUIRED: 'Only the workspace owner can do this.',
		MANAGER_REQUIRED: 'Only the owner or an admin can do this.',
		// Billing
		PLAN_UNCHANGED: "You're already on the {plan} plan.",
		SUBSCRIPTION_PAST_DUE: 'There is an unpaid balance on your current plan. Please resolve it before changing plans.',
		SUBSCRIPTION_PAUSED: 'Your {currentPlan} plan is paused. Resume it before changing plans.',
		SUBSCRIPTION_SCHEDULED_TO_CANCEL: 'Your {currentPlan} plan is set to end. Reactivate it before changing plans.',
		PLAN_CHANGE_REQUIRES_CANCEL: 'To move to {targetPlan}, cancel your {currentPlan} plan first — you keep access until it ends — then subscribe to {targetPlan}.',
		SUBSCRIPTION_CANCELED: 'A canceled subscription cannot be reactivated. Please subscribe again.',
		SUBSCRIPTION_INACTIVE: 'Your subscription is not active.',
		PLAN_UPGRADE_REQUIRED: 'Upgrade your plan to use this.',
		FEATURE_UNAVAILABLE: 'This feature is not included in your current plan.',
		RATE_LIMIT_EXCEEDED: "You've reached your limit for this period ({used} of {limit}).",
		INSUFFICIENT_CREDITS: "You don't have enough credits for this.",
		PACKS_BLOCKED: 'Credit packs are not available on your plan — it already includes its credits.',
		NO_CUSTOMER: "Your card setup didn't start. Please try adding your card again.",
		INVALID_PAYMENT_METHOD: "That card couldn't be saved.",
		// Customers
		DUPLICATE_EMAIL: 'This email is already on this customer.',
		DUPLICATE_PHONE: 'This phone number is already on this customer.',
		DUPLICATE_ADDRESS: 'This address is already on this customer.',
		DUPLICATE_REFERENCE_CODE: 'Another customer already uses this reference code.',
		CUSTOMER_IN_USE: 'This customer is on a job, quote or invoice. Archive them instead.',
		EMAIL_NOT_FOUND: 'That email is not on this customer.',
		PHONE_NOT_FOUND: 'That phone number is not on this customer.',
		ADDRESS_NOT_FOUND: 'That address is not on this customer.',
		RELATIONSHIP_NOT_FOUND: 'That relationship does not exist.',
		LABEL_IN_USE: "This label can't be deleted.",
		// Uploads
		ASSET_TOO_LARGE: 'This image is too large (the limit is {maxMegabytes} MB).',
		ASSET_UNSUPPORTED: "This image type isn't supported. Use {allowed}.",
		ASSET_NOT_FOUND: 'That image no longer exists.',
		PAYLOAD_TOO_LARGE: 'That is too large to send.',
	},
};

export default errors;
