import type { IDefaultTemplate } from '@fonderie/core';
import { withTranslations } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';
import { ES_TEMPLATES } from './templates.es';
import { FR_TEMPLATES } from './templates.fr';

// Built-in default copy for @fonderie/workspaces notifications, shipped so the
// email renders out of the box (never the raw-JSON fallback). `html` is a BODY
// FRAGMENT injected into courier's branded layout shell; {{vars}} interpolate.
// Pass to courier via config.templates.defaults; override per-app with a DB
// row / FS file. `satisfies Record<WorkspacesMessageKey, IDefaultTemplate>` makes
// a missing key a compile error.
const EN_TEMPLATES = {
	// Payload carries { token, pin, acceptUrl, workspaceName, inviterName }.
	// acceptUrl is set only when the app configured invitationUrl, so the link
	// is an optional block and the PIN is always there as the fallback. The raw
	// token is not surfaced: it travels inside acceptUrl.
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: "You've been invited to join {{workspaceName}}",
		html: `<h1>You&rsquo;ve been invited</h1>
<p>You&rsquo;ve been invited to join <strong>{{workspaceName}}</strong>{{#inviterName}} by {{inviterName}}{{/inviterName}}.</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">Accept the invitation</a></p>{{/acceptUrl}}
<p>Your invitation code:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Enter this code on the invitation screen to join the team.</p>`,
		text: `You've been invited

You've been invited to join {{workspaceName}}{{#inviterName}} by {{inviterName}}{{/inviterName}}.
{{#acceptUrl}}
Accept the invitation: {{acceptUrl}}
{{/acceptUrl}}
Your invitation code: {{pin}}

Enter this code on the invitation screen to join the team.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplate>;

// The English above, with French and Spanish attached. Courier sends the one
// matching the recipient's language; anything else gets the English.
export const DEFAULT_TEMPLATES = withTranslations(EN_TEMPLATES, { fr: FR_TEMPLATES, es: ES_TEMPLATES });

// Representative payloads for the coverage test — the full emitted payload
// (token is passed but unused by the copy: it travels inside acceptUrl).
export const SAMPLE_PAYLOADS: Record<WorkspacesMessageKey, Record<string, unknown>> = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		token: 'inv_abc123',
		pin: '123456',
		acceptUrl: 'https://app.acme.example/invite/inv_abc123',
		workspaceName: 'Acme Crew',
		inviterName: 'Olivia Tester',
	},
};
