import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// French copy of the built-in workspaces email — same keys and {{variables}} as
// the English (./templates.ts); the coverage test checks they match.
export const FR_TEMPLATES = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: 'Vous avez été invité à rejoindre un espace de travail',
		html: `<h1>Vous avez été invité</h1>
<p>Vous avez été invité à rejoindre un espace de travail. Utilisez ce code pour accepter l&rsquo;invitation :</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Saisissez ce code sur l&rsquo;écran d&rsquo;invitation pour rejoindre l&rsquo;équipe.</p>`,
		text: `Vous avez été invité

Vous avez été invité à rejoindre un espace de travail. Utilisez ce code pour accepter l'invitation : {{pin}}

Saisissez ce code sur l'écran d'invitation pour rejoindre l'équipe.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
