import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// Spanish copy of the built-in workspaces email — same keys and {{variables}} as
// the English (./templates.ts); the coverage test checks they match.
export const ES_TEMPLATES = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: 'Te invitaron a unirte a {{workspaceName}}',
		html: `<h1>Te invitaron</h1>
<p>Te invitaron a unirte a <strong>{{workspaceName}}</strong>{{#inviterName}} de parte de {{inviterName}}{{/inviterName}}.</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">Aceptar la invitación</a></p>{{/acceptUrl}}
<p>Tu código de invitación:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Introduce este código en la pantalla de invitación para unirte al equipo.</p>`,
		text: `Te invitaron

Te invitaron a unirte a {{workspaceName}}{{#inviterName}} de parte de {{inviterName}}{{/inviterName}}.
{{#acceptUrl}}
Aceptar la invitación: {{acceptUrl}}
{{/acceptUrl}}
Tu código de invitación: {{pin}}

Introduce este código en la pantalla de invitación para unirte al equipo.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
