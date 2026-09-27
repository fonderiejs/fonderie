import type en from '../en/migrations';

const migrations: typeof en = {
	title: 'Migraciones',
	lead: 'Los cambios de esquema que incluye cada módulo, y si esta base de datos ya los tiene.',
	needsWrite: 'Aplicar migraciones requiere un token con permiso de escritura.',
	firstInstall:
		'Esta base de datos nunca se ha migrado: se trata como una primera instalación, así que no se retiene nada.',
	upToDate: 'Todos los módulos están al día',
	noPending: 'No hay migraciones pendientes.',
	pendingCount: '{n} pendientes',
	destructive: 'destructiva',
	additive: 'aditiva',
	blockedBy: 'Aplica primero «{module}»: se ejecuta antes que este y está atrasado.',
	destructiveBlocked:
		'Contiene una migración que elimina datos. Ninguna migración inversa los recupera: aplícala mediante la CI o `npm run migrate`.',
	confirmApply:
		'¿Aplicar {n} migración(es) a «{module}»? Esto modifica el esquema de la base de datos.',
	applyOne: 'Aplicar 1 migración',
	applyMany: 'Aplicar {n} migraciones',
};
export default migrations;
