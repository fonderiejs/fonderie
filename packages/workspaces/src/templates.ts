import type { IDefaultTemplate } from '@fonderie/core';
import { withTranslations } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';
import { ES_TEMPLATES } from './templates.es';
import { FR_TEMPLATES } from './templates.fr';
import { ZH_HANS_TEMPLATES } from './templates.zh-Hans';
import { ZH_HANT_TEMPLATES } from './templates.zh-Hant';

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
	[MESSAGE_KEYS.memberRemoved]: {
		subject: 'You were removed from {{workspaceName}}',
		html: `<h1>You were removed from a team</h1>
<p>You are no longer a member of <strong>{{workspaceName}}</strong>{{#actorName}}: {{actorName}} removed you{{/actorName}}.</p>
<p class="muted">If you did not expect this, contact the owner of the team.</p>`,
		text: `You were removed from a team

You are no longer a member of {{workspaceName}}{{#actorName}}: {{actorName}} removed you{{/actorName}}.

If you did not expect this, contact the owner of the team.`,
	},
	[MESSAGE_KEYS.memberRemovedAlert]: {
		subject: '{{actorName}} removed {{memberName}} from {{workspaceName}}',
		html: `<h1>A member was removed</h1>
<p><strong>{{actorName}}</strong> removed <strong>{{memberName}}</strong> from <strong>{{workspaceName}}</strong>.</p>
<p class="muted">You are told because you own the team. If this was not expected, you can invite them back and review who manages the team.</p>`,
		text: `A member was removed

{{actorName}} removed {{memberName}} from {{workspaceName}}.

You are told because you own the team. If this was not expected, you can invite them back and review who manages the team.`,
	},
	[MESSAGE_KEYS.managerRemoved]: {
		subject: 'You are no longer a manager of {{workspaceName}}',
		html: `<h1>Your manager rights were removed</h1>
<p>You are still a member of <strong>{{workspaceName}}</strong>, but you can no longer manage the team.</p>
<p class="muted">If you did not expect this, contact the owner of the team.</p>`,
		text: `Your manager rights were removed

You are still a member of {{workspaceName}}, but you can no longer manage the team.

If you did not expect this, contact the owner of the team.`,
	},
	[MESSAGE_KEYS.ownershipOffered]: {
		subject: '{{ownerName}} wants to make you the owner of {{workspaceName}}',
		html: `<h1>You are offered a team</h1>
<p><strong>{{ownerName}}</strong> wants to make you the owner of <strong>{{workspaceName}}</strong>.</p>
<p class="muted">Open the app to accept or decline. The offer lapses in 7 days. As the owner you would decide who manages the team.</p>`,
		text: `You are offered a team

{{ownerName}} wants to make you the owner of {{workspaceName}}.

Open the app to accept or decline. The offer lapses in 7 days. As the owner you would decide who manages the team.`,
	},
	[MESSAGE_KEYS.ownershipAccepted]: {
		subject: '{{newOwnerName}} is now the owner of {{workspaceName}}',
		html: `<h1>Your team has a new owner</h1>
<p><strong>{{newOwnerName}}</strong> accepted, and is now the owner of <strong>{{workspaceName}}</strong>. You still manage the team.</p>
<p class="muted">If you did not offer it, contact them and your support team now.</p>`,
		text: `Your team has a new owner

{{newOwnerName}} accepted, and is now the owner of {{workspaceName}}. You still manage the team.

If you did not offer it, contact them and your support team now.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplate>;

// The English above, with French, Spanish and Chinese (Simplified and
// Traditional) attached. Courier sends the one
// matching the recipient's language; anything else gets the English.
export const DEFAULT_TEMPLATES = withTranslations(EN_TEMPLATES, {
	fr: FR_TEMPLATES,
	es: ES_TEMPLATES,
	'zh-Hans': ZH_HANS_TEMPLATES,
	'zh-Hant': ZH_HANT_TEMPLATES,
});

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
	[MESSAGE_KEYS.memberRemoved]: { workspaceName: 'Acme Crew', actorName: 'Marco Tester' },
	[MESSAGE_KEYS.memberRemovedAlert]: { workspaceName: 'Acme Crew', actorName: 'Marco Tester', memberName: 'Ana Tester' },
	[MESSAGE_KEYS.managerRemoved]: { workspaceName: 'Acme Crew' },
	[MESSAGE_KEYS.ownershipOffered]: { workspaceName: 'Acme Crew', ownerName: 'Olivia Tester' },
	[MESSAGE_KEYS.ownershipAccepted]: { workspaceName: 'Acme Crew', newOwnerName: 'Marco Tester' },
};
