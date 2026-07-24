-- Seed default email templates.
--
-- Each `html` here is a BODY FRAGMENT, not a full document — the courier
-- resolver injects it into the shared branded layout shell (see
-- templates/layout.ts) and interpolates {{variables}}. Friendly classes
-- (.pin-code, .btn, .muted, h1, p) are styled by the shell's <head>.
--
-- Idempotent: a temp helper upserts the NULL-locale row (ON CONFLICT does not
-- fire for NULL columns in standard Postgres unique indexes), then is dropped.

CREATE OR REPLACE FUNCTION pg_temp._seed_courier_template(
	p_type    text,
	p_subject text,
	p_html    text,
	p_text    text
) RETURNS void AS $fn$
BEGIN
	IF EXISTS (
		SELECT 1 FROM fonderie_courier_templates
		WHERE type = p_type AND locale IS NULL
	) THEN
		UPDATE fonderie_courier_templates
		SET subject = p_subject, html = p_html, text = p_text, updated_at = now()
		WHERE type = p_type AND locale IS NULL;
	ELSE
		INSERT INTO fonderie_courier_templates (type, locale, subject, html, text)
		VALUES (p_type, NULL, p_subject, p_html, p_text);
	END IF;
END;
$fn$ LANGUAGE plpgsql;

-- email-verification — variables: firstName, pin
SELECT pg_temp._seed_courier_template(
	'email-verification',
	'Your verification code',
	'<h1>Verify your email</h1>
<p>Hi {{firstName}},</p>
<p>Use this code to finish setting up your account:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.</p>',
	'Verify your email

Hi {{firstName}},

Use this code to finish setting up your account: {{pin}}

This code expires in 24 hours. If you didn''t create an account, you can safely ignore this email.'
);

-- password-reset — variables: pin
SELECT pg_temp._seed_courier_template(
	'password-reset',
	'Reset your password',
	'<h1>Reset your password</h1>
<p>We received a request to reset your password. Use this code to continue:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires soon. If you didn&rsquo;t request a reset, no action is needed &mdash; your password stays the same.</p>',
	'Reset your password

We received a request to reset your password. Use this code to continue: {{pin}}

This code expires soon. If you didn''t request a reset, no action is needed — your password stays the same.'
);

-- workspace-invitation — variables: pin, token
SELECT pg_temp._seed_courier_template(
	'workspace-invitation',
	'You''ve been invited to a workspace',
	'<h1>You&rsquo;ve been invited</h1>
<p>You&rsquo;ve been invited to join a workspace. Use this code to accept the invitation:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Enter this code on the invitation screen to join the team.</p>',
	'You''ve been invited

You''ve been invited to join a workspace. Use this code to accept the invitation: {{pin}}

Enter this code on the invitation screen to join the team.'
);

-- email-changed — variables: newEmail (sent to the previous address)
SELECT pg_temp._seed_courier_template(
	'email-changed',
	'Your email address was changed',
	'<h1>Your email was changed</h1>
<p>The email address on your account was just changed to <strong>{{newEmail}}</strong>.</p>
<p class="muted">If you made this change, you&rsquo;re all set. If not, contact support right away &mdash; someone may have access to your account.</p>',
	'Your email was changed

The email address on your account was just changed to {{newEmail}}.

If you made this change, you''re all set. If not, contact support right away — someone may have access to your account.'
);

-- email-registration — variables: firstName, pin
-- The first email a new account receives (initial signup). Distinct from
-- email-verification, which covers the resend / email-change paths.
SELECT pg_temp._seed_courier_template(
	'email-registration',
	'Confirm your account',
	'<h1>Welcome aboard</h1>
<p>Hi {{firstName}},</p>
<p>Thanks for signing up. Confirm your account with this code:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">This code expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.</p>',
	'Welcome aboard

Hi {{firstName}},

Thanks for signing up. Confirm your account with this code: {{pin}}

This code expires in 24 hours. If you didn''t create an account, you can safely ignore this email.'
);

-- phone-otp — variables: otp — SMS channel (text only, no subject/html)
SELECT pg_temp._seed_courier_template(
	'phone-otp',
	NULL,
	NULL,
	'{{otp}} is your verification code. It expires in 10 minutes.'
);

-- mfa-enabled — no variables — security notice
SELECT pg_temp._seed_courier_template(
	'mfa-enabled',
	'Two-factor authentication is on',
	'<h1>Two-factor authentication enabled</h1>
<p>Two-factor authentication was just turned on for your account. From now on you&rsquo;ll enter a code from your authenticator app when you sign in.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away &mdash; someone may have access to your account.</p>',
	'Two-factor authentication enabled

Two-factor authentication was just turned on for your account. From now on you''ll enter a code from your authenticator app when you sign in.

If you didn''t do this, contact support right away — someone may have access to your account.'
);

-- mfa-disabled — no variables — security notice
SELECT pg_temp._seed_courier_template(
	'mfa-disabled',
	'Two-factor authentication is off',
	'<h1>Two-factor authentication disabled</h1>
<p>Two-factor authentication was just turned off for your account. Your account is now protected by your password alone.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away and re-enable two-factor authentication &mdash; someone may have access to your account.</p>',
	'Two-factor authentication disabled

Two-factor authentication was just turned off for your account. Your account is now protected by your password alone.

If you didn''t do this, contact support right away and re-enable two-factor authentication — someone may have access to your account.'
);

-- mfa-backup-codes-regenerated — no variables — security notice
SELECT pg_temp._seed_courier_template(
	'mfa-backup-codes-regenerated',
	'Your backup codes were regenerated',
	'<h1>New backup codes generated</h1>
<p>A new set of two-factor backup codes was just generated for your account. Your previous backup codes no longer work.</p>
<p class="muted">If you didn&rsquo;t do this, contact support right away &mdash; someone may have access to your account.</p>',
	'New backup codes generated

A new set of two-factor backup codes was just generated for your account. Your previous backup codes no longer work.

If you didn''t do this, contact support right away — someone may have access to your account.'
);

-- phone-changed — no variables — security notice (sent to the account email)
SELECT pg_temp._seed_courier_template(
	'phone-changed',
	'Your phone number was changed',
	'<h1>Your phone number was changed</h1>
<p>The phone number on your account was just updated.</p>
<p class="muted">If you made this change, you&rsquo;re all set. If not, contact support right away &mdash; someone may have access to your account.</p>',
	'Your phone number was changed

The phone number on your account was just updated.

If you made this change, you''re all set. If not, contact support right away — someone may have access to your account.'
);
