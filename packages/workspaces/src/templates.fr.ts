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
	[MESSAGE_KEYS.webhookCreatedAlert]: {
		subject: '{{actorName}} a ajouté un webhook à {{workspaceName}}',
		html: `<h1>Un webhook a été ajouté</h1>
<p><strong>{{actorName}}</strong> a ajouté un webhook à <strong>{{workspaceName}}</strong>. Il envoie chaque événement de l’espace à <strong>{{host}}</strong>.</p>
<p class="muted">Si vous ne le reconnaissez pas, supprimez-le dans les intégrations et vérifiez qui gère l’équipe.</p>`,
		text: `Un webhook a été ajouté

{{actorName}} a ajouté un webhook à {{workspaceName}}. Il envoie chaque événement de l’espace à {{host}}.

Si vous ne le reconnaissez pas, supprimez-le dans les intégrations et vérifiez qui gère l’équipe.`,
	},
	[MESSAGE_KEYS.planCancelAlert]: {
		subject: '{{actorName}} a annulé le forfait de {{workspaceName}}',
		html: `<h1>Le forfait a été annulé</h1>
<p><strong>{{actorName}}</strong> a annulé le forfait de <strong>{{workspaceName}}</strong>{{#immediately}}, avec effet immédiat{{/immediately}}{{#atPeriodEnd}} ; il prend fin à la fin de la période payée{{/atPeriodEnd}}.</p>
<p class="muted">Si ce n’était pas convenu, vous pouvez le reprendre ou choisir un forfait dans la facturation.</p>`,
		text: `Le forfait a été annulé

{{actorName}} a annulé le forfait de {{workspaceName}}{{#immediately}}, avec effet immédiat{{/immediately}}{{#atPeriodEnd}} ; il prend fin à la fin de la période payée{{/atPeriodEnd}}.

Si ce n’était pas convenu, vous pouvez le reprendre ou choisir un forfait dans la facturation.`,
	},
	[MESSAGE_KEYS.managerPaused]: {
		subject: '{{memberName}} ne peut plus rien supprimer dans {{workspaceName}}',
		html: `<h1>Suppressions suspendues</h1>
<p><strong>{{memberName}}</strong> a supprimé {{count}} éléments en {{minutes}} minutes dans <strong>{{workspaceName}}</strong> : ses suppressions sont suspendues jusqu’à ce que vous vérifiiez.</p>
<p class="muted">Consultez le journal d’activité et les éléments récemment supprimés : tout peut être restauré pendant 30 jours. Si c’était prévu, levez la suspension depuis l’écran Membres.</p>`,
		text: `Suppressions suspendues

{{memberName}} a supprimé {{count}} éléments en {{minutes}} minutes dans {{workspaceName}} : ses suppressions sont suspendues jusqu’à ce que vous vérifiiez.

Consultez le journal d’activité et les éléments récemment supprimés : tout peut être restauré pendant 30 jours. Si c’était prévu, levez la suspension depuis l’écran Membres.`,
	},
	[MESSAGE_KEYS.ownershipOffered]: {
		subject: '{{ownerName}} souhaite vous nommer propriétaire de {{workspaceName}}',
		html: `<h1>On vous propose une équipe</h1>
<p><strong>{{ownerName}}</strong> souhaite vous nommer propriétaire de <strong>{{workspaceName}}</strong>.</p>
<p class="muted">Ouvrez l’application pour accepter ou refuser. L’offre expire dans 7 jours. En tant que propriétaire, vous décideriez qui gère l’équipe.</p>`,
		text: `On vous propose une équipe

{{ownerName}} souhaite vous nommer propriétaire de {{workspaceName}}.

Ouvrez l’application pour accepter ou refuser. L’offre expire dans 7 jours. En tant que propriétaire, vous décideriez qui gère l’équipe.`,
	},
	[MESSAGE_KEYS.ownershipAccepted]: {
		subject: '{{newOwnerName}} est maintenant propriétaire de {{workspaceName}}',
		html: `<h1>Votre équipe a un nouveau propriétaire</h1>
<p><strong>{{newOwnerName}}</strong> a accepté et est maintenant propriétaire de <strong>{{workspaceName}}</strong>. Vous gérez toujours l’équipe.</p>
<p class="muted">Si vous n’avez pas fait cette offre, contactez cette personne et votre support dès maintenant.</p>`,
		text: `Votre équipe a un nouveau propriétaire

{{newOwnerName}} a accepté et est maintenant propriétaire de {{workspaceName}}. Vous gérez toujours l’équipe.

Si vous n’avez pas fait cette offre, contactez cette personne et votre support dès maintenant.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
