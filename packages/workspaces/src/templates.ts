import type { IDefaultTemplate } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// Built-in default copy for @fonderie/workspaces notifications, shipped so the
// email renders out of the box (never the raw-JSON fallback). `html` is a BODY
// FRAGMENT injected into courier's branded layout shell; {{vars}} interpolate.
// Pass to courier via config.templates.defaults; override per-app with a DB
// row / FS file. `satisfies Record<WorkspacesMessageKey, IDefaultTemplate>` makes
// a missing key a compile error.
export const DEFAULT_TEMPLATES = {
	// Payload carries { token, pin }; the code path is PIN-based, so the copy
	// uses {{pin}} only — token is intentionally not surfaced.
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: "You've been invited to a workspace",
		html: `<h1>You&rsquo;ve been invited</h1>
<p>You&rsquo;ve been invited to join a workspace. Use this code to accept the invitation:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Enter this code on the invitation screen to join the team.</p>`,
		text: `You've been invited

You've been invited to join a workspace. Use this code to accept the invitation: {{pin}}

Enter this code on the invitation screen to join the team.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplate>;

// Representative payloads for the coverage test — the full emitted payload
// (token is passed but unused by the copy; kept here to document the shape).
export const SAMPLE_PAYLOADS: Record<WorkspacesMessageKey, Record<string, unknown>> = {
	[MESSAGE_KEYS.workspaceInvitation]: { token: 'inv_abc123', pin: '123456' },
};
