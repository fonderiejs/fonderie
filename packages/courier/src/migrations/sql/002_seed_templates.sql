-- Seed default email templates
-- Uses UPDATE + conditional INSERT to safely handle NULL locale (ON CONFLICT
-- does not fire for NULL columns in standard Postgres unique indexes).

-- email-verification  — variables: pin, firstName
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM fonderie_courier_templates
		WHERE type = 'email-verification' AND locale IS NULL
	) THEN
		UPDATE fonderie_courier_templates
		SET
			subject    = 'Your verification code',
			html       = '<p>Hi {{firstName}},</p>
<p>Your email verification code is:</p>
<h2 style="letter-spacing:0.2em;">{{pin}}</h2>
<p>Enter this code to complete your registration. It expires in 24 hours.</p>
<p>If you did not create an account, you can safely ignore this email.</p>',
			text       = 'Hi {{firstName}},

Your email verification code is: {{pin}}

Enter this code to complete your registration. It expires in 24 hours.

If you did not create an account, you can safely ignore this email.',
			updated_at = now()
		WHERE type = 'email-verification' AND locale IS NULL;
	ELSE
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
		);
	END IF;
END $$;
