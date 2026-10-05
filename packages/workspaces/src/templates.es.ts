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
	[MESSAGE_KEYS.ownershipReceived]: {
		subject: 'Ahora eres el propietario de {{workspaceName}}',
		html: `<h1>Ahora eres propietario de un equipo</h1>
<p>Ahora eres el propietario de <strong>{{workspaceName}}</strong>.</p>
{{#previousOwnerName}}<p>{{previousOwnerName}} te lo traspasó.</p>{{/previousOwnerName}}
<p class="muted">Como propietario decides quién gestiona el equipo, y solo tú puedes volver a traspasarlo.</p>`,
		text: `Ahora eres propietario de un equipo

Ahora eres el propietario de {{workspaceName}}.
{{#previousOwnerName}}{{previousOwnerName}} te lo traspasó.{{/previousOwnerName}}

Como propietario decides quién gestiona el equipo, y solo tú puedes volver a traspasarlo.`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
