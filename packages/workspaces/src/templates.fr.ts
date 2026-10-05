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
	[MESSAGE_KEYS.memberRemoved]: {
		subject: 'Vous avez été retiré de {{workspaceName}}',
		html: `<h1>Vous avez été retiré d’une équipe</h1>
<p>Vous n’êtes plus membre de <strong>{{workspaceName}}</strong>{{#actorName}} : {{actorName}} vous a retiré{{/actorName}}.</p>
<p class="muted">Si vous ne vous y attendiez pas, contactez le propriétaire de l’équipe.</p>`,
		text: `Vous avez été retiré d’une équipe

Vous n’êtes plus membre de {{workspaceName}}{{#actorName}} : {{actorName}} vous a retiré{{/actorName}}.

Si vous ne vous y attendiez pas, contactez le propriétaire de l’équipe.`,
	},
	[MESSAGE_KEYS.memberRemovedAlert]: {
		subject: '{{actorName}} a retiré {{memberName}} de {{workspaceName}}',
		html: `<h1>Un membre a été retiré</h1>
<p><strong>{{actorName}}</strong> a retiré <strong>{{memberName}}</strong> de <strong>{{workspaceName}}</strong>.</p>
<p class="muted">Vous en êtes informé parce que vous êtes propriétaire de l’équipe. Si ce n’était pas prévu, vous pouvez l’inviter à nouveau et revoir qui gère l’équipe.</p>`,
		text: `Un membre a été retiré

{{actorName}} a retiré {{memberName}} de {{workspaceName}}.

Vous en êtes informé parce que vous êtes propriétaire de l’équipe. Si ce n’était pas prévu, vous pouvez l’inviter à nouveau et revoir qui gère l’équipe.`,
	},
	[MESSAGE_KEYS.managerRemoved]: {
		subject: 'Vous n’êtes plus gestionnaire de {{workspaceName}}',
		html: `<h1>Vos droits de gestion ont été retirés</h1>
<p>Vous êtes toujours membre de <strong>{{workspaceName}}</strong>, mais vous ne pouvez plus gérer l’équipe.</p>
<p class="muted">Si vous ne vous y attendiez pas, contactez le propriétaire de l’équipe.</p>`,
		text: `Vos droits de gestion ont été retirés

Vous êtes toujours membre de {{workspaceName}}, mais vous ne pouvez plus gérer l’équipe.

Si vous ne vous y attendiez pas, contactez le propriétaire de l’équipe.`,
	},
	[MESSAGE_KEYS.ownershipReceived]: {
		subject: 'Vous êtes maintenant propriétaire de {{workspaceName}}',
		html: `<h1>Vous êtes propriétaire d’une équipe</h1>
<p>Vous êtes maintenant propriétaire de <strong>{{workspaceName}}</strong>.</p>
{{#previousOwnerName}}<p>{{previousOwnerName}} vous l’a transférée.</p>{{/previousOwnerName}}
<p class="muted">En tant que propriétaire, vous décidez qui gère l’équipe, et vous seul pouvez la transférer à nouveau.</p>`,
		text: `Vous êtes propriétaire d’une équipe

Vous êtes maintenant propriétaire de {{workspaceName}}.
{{#previousOwnerName}}{{previousOwnerName}} vous l’a transférée.{{/previousOwnerName}}

En tant que propriétaire, vous décidez qui gère l’équipe, et vous seul pouvez la transférer à nouveau.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
