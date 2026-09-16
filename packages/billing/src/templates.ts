import type { IDefaultTemplate } from '@fonderie/core';

import { MESSAGE_KEYS, type BillingMessageKey } from './config';

// Built-in default copy for every @fonderie/billing notification, shipped so the
// emails render out of the box — never the raw-JSON fallback. `html` values are
// BODY FRAGMENTS injected into courier's branded layout shell; {{vars}}
// interpolate. Copy is deliberately brand-neutral and uses "balance"
// terminology (works for a money-denominated OR a credit-count wallet); an app
// overrides any key with its own DB row / FS file for its voice.
//
// Money/date values render through pre-formatted `*Display` fields the billing
// emitters compute (courier's render() can't format) — see formatWalletAmount.
// Raw provider ids, enums, and un-formatted amounts are intentionally NOT
// surfaced in the copy; where an exact figure matters (renewal/pack/refund) the
// copy points to the billing portal / invoice instead.
//
// `satisfies Record<BillingMessageKey, IDefaultTemplate>` makes a missing key a
// compile error.
export const DEFAULT_TEMPLATES = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		subject: 'Your subscription has been canceled',
		html: `<h1>Your subscription has been canceled</h1>
<p>Your subscription to the <strong>{{plan}}</strong> plan has been canceled.</p>
<p>You'll keep your paid features until the end of the current billing period, after which your account moves to the free plan. Your data stays intact.</p>
<p class="muted">Changed your mind? You can resubscribe any time from your billing settings.</p>`,
		text: `Your subscription has been canceled

Your subscription to the {{plan}} plan has been canceled.

You'll keep your paid features until the end of the current billing period, after which your account moves to the free plan. Your data stays intact.

Changed your mind? You can resubscribe any time from your billing settings.`,
	},

	[MESSAGE_KEYS.paymentFailed]: {
		subject: "Your payment didn't go through",
		html: `<h1>Your payment didn't go through</h1>
<p>We couldn't process your most recent payment. This usually means a card expired or was declined.</p>
<p>To keep your paid features, please update your payment method in your billing settings.</p>
<p class="muted">We'll retry automatically over the next few days. If it keeps failing, your account will move to the free plan &mdash; your data is never deleted.</p>`,
		text: `Your payment didn't go through

We couldn't process your most recent payment. This usually means a card expired or was declined.

To keep your paid features, please update your payment method in your billing settings.

We'll retry automatically over the next few days. If it keeps failing, your account will move to the free plan — your data is never deleted.`,
	},

	[MESSAGE_KEYS.trialEnding]: {
		subject: 'Your trial ends soon',
		html: `<h1>Your {{plan}} trial ends soon</h1>
<p>Your free trial of the <strong>{{plan}}</strong> plan ends soon.</p>
<p>To keep your features without interruption, add a payment method in your billing settings before it ends.</p>
<p class="muted">If you do nothing, your account simply moves to the free plan when the trial ends. No charge, and your data stays put.</p>`,
		text: `Your {{plan}} trial ends soon

Your free trial of the {{plan}} plan ends soon.

To keep your features without interruption, add a payment method in your billing settings before it ends.

If you do nothing, your account simply moves to the free plan when the trial ends. No charge, and your data stays put.`,
	},

	[MESSAGE_KEYS.renewalReceipt]: {
		subject: 'Your subscription renewed',
		html: `<h1>Your subscription renewed</h1>
<p>Thanks &mdash; your subscription has renewed for another billing period.</p>
<p>Your itemized receipt (invoice <strong>{{invoiceId}}</strong>) is available any time in your billing settings.</p>
<p class="muted">Nothing to do here; we just wanted to confirm you're all set.</p>`,
		text: `Your subscription renewed

Thanks — your subscription has renewed for another billing period.

Your itemized receipt (invoice {{invoiceId}}) is available any time in your billing settings.

Nothing to do here; we just wanted to confirm you're all set.`,
	},

	[MESSAGE_KEYS.limitWarning]: {
		subject: "You're approaching your {{key}} limit",
		html: `<h1>You're approaching your {{key}} limit</h1>
<p>You've used <strong>{{used}} of {{limit}}</strong> {{key}} on your <strong>{{plan}}</strong> plan.</p>
<p>You're getting close to the limit for this billing period. Upgrading takes a minute and unlocks higher limits.</p>`,
		text: `You're approaching your {{key}} limit

You've used {{used}} of {{limit}} {{key}} on your {{plan}} plan.

You're getting close to the limit for this billing period. Upgrading takes a minute and unlocks higher limits.`,
	},

	[MESSAGE_KEYS.limitReached]: {
		subject: "You've reached your {{key}} limit",
		html: `<h1>You've reached your {{key}} limit</h1>
<p>You've reached your {{key}} limit (<strong>{{used}} of {{limit}}</strong>) on the <strong>{{plan}}</strong> plan for this billing period.</p>
<p>Further usage is blocked until the period resets or you move to a higher plan.</p>`,
		text: `You've reached your {{key}} limit

You've reached your {{key}} limit ({{used}} of {{limit}}) on the {{plan}} plan for this billing period.

Further usage is blocked until the period resets or you move to a higher plan.`,
	},

	[MESSAGE_KEYS.creditsLow]: {
		subject: 'Your balance is running low',
		html: `<h1>Your balance is running low</h1>
<p>Your balance is <strong>{{balanceDisplay}}</strong>, at or below your {{thresholdDisplay}} threshold.</p>
<p>Top up in your billing settings to avoid any interruption.</p>`,
		text: `Your balance is running low

Your balance is {{balanceDisplay}}, at or below your {{thresholdDisplay}} threshold.

Top up in your billing settings to avoid any interruption.`,
	},

	// A receipt, not a balance notification. The distinction matters: a buyer
	// needs the amount PAID, something to cite, and somewhere to get the
	// document. "Credits were added" answers none of those, and is what an
	// accountant will bounce back.
	//
	// `invoiceNumber` / `invoicePdf` are empty when the charge produced no invoice
	// (a direct card charge rather than an invoiced one). The {{#key}} sections are
	// what make those lines disappear — plain interpolation would leave a dangling
	// "Invoice " and an anchor with an empty href, which looks clickable and does
	// nothing.
	[MESSAGE_KEYS.paymentReceipt]: {
		// NB: subject and text are rendered with the message data only — the shell
		// supplies {{brandName}} to the HTML alone, so it must not appear here.
		subject: 'Your receipt',
		html: `<h1>Receipt</h1>
<p style="font-size:28px;font-weight:700;margin:0 0 4px 0;">{{amountPaidDisplay}}</p>
<p class="muted" style="margin:0 0 20px 0;">Paid with card</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:15px;">
	<tr><td style="padding:6px 0;">{{packName}}</td><td align="right" style="padding:6px 0;">{{amountPaidDisplay}}</td></tr>
	<tr><td style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">Total paid</td><td align="right" style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">{{amountPaidDisplay}}</td></tr>
</table>
<p>Your balance is now <strong>{{balanceAfterDisplay}}</strong>.</p>
{{#invoiceNumber}}<p class="muted">Invoice {{invoiceNumber}}</p>{{/invoiceNumber}}
{{#invoicePdf}}<p><a href="{{invoicePdf}}">Download invoice (PDF)</a></p>{{/invoicePdf}}
<p class="muted">Your full billing history is available any time in your billing settings.</p>`,
		text: `Receipt

{{amountPaidDisplay}} paid

{{packName}} ....... {{amountPaidDisplay}}
Total paid ....... {{amountPaidDisplay}}

Your balance is now {{balanceAfterDisplay}}.

{{#invoiceNumber}}Invoice {{invoiceNumber}}{{/invoiceNumber}}
{{#invoicePdf}}Download invoice (PDF): {{invoicePdf}}{{/invoicePdf}}

Your full billing history is available any time in your billing settings.`,
	},

	[MESSAGE_KEYS.refundProcessed]: {
		subject: 'Your refund has been processed',
		html: `<h1>Your refund has been processed</h1>
<p>A refund has been processed. <strong>{{creditsDisplay}}</strong> was reversed from your balance &mdash; your balance is now <strong>{{balanceAfterDisplay}}</strong>.</p>
<p class="muted">The refund to your original payment method may take a few business days to appear.</p>`,
		text: `Your refund has been processed

A refund has been processed. {{creditsDisplay}} was reversed from your balance — your balance is now {{balanceAfterDisplay}}.

The refund to your original payment method may take a few business days to appear.`,
	},

	[MESSAGE_KEYS.autoRechargeFailed]: {
		subject: "Automatic top-up couldn't be completed",
		html: `<h1>Automatic top-up couldn't be completed</h1>
<p>We tried to top up your balance automatically, but the payment couldn't be completed &mdash; usually a card that expired, was declined, or needs confirmation.</p>
<p>Please update your payment method in your billing settings to keep automatic top-ups on.</p>`,
		text: `Automatic top-up couldn't be completed

We tried to top up your balance automatically, but the payment couldn't be completed — usually a card that expired, was declined, or needs confirmation.

Please update your payment method in your billing settings to keep automatic top-ups on.`,
	},
} satisfies Record<BillingMessageKey, IDefaultTemplate>;

// Representative payloads for the coverage test — the full emitted shape per
// key (documents what the emitter sends); templates use a subset. Money/credit
// notices carry the pre-formatted `*Display` fields the emitters compute.
export const SAMPLE_PAYLOADS: Record<BillingMessageKey, Record<string, unknown>> = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		plan: 'Pro',
		status: 'canceled',
		interval: 'month',
		providerSubscriptionId: 'sub_1QexampleX',
	},
	// payment-failed has two payload shapes (pack decline / subscription past_due);
	// the copy uses no variables so it renders for both. Sample = the sub shape.
	[MESSAGE_KEYS.paymentFailed]: {
		plan: 'Pro',
		status: 'past_due',
		interval: 'month',
		providerSubscriptionId: 'sub_1QexampleX',
	},
	[MESSAGE_KEYS.trialEnding]: { plan: 'Starter', trialEndsAt: '2026-09-20T00:00:00.000Z' },
	[MESSAGE_KEYS.renewalReceipt]: { invoiceId: 'in_1QexampleX', amount: '900', currency: 'usd' },
	[MESSAGE_KEYS.limitWarning]: { key: 'jobs', plan: 'Starter', limit: 100, used: 92 },
	[MESSAGE_KEYS.limitReached]: { key: 'jobs', plan: 'Starter', limit: 100, used: 100 },
	[MESSAGE_KEYS.creditsLow]: {
		plan: 'Pro',
		currency: 'USD',
		balance: '300',
		threshold: '1000',
		balanceDisplay: '$3.00',
		thresholdDisplay: '$10.00',
	},
	[MESSAGE_KEYS.paymentReceipt]: {
		packId: 'pack_500',
		credits: '500',
		currency: 'USD',
		balanceAfter: '750',
		creditsDisplay: '500',
		balanceAfterDisplay: '750',
		amountPaid: '900',
		paymentCurrency: 'usd',
		packName: '500 credits',
		amountPaidDisplay: '$9.00',
		invoiceNumber: 'ABCD1234-0001',
		invoiceUrl: 'https://invoice.example.com/i/abc',
		invoicePdf: 'https://invoice.example.com/i/abc.pdf',
		providerTxId: 'pi_1QexampleX',
	},
	[MESSAGE_KEYS.refundProcessed]: {
		packId: 'pack_500',
		credits: '500',
		currency: 'USD',
		balanceAfter: '250',
		creditsDisplay: '500',
		balanceAfterDisplay: '250',
		kind: 'refund',
		refundAmount: '900',
		refundCurrency: 'usd',
	},
	[MESSAGE_KEYS.autoRechargeFailed]: { packId: 'pack_500', status: 'requires_payment_method', disabled: true },
};
