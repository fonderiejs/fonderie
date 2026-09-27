import type en from '../en/tokens';

const tokens: typeof en = {
	title: 'Tokens',
	lead: 'Credenciales para máquinas: la solidez del token raíz, tokens con alcance limitado para la CLI y la CI, y cualquier token heredado por módulo. Las personas inician sesión como operadores.',
	needsRoot: 'Emitir y revocar requieren el token raíz (el de la configuración de tu despliegue).',
	rootToken: 'Token raíz',
	strong: 'sólido',
	weak: 'débil',
	issuedTokens: 'Tokens emitidos',
	issuingOff:
		'La emisión está desactivada — proporciona un store a AdminModule y ejecuta sus migraciones.',
	copyNow: 'Cópialo ahora — no se volverá a mostrar.',
	namePlaceholder: 'nombre',
	nameLabel: 'Nombre',
	scope: {
		read: 'lectura',
		write: 'escritura',
		secrets: 'secretos',
	},
	daysPlaceholder: 'días (opcional)',
	daysLabel: 'Días',
	issue: 'Emitir token',
	col: {
		name: 'Nombre',
		scopes: 'Alcances',
		created: 'Creado',
		expires: 'Vence',
		lastUsed: 'Último uso',
	},
	revoked: 'revocado',
	revoke: 'Revocar',
	revokeConfirm: '¿Revocar «{name}»? Todo lo que lo use dejará de funcionar de inmediato.',
	emptyTitle: 'Aún no hay tokens con alcance limitado',
	emptyBody:
		'Emite un token de solo lectura para un panel o un compañero en lugar de compartir el token raíz.',
	legacyTitle: 'Tokens heredados por módulo',
	legacyNone: 'Ninguno — la superficie de administración de cada módulo pasa por este token.',
	legacyRow: 'todavía registra sus rutas independientes con su propio token (obsoleto)',
};
export default tokens;
