import type en from './en';

const workspaces: typeof en = {
	roles: {
		ADMIN: 'Administrador',
		GUEST: 'Invitado',
	},
	invitationStatus: {
		PENDING: 'Pendiente',
		ACCEPTED: 'Aceptada',
		REJECTED: 'Rechazada',
		CANCELLED: 'Cancelada',
	},
	members: {
		title: 'Miembros del equipo',
		loading: 'Cargando equipo…',
		invite: 'Invitar',
		remove: 'Quitar',
		a11y: {
			invite: 'Invitar miembros',
			remove: 'Quitar a {member} del espacio de trabajo',
		},
	},
	invite: {
		title: 'Invitar miembros',
		email: 'Correo electrónico',
		submit: 'Enviar invitación',
		submitShort: 'Enviar',
		submitting: 'Enviando…',
		pending: 'Invitaciones pendientes',
		loading: 'Cargando…',
		cancel: 'Cancelar',
		backToTeam: 'Volver al equipo',
		a11y: {
			email: 'Campo de correo electrónico',
			emailHint: 'Escribe el correo electrónico de la persona que quieres invitar',
			submit: 'Botón Enviar invitación',
			cancel: 'Cancelar la invitación de {email}',
		},
	},
	accept: {
		title: 'Invitación a un espacio de trabajo',
		body: 'Te invitaron a unirte a un espacio de trabajo. Acepta la invitación para ser miembro.',
		submit: 'Aceptar invitación',
		submitting: 'Aceptando…',
		notNow: 'Ahora no',
		acceptedTitle: 'Invitación aceptada',
		acceptedBody: 'Te uniste al espacio de trabajo.',
		a11y: {
			submit: 'Botón Aceptar invitación',
		},
	},
};

export default workspaces;
