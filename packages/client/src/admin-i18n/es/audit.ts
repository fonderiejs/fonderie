import type en from '../en/audit';

const audit: typeof en = {
	title: 'Auditoría',
	lead: 'Lo que ha pasado, en todos los espacios de trabajo salvo que indiques uno. El veredicto de integridad de la cadena está en la página Diagnóstico.',
	workspacePlaceholder: 'id del espacio de trabajo (todos si está vacío)',
	typePlaceholder: 'tipo de evento',
	actorPlaceholder: 'id del actor',
	fromLabel: 'Fecha de inicio',
	fromTitle: 'Desde (incluido)',
	toLabel: 'Fecha de fin',
	toTitle: 'Hasta (incluido)',
	empty: 'Nada registrado para este filtro',
	col: {
		when: 'Fecha',
		type: 'Tipo',
		workspace: 'Espacio de trabajo',
		actor: 'Actor',
		request: 'Solicitud',
	},
};
export default audit;
