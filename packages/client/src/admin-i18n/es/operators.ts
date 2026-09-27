import type en from '../en/operators';

const operators: typeof en = {
	title: 'Operadores',
	lead: 'Las personas que pueden iniciar sesión en esta consola. Cada una usa una contraseña y una aplicación de autenticación; no hay registro.',
	level: {
		read: 'Solo lectura',
		editor: 'Editor',
		owner: 'Propietario',
	},
	levelHint: {
		read: 'consultar, sin cambiar nada',
		editor: 'cambiar configuración, plantillas y usuarios',
		owner: 'también secretos, tokens y operadores',
	},
	needsOwner: 'Gestionar operadores requiere el nivel Propietario.',
	mintedTitle: 'Envía este enlace a {email}. Solo se muestra una vez.',
	mintedBody: 'Funciona una sola vez y vence el {date}.',
	invite: 'Invitar',
	invitePlaceholder: 'companero@empresa.com',
	inviteLabel: 'Correo electrónico a invitar',
	accessLevelLabel: 'Nivel de acceso',
	accessLevelFor: 'Nivel de acceso de {email}',
	createInvite: 'Crear enlace de invitación',
	emptyTitle: 'Aún no hay operadores',
	col: {
		operator: 'Operador',
		access: 'Acceso',
		status: 'Estado',
		lastSignIn: 'Último inicio de sesión',
	},
	settingUp: 'en configuración',
	backupCodesLeftOne: 'queda {n} código de respaldo',
	backupCodesLeftMany: 'quedan {n} códigos de respaldo',
	recoveryLink: 'Enlace de recuperación',
	recoveryConfirm:
		'¿Crear un enlace de recuperación para {email}? Cierra su sesión en todas partes; el enlace permite definir una nueva contraseña y una nueva aplicación de autenticación.',
	disable: 'Desactivar',
	enable: 'Activar',
	disableConfirm: '¿Desactivar a {email}? Su sesión se cierra de inmediato.',
	pendingLinks: 'Enlaces pendientes',
	linkKind: {
		invite: 'invitación',
		recovery: 'recuperación',
	},
	expiresOn: 'vence el {date}',
	revoke: 'Revocar',
};
export default operators;
