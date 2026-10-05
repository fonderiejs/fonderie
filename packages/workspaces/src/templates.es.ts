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
	[MESSAGE_KEYS.memberRemoved]: {
		subject: 'Te retiraron de {{workspaceName}}',
		html: `<h1>Te retiraron de un equipo</h1>
<p>Ya no eres miembro de <strong>{{workspaceName}}</strong>{{#actorName}}: {{actorName}} te retiró{{/actorName}}.</p>
<p class="muted">Si no lo esperabas, contacta con el propietario del equipo.</p>`,
		text: `Te retiraron de un equipo

Ya no eres miembro de {{workspaceName}}{{#actorName}}: {{actorName}} te retiró{{/actorName}}.

Si no lo esperabas, contacta con el propietario del equipo.`,
	},
	[MESSAGE_KEYS.memberRemovedAlert]: {
		subject: '{{actorName}} retiró a {{memberName}} de {{workspaceName}}',
		html: `<h1>Se retiró a un miembro</h1>
<p><strong>{{actorName}}</strong> retiró a <strong>{{memberName}}</strong> de <strong>{{workspaceName}}</strong>.</p>
<p class="muted">Te avisamos porque eres el propietario del equipo. Si no era lo previsto, puedes volver a invitarle y revisar quién gestiona el equipo.</p>`,
		text: `Se retiró a un miembro

{{actorName}} retiró a {{memberName}} de {{workspaceName}}.

Te avisamos porque eres el propietario del equipo. Si no era lo previsto, puedes volver a invitarle y revisar quién gestiona el equipo.`,
	},
	[MESSAGE_KEYS.managerRemoved]: {
		subject: 'Ya no eres gestor de {{workspaceName}}',
		html: `<h1>Te quitaron los permisos de gestión</h1>
<p>Sigues siendo miembro de <strong>{{workspaceName}}</strong>, pero ya no puedes gestionar el equipo.</p>
<p class="muted">Si no lo esperabas, contacta con el propietario del equipo.</p>`,
		text: `Te quitaron los permisos de gestión

Sigues siendo miembro de {{workspaceName}}, pero ya no puedes gestionar el equipo.

Si no lo esperabas, contacta con el propietario del equipo.`,
	},
	[MESSAGE_KEYS.managerPaused]: {
		subject: '{{memberName}} ya no puede eliminar nada en {{workspaceName}}',
		html: `<h1>Eliminaciones pausadas</h1>
<p><strong>{{memberName}}</strong> eliminó {{count}} elementos en {{minutes}} minutos en <strong>{{workspaceName}}</strong>, así que no podrá eliminar nada más hasta que lo revises.</p>
<p class="muted">Revisa el registro de actividad y los elementos eliminados recientemente: todo se puede restaurar durante 30 días. Si era lo previsto, quita la pausa desde la pantalla Miembros.</p>`,
		text: `Eliminaciones pausadas

{{memberName}} eliminó {{count}} elementos en {{minutes}} minutos en {{workspaceName}}, así que no podrá eliminar nada más hasta que lo revises.

Revisa el registro de actividad y los elementos eliminados recientemente: todo se puede restaurar durante 30 días. Si era lo previsto, quita la pausa desde la pantalla Miembros.`,
	},
	[MESSAGE_KEYS.ownershipOffered]: {
		subject: '{{ownerName}} quiere hacerte propietario de {{workspaceName}}',
		html: `<h1>Te ofrecen un equipo</h1>
<p><strong>{{ownerName}}</strong> quiere hacerte propietario de <strong>{{workspaceName}}</strong>.</p>
<p class="muted">Abre la aplicación para aceptar o rechazar. La oferta caduca en 7 días. Como propietario decidirías quién gestiona el equipo.</p>`,
		text: `Te ofrecen un equipo

{{ownerName}} quiere hacerte propietario de {{workspaceName}}.

Abre la aplicación para aceptar o rechazar. La oferta caduca en 7 días. Como propietario decidirías quién gestiona el equipo.`,
	},
	[MESSAGE_KEYS.ownershipAccepted]: {
		subject: '{{newOwnerName}} es ahora el propietario de {{workspaceName}}',
		html: `<h1>Tu equipo tiene un nuevo propietario</h1>
<p><strong>{{newOwnerName}}</strong> aceptó y ahora es el propietario de <strong>{{workspaceName}}</strong>. Sigues gestionando el equipo.</p>
<p class="muted">Si no hiciste esta oferta, contacta con esa persona y con tu equipo de soporte ahora.</p>`,
		text: `Tu equipo tiene un nuevo propietario

{{newOwnerName}} aceptó y ahora es el propietario de {{workspaceName}}. Sigues gestionando el equipo.

Si no hiciste esta oferta, contacta con esa persona y con tu equipo de soporte ahora.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
