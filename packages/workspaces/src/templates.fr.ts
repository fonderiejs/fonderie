import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// French copy of the built-in workspaces email — same keys and {{variables}} as
// the English (./templates.ts); the coverage test checks they match.
export const FR_TEMPLATES = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: 'Vous êtes invité à rejoindre {{workspaceName}}',
		html: `<h1>Vous avez été invité</h1>
<p>Vous êtes invité à rejoindre <strong>{{workspaceName}}</strong>{{#inviterName}} par {{inviterName}}{{/inviterName}}.</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">Accepter l&rsquo;invitation</a></p>{{/acceptUrl}}
<p>Votre code d&rsquo;invitation :</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Saisissez ce code sur l&rsquo;écran d&rsquo;invitation pour rejoindre l&rsquo;équipe.</p>`,
		text: `Vous avez été invité

Vous êtes invité à rejoindre {{workspaceName}}{{#inviterName}} par {{inviterName}}{{/inviterName}}.
{{#acceptUrl}}
Accepter l'invitation : {{acceptUrl}}
{{/acceptUrl}}
Votre code d'invitation : {{pin}}

Saisissez ce code sur l'écran d'invitation pour rejoindre l'équipe.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
