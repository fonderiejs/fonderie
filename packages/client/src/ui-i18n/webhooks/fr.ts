import type en from './en';

// Addressed with « vous », as product UI in French usually is.
const webhooks: typeof en = {
	loading: 'Chargement…',
	enabled: 'Activé',
	disabled: 'Désactivé',
	status: {
		pending: 'en attente',
		delivered: 'envoyé',
		failed: 'échec',
	},
	list: {
		title: 'Webhooks',
		newSecret: 'Nouvelle clé secrète du point de terminaison (affichée une seule fois) :',
		urlPlaceholder: 'https://example.com/webhook',
		eventsPlaceholder: 'event.type, event.other (facultatif)',
		add: 'Ajouter un point de terminaison',
		test: 'Tester',
		delete: 'Supprimer',
		testOk: '{endpoint} : OK',
		testFailed: '{endpoint} : échec ({reason})',
		a11y: {
			url: 'Champ URL du point de terminaison',
			urlHint: "L'URL qui recevra les événements",
			events: "Champ des types d'événements",
			eventsHint:
				"Types d'événements séparés par des virgules; laissez vide pour tous les événements",
			add: 'Bouton Ajouter un point de terminaison',
			open: 'Ouvrir le point de terminaison {url}',
			test: 'Envoyer un événement test à {url}',
			delete: 'Supprimer le point de terminaison {url}',
		},
	},
	detail: {
		title: 'Point de terminaison Webhook',
		url: 'URL',
		events: 'Événements (séparés par des virgules)',
		save: 'Enregistrer',
		deliveries: 'Envois',
		attemptsOne: '{count} tentative',
		attemptsOther: '{count} tentatives',
		back: 'Retour aux webhooks',
		a11y: {
			url: 'Champ URL du point de terminaison',
			events: "Champ des types d'événements",
			enabled: 'Point de terminaison activé',
			save: 'Bouton Enregistrer',
		},
	},
};

export default webhooks;
