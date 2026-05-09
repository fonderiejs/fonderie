-- Seed default email templates
-- Templates use {{key}} interpolation; available variables are listed per type.

-- email-verification  — variables: pin, firstName
INSERT INTO fonderie_courier_templates (type, locale, subject, html, text)
VALUES (
	'email-verification',
	NULL,
	'Your verification code',
	'<p>Hi {{firstName}},</p>
<p>Your email verification code is:</p>
<h2 style="letter-spacing:0.2em;">{{pin}}</h2>
<p>Enter this code to complete your registration. It expires in 24 hours.</p>
<p>If you did not create an account, you can safely ignore this email.</p>',
	'Hi {{firstName}},

Your email verification code is: {{pin}}

Enter this code to complete your registration. It expires in 24 hours.

If you did not create an account, you can safely ignore this email.'
)
ON CONFLICT (type, locale) DO UPDATE
	SET subject    = EXCLUDED.subject,
	    html       = EXCLUDED.html,
	    text       = EXCLUDED.text,
	    updated_at = now();
