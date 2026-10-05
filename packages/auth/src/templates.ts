import type { IDefaultTemplate } from '@fonderie/core';
import { withTranslations } from '@fonderie/core';

import { MESSAGE_KEYS, type AuthMessageKey } from './config';
import { ES_TEMPLATES } from './templates.es';
import { FR_TEMPLATES } from './templates.fr';
import { ZH_HANS_TEMPLATES } from './templates.zh-Hans';
import { ZH_HANT_TEMPLATES } from './templates.zh-Hant';

// Built-in default copy for every @fonderie/auth notification, shipped so the
// emails render out of the box — no per-app template authoring, and never the
// raw-JSON fallback. `html` values are BODY FRAGMENTS: courier injects them into
// its branded layout shell (an app rebrands via its own `_layout`), then
// interpolates {{vars}}. An app overrides any single key by shipping its own
// template (DB row / FS file) for that key.
//
// The `satisfies Record<AuthMessageKey, IDefaultTemplate>` is the completeness
// guarantee: add a key to MESSAGE_KEYS without a default here and it will not
// compile. `phone-otp` is SMS — text only, no subject/html.
const EN_TEMPLATES = {
	[MESSAGE_KEYS.emailRegistration]: {
		subject: 'Confirm your account',
		html: `<h1>Welcome aboard</h1>
<p>Hi {{firstName}},</p>
<p>Thanks for signing up. Confirm your account with this code:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.</p>`,
		text: `Welcome aboard

Hi {{firstName}},

Thanks for signing up. Confirm your account with this code: {{pin}}

This code expires in 24 hours. If you didn't create an account, you can safely ignore this email.`,
	},

	[MESSAGE_KEYS.emailVerification]: {
		subject: 'Your verification code',
		html: `<h1>Verify your email</h1>
<p>Hi {{firstName}},</p>
<p>Use this code to finish setting up your account:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.</p>`,
		text: `Verify your email

Hi {{firstName}},

Use this code to finish setting up your account: {{pin}}

This code expires in 24 hours. If you didn't create an account, you can safely ignore this email.`,
	},

	[MESSAGE_KEYS.passwordReset]: {
		subject: 'Reset your password',
		html: `<h1>Reset your password</h1>
<p>We received a request to reset your password. Use this code to continue:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires soon. If you didn&rsquo;t request a reset, no action is needed &mdash; your password stays the same.</p>`,
		text: `Reset your password

We received a request to reset your password. Use this code to continue: {{pin}}

This code expires soon. If you didn't request a reset, no action is needed — your password stays the same.`,
	},

	// SMS — text only, no subject/html.
	[MESSAGE_KEYS.phoneOtp]: {
		text: '{{otp}} is your verification code. It expires in 10 minutes.',
	},

	[MESSAGE_KEYS.mfaEnabled]: {
		subject: 'Two-factor authentication is on',
		html: `<h1>Two-factor authentication enabled</h1>
<p>Two-factor authentication was just turned on for your account. From now on you&rsquo;ll enter a code from your authenticator app when you sign in.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away &mdash; someone may have access to your account.</p>`,
		text: `Two-factor authentication enabled

Two-factor authentication was just turned on for your account. From now on you'll enter a code from your authenticator app when you sign in.

If you didn't do this, contact support right away — someone may have access to your account.`,
	},

	[MESSAGE_KEYS.mfaDisabled]: {
		subject: 'Two-factor authentication is off',
		html: `<h1>Two-factor authentication disabled</h1>
<p>Two-factor authentication was just turned off for your account. Your account is now protected by your password alone.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away and re-enable two-factor authentication &mdash; someone may have access to your account.</p>`,
		text: `Two-factor authentication disabled

Two-factor authentication was just turned off for your account. Your account is now protected by your password alone.

If you didn't do this, contact support right away and re-enable two-factor authentication — someone may have access to your account.`,
	},

	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {
		subject: 'Your backup codes were regenerated',
		html: `<h1>New backup codes generated</h1>
<p>A new set of two-factor backup codes was just generated for your account. Your previous backup codes no longer work.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away &mdash; someone may have access to your account.</p>`,
		text: `New backup codes generated

A new set of two-factor backup codes was just generated for your account. Your previous backup codes no longer work.

If you didn't do this, contact support right away — someone may have access to your account.`,
	},

	[MESSAGE_KEYS.emailChanged]: {
		subject: 'Your email address was changed',
		html: `<h1>Your email was changed</h1>
<p>The email address on your account was just changed to <strong>{{newEmail}}</strong>.</p>
<p class="muted">If you made this change, you&rsquo;re all set. If not, contact support right away &mdash; someone may have access to your account.</p>`,
		text: `Your email was changed

The email address on your account was just changed to {{newEmail}}.

If you made this change, you're all set. If not, contact support right away — someone may have access to your account.`,
	},

	[MESSAGE_KEYS.phoneChanged]: {
		subject: 'Your phone number was changed',
		html: `<h1>Your phone number was changed</h1>
<p>The phone number on your account was just updated.</p>
<p class="muted">If you made this change, you&rsquo;re all set. If not, contact support right away &mdash; someone may have access to your account.</p>`,
		text: `Your phone number was changed

The phone number on your account was just updated.

If you made this change, you're all set. If not, contact support right away — someone may have access to your account.`,
	},

	[MESSAGE_KEYS.passwordRevoked]: {
		subject: 'The password on your account was removed',
		html: `<h1>Your password was removed</h1>
<p>You just signed in with <strong>{{provider}}</strong>. A password had been set on this account, but this email address had never been confirmed &mdash; so we could not tell who set it, and it has been removed.</p>
<p>Signing in with {{provider}} works as before. If you want a password as well, set one from your account settings.</p>
<p class="muted">If you never set a password here, someone else may have tried to register with your address. Nothing further is needed &mdash; the account is yours.</p>`,
		text: `Your password was removed

You just signed in with {{provider}}. A password had been set on this account,
but this email address had never been confirmed — so we could not tell who set
it, and it has been removed.

Signing in with {{provider}} works as before. If you want a password as well,
set one from your account settings.

If you never set a password here, someone else may have tried to register with
your address. Nothing further is needed — the account is yours.`,
	},

	[MESSAGE_KEYS.oauthRegistration]: {
		subject: 'Welcome to {{appName}}',
		html: `<h1>Welcome to {{appName}}</h1>
<p>Your account was created using <strong>{{provider}}</strong>. Sign in any time with the same {{provider}} account &mdash; there is no password to remember.</p>
<p class="muted">If you did not create this account, contact support.</p>`,
		text: `Welcome

Your account was created using {{provider}}. Sign in any time with the same
{{provider}} account — there is no password to remember.

If you did not create this account, contact support.`,
	},

	[MESSAGE_KEYS.oauthLinked]: {
		subject: 'A new sign-in method was added to your account',
		html: `<h1>{{provider}} sign-in was added</h1>
<p>Your account can now also be signed into with <strong>{{provider}}</strong>.</p>
<p class="muted">If you did this, nothing more is needed. If not, contact support right away and change your password &mdash; someone else may be able to sign in as you.</p>`,
		text: `{{provider}} sign-in was added

Your account can now also be signed into with {{provider}}.

If you did this, nothing more is needed. If not, contact support right away and
change your password — someone else may be able to sign in as you.`,
	},

	[MESSAGE_KEYS.oauthUnlinked]: {
		subject: 'A sign-in method was removed from your account',
		html: `<h1>{{provider}} sign-in was removed</h1>
<p><strong>{{provider}}</strong> can no longer be used to sign in. Your email and password still work.</p>
<p class="muted">If you did this, you&rsquo;re all set. If not, contact support right away.</p>`,
		text: `{{provider}} sign-in was removed

{{provider}} can no longer be used to sign in. Your email and password still work.

If you did this, you're all set. If not, contact support right away.`,
	},

	[MESSAGE_KEYS.stepUpCode]: {
		subject: `Your confirmation code`,
		html: `<h1>Confirm it's you</h1>
<p>Someone signed in to your account wants to make an important change (for example hand over a team or end a plan at once). Use this code to confirm it's you:</p>
<p><span class="pin-code">{{code}}</span></p>
<p class="muted">This code expires in 10 minutes. If you didn&rsquo;t ask for this, don&rsquo;t share it &mdash; and change your password.</p>`,
		text: `Your code to confirm it's you: {{code}}. It expires in 10 minutes. Didn't ask? Don't share it, and change your password.`,
	},

	[MESSAGE_KEYS.accountDeletionCode]: {
		subject: `Confirm your account deletion`,
		html: `<h1>Confirm account deletion</h1>
<p>Use this code to confirm that you want to delete your account:</p>
<p><span class="pin-code">{{code}}</span></p>
<p class="muted">This code expires in 15 minutes. If you didn&rsquo;t ask to delete your account, ignore this message and change your password &mdash; your account stays as it is.</p>`,
		text: `Your code to confirm deleting your account: {{code}}. It expires in 15 minutes. Didn't ask? Ignore this and change your password.`,
	},

	[MESSAGE_KEYS.accountDeletionScheduled]: {
		subject: `Your account will be deleted on {{deleteOn}}`,
		html: `<h1>Your account is scheduled for deletion</h1>
<p>We received your request. Your account is closed and will be permanently deleted on <strong>{{deleteOn}}</strong>.</p>
<p>Changed your mind? Sign in before that date and choose <strong>Keep my account</strong>.</p>
<p class="muted">If you didn&rsquo;t ask for this, sign in now to keep your account and change your password.</p>`,
		text: `Your account will be permanently deleted on {{deleteOn}}. Changed your mind? Sign in before then and choose Keep my account.`,
	},

	[MESSAGE_KEYS.accountRestored]: {
		subject: `Your account was restored`,
		html: `<h1>Welcome back</h1>
<p>Your account deletion was cancelled and your account is active again.</p>
<p class="muted">If you didn&rsquo;t do this, change your password right away.</p>`,
		text: `Your account deletion was cancelled; your account is active again. Didn't do this? Change your password now.`,
	},

	[MESSAGE_KEYS.accountDeletionReminder]: {
		subject: `Your account will be deleted on {{deleteOn}}`,
		html: `<h1>Your account will be deleted soon</h1>
<p>As you asked, your account is closed and will be permanently deleted on <strong>{{deleteOn}}</strong>. After that date it cannot be recovered.</p>
<p>Changed your mind? Sign in before then and choose <strong>Keep my account</strong>.</p>
<p class="muted">No action is needed if you still want it deleted.</p>`,
		text: `Reminder: your account will be permanently deleted on {{deleteOn}}. Changed your mind? Sign in before then and choose Keep my account.`,
	},
} satisfies Record<AuthMessageKey, IDefaultTemplate>;

// The English above, with every email's French, Spanish and Chinese (Simplified
// and Traditional) attached. Courier
// sends the one matching the recipient's language (an app's own saved version
// still wins); anything else gets the English.
export const DEFAULT_TEMPLATES = withTranslations(EN_TEMPLATES, {
	fr: FR_TEMPLATES,
	es: ES_TEMPLATES,
	'zh-Hans': ZH_HANS_TEMPLATES,
	'zh-Hant': ZH_HANT_TEMPLATES,
});

// Representative payloads for the coverage test: every {{var}} a default uses
// must appear here. Security-notice keys carry no variables ({}). The
// registration sample uses an empty firstName to prove the blank-name path
// renders cleanly (the emitter may pass firstName: '').
export const SAMPLE_PAYLOADS: Record<AuthMessageKey, Record<string, unknown>> = {
	[MESSAGE_KEYS.passwordRevoked]: { provider: 'Google' },
	[MESSAGE_KEYS.oauthRegistration]: { provider: 'Google', appName: 'Fonderie' },
	[MESSAGE_KEYS.oauthLinked]: { provider: 'Google' },
	[MESSAGE_KEYS.oauthUnlinked]: { provider: 'Google' },
	[MESSAGE_KEYS.emailRegistration]: { firstName: '', pin: '123456' },
	[MESSAGE_KEYS.emailVerification]: { firstName: 'Ada', pin: '123456' },
	[MESSAGE_KEYS.passwordReset]: {
		pin: '123456',
		token: '0'.repeat(64),
		resetUrl: 'https://app.example.com/reset?token=' + '0'.repeat(64),
	},
	[MESSAGE_KEYS.phoneOtp]: { otp: '123456' },
	[MESSAGE_KEYS.mfaEnabled]: {},
	[MESSAGE_KEYS.mfaDisabled]: {},
	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {},
	[MESSAGE_KEYS.emailChanged]: { newEmail: 'new@example.com' },
	[MESSAGE_KEYS.phoneChanged]: {},
	[MESSAGE_KEYS.stepUpCode]: { code: '123456' },
	[MESSAGE_KEYS.accountDeletionCode]: { code: '123456' },
	[MESSAGE_KEYS.accountDeletionScheduled]: { deleteOn: 'November 3, 2026' },
	[MESSAGE_KEYS.accountRestored]: {},
	[MESSAGE_KEYS.accountDeletionReminder]: { deleteOn: 'November 3, 2026' },
};
