// The prebuilt billing screens' words (React, React Native and Vue share them).
// English is canonical: the other languages are typed against this shape, so
// a missing or extra key is a compile error. `{name}` placeholders are
// interpolated. Prices and dates are formatted by Intl in the UI language.
const billing = {
	pricing: {
		loading: 'Loading plans…',
		monthly: 'Monthly',
		yearly: 'Yearly',
		perMonth: '/month',
		perYear: '/year',
		choose: 'Choose {plan}',
		redirecting: 'Redirecting…',
	},
	subscription: {
		loading: 'Loading subscription…',
		none: "You don't have an active subscription.",
		viewPlans: 'View plans',
		title: 'Your subscription',
		statusLine: 'Status: {status}',
		statusLineCanceling: 'Status: {status} (cancels at period end)',
		renews: 'Renews {date}',
		// When the subscription is set to cancel: access ends then, nothing renews.
		ends: 'Ends {date}',
		manage: 'Manage billing',
		opening: 'Opening…',
	},
	paymentMethod: {
		title: 'Payment method',
		loading: 'Loading payment method…',
		link: 'Link',
		linkWithEmail: 'Link · {email}',
		card: '{brand} •••• {last4} · expires {month}/{year}',
		none: 'No card on file.',
		add: 'Add card',
		update: 'Update card',
		remove: 'Remove',
		removing: 'Removing…',
	},
	// Subscription states as the server reports them (Stripe's vocabulary); an
	// unknown state is shown as-is.
	status: {
		active: 'active',
		trialing: 'trialing',
		past_due: 'past due',
		unpaid: 'unpaid',
		canceled: 'canceled',
		incomplete: 'incomplete',
		incomplete_expired: 'incomplete (expired)',
		paused: 'paused',
	},
};

export default billing;
