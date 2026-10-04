import type en from './en';

// Addressed with « vous », as product UI in French usually is.
const audit: typeof en = {
	log: {
		title: "Journal d'activité",
		eventType: "Type d'événement",
		actorId: "ID de l'auteur",
		filter: 'Filtrer',
		loading: 'Chargement…',
		loadMore: 'Afficher plus',
		system: 'système',
		a11y: {
			eventType: "Filtre par type d'événement",
			eventTypeHint: 'Afficher seulement les événements de ce type',
			actorId: "Filtre par ID de l'auteur",
			actorIdHint: 'Afficher seulement les événements de cet auteur',
			filter: 'Appliquer les filtres',
			event: '{type} par {actor}, {date}',
			eventHint: "Affiche ou masque les détails de l'événement",
			loadMore: "Afficher plus d'événements",
			loadingMore: "Chargement d'autres événements",
		},
	},
};

export default audit;
