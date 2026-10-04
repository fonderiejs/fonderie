-- workspace-invitation: carry the accept link, the workspace and the inviter.
--
-- @fonderie/workspaces now sends acceptUrl, workspaceName and inviterName with
-- the PIN. The base row seeded by 002 wins over the module's default copy, so
-- without this every existing install would keep sending the PIN-only email
-- and the link would never reach anyone.
--
-- Only an UNTOUCHED seed is upgraded: version 1, no editor, and the exact text
-- 002 wrote. An operator's own copy is theirs and is left alone. The upgrade is
-- recorded like a console edit — the seed as revision 1, the new copy as
-- revision 2 — so the console can roll it back.

DO $mig$
DECLARE
	seed_text text := 'You''ve been invited

You''ve been invited to join a workspace. Use this code to accept the invitation: {{pin}}

Enter this code on the invitation screen to join the team.';
	new_subject text := 'You''ve been invited to join {{workspaceName}}';
	new_html text := '<h1>You&rsquo;ve been invited</h1>
<p>You&rsquo;ve been invited to join <strong>{{workspaceName}}</strong>{{#inviterName}} by {{inviterName}}{{/inviterName}}.</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">Accept the invitation</a></p>{{/acceptUrl}}
<p>Your invitation code:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Enter this code on the invitation screen to join the team.</p>';
	new_text text := 'You''ve been invited

You''ve been invited to join {{workspaceName}}{{#inviterName}} by {{inviterName}}{{/inviterName}}.
{{#acceptUrl}}
Accept the invitation: {{acceptUrl}}
{{/acceptUrl}}
Your invitation code: {{pin}}

Enter this code on the invitation screen to join the team.';
	old_row fonderie_courier_templates%ROWTYPE;
BEGIN
	SELECT * INTO old_row FROM fonderie_courier_templates
	WHERE type = 'workspace-invitation' AND locale IS NULL
	  AND version = 1 AND updated_by IS NULL AND text = seed_text
	FOR UPDATE;
	IF NOT FOUND THEN
		RETURN;
	END IF;

	INSERT INTO fonderie_courier_template_revisions (type, locale, subject, html, text, version, actor)
	VALUES ('workspace-invitation', NULL, old_row.subject, old_row.html, old_row.text, 1, 'fonderie:seed')
	ON CONFLICT DO NOTHING;

	UPDATE fonderie_courier_templates
	SET subject = new_subject, html = new_html, text = new_text,
	    version = 2, updated_by = 'fonderie:migration', updated_at = now()
	WHERE type = 'workspace-invitation' AND locale IS NULL;

	INSERT INTO fonderie_courier_template_revisions (type, locale, subject, html, text, version, actor)
	VALUES ('workspace-invitation', NULL, new_subject, new_html, new_text, 2, 'fonderie:migration')
	ON CONFLICT DO NOTHING;
END
$mig$;
