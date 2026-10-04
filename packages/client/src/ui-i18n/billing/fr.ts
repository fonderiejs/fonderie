import type en from './en';

const billing: typeof en = {
	pricing: {
		loading: 'Chargement des forfaits…',
		monthly: 'Mensuel',
		yearly: 'Annuel',
		perMonth: '/mois',
		perYear: '/an',
		choose: 'Choisir {plan}',
		redirecting: 'Redirection…',
	},
	subscription: {
		loading: 'Chargement de l’abonnement…',
		none: 'Vous n’avez aucun abonnement actif.',
		viewPlans: 'Voir les forfaits',
		title: 'Votre abonnement',
		statusLine: 'Statut : {status}',
		statusLineCanceling: 'Statut : {status} (prend fin à la fin de la période)',
		renews: 'Renouvellement le {date}',
		ends: 'Prend fin le {date}',
		manage: 'Gérer la facturation',
		opening: 'Ouverture…',
	},
	paymentMethod: {
		title: 'Mode de paiement',
		loading: 'Chargement du mode de paiement…',
		link: 'Link',
		linkWithEmail: 'Link · {email}',
		card: '{brand} •••• {last4} · expire le {month}/{year}',
		none: 'Aucune carte enregistrée.',
		add: 'Ajouter une carte',
		update: 'Changer de carte',
		remove: 'Supprimer',
		removing: 'Suppression…',
	},
	status: {
		active: 'actif',
		trialing: 'en période d’essai',
		past_due: 'paiement en retard',
		unpaid: 'impayé',
		canceled: 'annulé',
		incomplete: 'incomplet',
		incomplete_expired: 'incomplet (expiré)',
		paused: 'en pause',
	},
};

export default billing;
