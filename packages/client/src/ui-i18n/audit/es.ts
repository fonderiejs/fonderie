import type en from './en';

// Addressed with « tú », neutral Latin-American Spanish.
const audit: typeof en = {
	log: {
		title: 'Registro de auditoría',
		eventType: 'Tipo de evento',
		actorId: 'ID del actor',
		filter: 'Filtrar',
		loading: 'Cargando…',
		loadMore: 'Cargar más',
		system: 'sistema',
		a11y: {
			eventType: 'Filtro por tipo de evento',
			eventTypeHint: 'Muestra solo los eventos de este tipo',
			actorId: 'Filtro por ID del actor',
			actorIdHint: 'Muestra solo los eventos de este actor',
			filter: 'Aplicar filtros',
			event: '{type} por {actor}, {date}',
			eventHint: 'Muestra u oculta los detalles del evento',
			loadMore: 'Cargar más eventos',
			loadingMore: 'Cargando más eventos',
		},
	},
};

export default audit;
