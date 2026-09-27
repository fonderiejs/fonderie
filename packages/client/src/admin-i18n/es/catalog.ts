import type en from '../en/catalog';

const catalog: typeof en = {
	title: 'Catálogo',
	lead: 'Lo que vendes: los planes tal como están configurados en el código y tal como están guardados en la base de datos, lado a lado.',
	configured: 'Configurados (código)',
	stored: 'Guardados (base de datos)',
	emptyTitle: 'No hay planes guardados',
	emptyBody:
		'Los planes están configurados en el código; no se ha escrito nada en la base de datos.',
	col: {
		plan: 'Plan',
		tier: 'Nivel',
		seats: 'Plazas',
		monthly: 'Mensual',
		yearly: 'Anual',
		trial: 'Prueba',
	},
	trialDays: '{n} d',
	deleteConfirm: '¿Eliminar el plan guardado «{name}»?',
};
export default catalog;
